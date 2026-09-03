import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest, authMiddleware, requireRoles } from "../middleware/auth";
import { checkOpeningLimits } from "../services/limits";
import { Router } from "express";

const prisma = new PrismaClient();
const router = Router();

router.use(authMiddleware);

router.get("/", async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  const doors = await prisma.door.findMany({
    where: { residencialId: req.user.residencialId },
    orderBy: { name: "asc" },
  });
  return res.json(doors);
});

router.post("/:id/open", requireRoles("admin_residencial", "guardia", "residente"), async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  const doorId = req.params.id;

  const door = await prisma.door.findFirst({
    where: { id: doorId, residencialId: req.user.residencialId },
  });
  if (!door) {
    return res.status(404).json({ error: "Puerta no encontrada o sin acceso en este residencial" });
  }

  const limitCheck = await checkOpeningLimits(
    req.user.residencialId,
    doorId,
    req.user.unitId ?? null,
    req.user.userId
  );
  if (!limitCheck.allowed) {
    return res.status(429).json({ error: limitCheck.reason });
  }

  await prisma.opening.create({
    data: {
      doorId,
      userId: req.user.userId,
      unitId: req.user.unitId ?? undefined,
      origin: "app",
    },
  });
  return res.json({ success: true, message: `Puerta ${door.name} abierta (simulación)`, doorId: door.id });
});

router.post("/:id/close", requireRoles("admin_residencial", "guardia"), async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  const doorId = req.params.id;

  const door = await prisma.door.findFirst({
    where: { id: doorId, residencialId: req.user.residencialId },
  });
  if (!door) {
    return res.status(404).json({ error: "Puerta no encontrada o sin acceso en este residencial" });
  }

  return res.json({ success: true, message: `Puerta ${door.name} cerrada (simulación)`, doorId: door.id });
});

export default router;
