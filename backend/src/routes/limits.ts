import { Response } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { AuthRequest, authMiddleware, requireRoles } from "../middleware/auth";
import { Router } from "express";

const prisma = new PrismaClient();
const router = Router();

const putLimitSchema = z.object({
  unitId: z.string().nullable().optional(),
  doorId: z.string().nullable().optional(),
  maxOpenings: z.number().int().min(1),
  period: z.enum(["day", "month"]),
});

router.use(authMiddleware);

router.get("/", requireRoles("admin_residencial"), async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  const limits = await prisma.openingLimit.findMany({
    where: { residencialId: req.user.residencialId },
    orderBy: { createdAt: "desc" },
  });
  return res.json(limits);
});

router.put("/", requireRoles("admin_residencial"), async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  try {
    const body = putLimitSchema.parse(req.body);
    if (body.unitId) {
      const unit = await prisma.unit.findFirst({
        where: { id: body.unitId, residencialId: req.user!.residencialId },
      });
      if (!unit) return res.status(404).json({ error: "Unidad no encontrada" });
    }
    if (body.doorId) {
      const door = await prisma.door.findFirst({
        where: { id: body.doorId, residencialId: req.user!.residencialId },
      });
      if (!door) return res.status(404).json({ error: "Puerta no encontrada" });
    }
    const limit = await prisma.openingLimit.create({
      data: {
        residencialId: req.user.residencialId,
        unitId: body.unitId ?? undefined,
        doorId: body.doorId ?? undefined,
        maxOpenings: body.maxOpenings,
        period: body.period,
      },
    });
    return res.status(201).json(limit);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: "Datos inválidos", details: e.errors });
    }
    throw e;
  }
});

router.delete("/:id", requireRoles("admin_residencial"), async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  const limit = await prisma.openingLimit.findFirst({
    where: { id: req.params.id, residencialId: req.user.residencialId },
  });
  if (!limit) return res.status(404).json({ error: "Límite no encontrado" });
  await prisma.openingLimit.delete({ where: { id: limit.id } });
  return res.status(204).send();
});

export default router;
