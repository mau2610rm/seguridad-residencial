import { Response } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { AuthRequest, authMiddleware, requireRoles } from "../middleware/auth";
import type { Role } from "../middleware/auth";
import { codeValidateLimiter } from "../middleware/rateLimiter";
import { Router } from "express";
import crypto from "crypto";

const prisma = new PrismaClient();
const router = Router();

function generateCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

const createCodeSchema = z.object({
  unitId: z.string(),
  visitorName: z.string().optional(),
  visitorType: z.enum(["casual", "delivery", "servicio", "familiar"]).optional().default("casual"),
  vehiclePlate: z.string().optional(),
  notes: z.string().optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime(),
  maxUses: z.number().int().min(1).default(1),
  doorIds: z.string().optional(), // comma-separated or "*"
});

router.use(authMiddleware);

router.get("/codes", async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  const where: Record<string, unknown> = { createdById: req.user.userId };
  if (req.user.role === "residente" && req.user.unitId) {
    where.unitId = req.user.unitId;
  }
  if (req.user.role === "admin_residencial") {
    delete where.unitId;
    where.unit = { residencialId: req.user.residencialId };
  }
  const codes = await prisma.visitorCode.findMany({
    where,
    include: { unit: { select: { id: true, number: true } } },
    orderBy: { createdAt: "desc" },
  });
  return res.json(codes);
});

router.post("/codes", async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  try {
    const body = createCodeSchema.parse(req.body);
    if (req.user.role === "residente" && req.user.unitId && body.unitId !== req.user.unitId) {
      return res.status(403).json({ error: "Solo puedes generar códigos para tu unidad asignada" });
    }
    const unit = await prisma.unit.findFirst({
      where: {
        id: body.unitId,
        residencialId: req.user.residencialId,
        ...(req.user.role === "residente" ? { userId: req.user.userId } : {}),
      },
    });
    if (!unit) {
      return res.status(404).json({ error: "Unidad no encontrada o sin acceso" });
    }
    const validFrom = body.validFrom ? new Date(body.validFrom) : new Date();
    const validUntil = new Date(body.validUntil);
    if (validUntil <= validFrom) {
      return res.status(400).json({ error: "validUntil debe ser posterior a validFrom" });
    }
    let code: string;
    do {
      code = generateCode();
    } while (await prisma.visitorCode.findUnique({ where: { code } }));

    const visitorCode = await prisma.visitorCode.create({
      data: {
        code,
        unitId: unit.id,
        createdById: req.user.userId,
        visitorName: body.visitorName,
        visitorType: body.visitorType,
        vehiclePlate: body.vehiclePlate?.toUpperCase().trim(),
        notes: body.notes,
        validFrom,
        validUntil,
        maxUses: body.maxUses,
        usesRemaining: body.maxUses,
        doorIds: body.doorIds ?? "*",
      },
      include: { unit: { select: { id: true, number: true } } },
    });
    return res.status(201).json(visitorCode);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: "Datos inválidos", details: e.errors });
    }
    throw e;
  }
});

router.delete("/codes/:id", async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  const code = await prisma.visitorCode.findFirst({
    where: {
      id: req.params.id,
      createdById: req.user.userId,
      ...(req.user.role === "residente" && req.user.unitId ? { unitId: req.user.unitId } : {}),
    },
  });
  if (!code) return res.status(404).json({ error: "Código no encontrado" });
  await prisma.visitorCode.delete({ where: { id: code.id } });
  return res.status(204).send();
});

const validateSchema = z.object({
  code: z.string().length(8),
  doorId: z.string(),
});

router.post("/validate", codeValidateLimiter, requireRoles("guardia", "admin_residencial"), async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  try {
    const body = validateSchema.parse({ ...req.body, code: (req.body.code as string)?.toUpperCase(), doorId: req.body.doorId });
    const visitorCode = await prisma.visitorCode.findUnique({
      where: { code: body.code },
      include: { unit: { include: { residencial: true } } },
    });
    if (!visitorCode) {
      return res.status(404).json({ error: "Código inválido" });
    }
    if (visitorCode.unit.residencialId !== req.user.residencialId) {
      return res.status(403).json({ error: "Código de otro residencial" });
    }
    const now = new Date();
    if (now < visitorCode.validFrom || now > visitorCode.validUntil) {
      return res.status(400).json({ error: "Código fuera de vigencia" });
    }
    if (visitorCode.usesRemaining <= 0) {
      return res.status(400).json({ error: "Código sin usos restantes" });
    }
    const doorAllowed =
      visitorCode.doorIds === "*" ||
      visitorCode.doorIds.split(",").map((s) => s.trim()).includes(body.doorId);
    if (!doorAllowed) {
      return res.status(403).json({ error: "Código no válido para esta puerta" });
    }
    const door = await prisma.door.findFirst({
      where: { id: body.doorId, residencialId: req.user.residencialId },
    });
    if (!door) {
      return res.status(404).json({ error: "Puerta no encontrada" });
    }

    await prisma.$transaction([
      prisma.visitorCode.update({
        where: { id: visitorCode.id },
        data: { usesRemaining: visitorCode.usesRemaining - 1 },
      }),
      prisma.opening.create({
        data: {
          doorId: body.doorId,
          unitId: visitorCode.unitId,
          visitorCodeId: visitorCode.id,
          origin: "codigo_visitante",
        },
      }),
    ]);
    return res.json({
      success: true,
      message: "Acceso permitido",
      unit: visitorCode.unit.number,
      visitorName: visitorCode.visitorName,
      visitorType: visitorCode.visitorType,
      vehiclePlate: visitorCode.vehiclePlate,
      usesRemaining: visitorCode.usesRemaining - 1,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: "Datos inválidos", details: e.errors });
    }
    throw e;
  }
});

export default router;
