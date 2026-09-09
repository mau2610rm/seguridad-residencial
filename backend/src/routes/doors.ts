import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest, authMiddleware, requireRoles } from "../middleware/auth";
import { checkOpeningLimits } from "../services/limits";
import { mqttBridge } from "../services/mqttBridge";
import { Router } from "express";

const prisma = new PrismaClient();
const router = Router();

router.use(authMiddleware);

router.get("/", async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  const doors = await prisma.door.findMany({
    where: { ...(req.user.residencialId ? { residencialId: req.user.residencialId } : {}) },
    orderBy: { name: "asc" },
  });
  return res.json(doors);
});

router.post("/:id/open", requireRoles("admin_residencial", "guardia", "residente"), async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  const doorId = req.params.id;

  const door = await prisma.door.findFirst({
    where: { id: doorId, ...(req.user.residencialId ? { residencialId: req.user.residencialId } : {}) },
    include: { residencial: true },
  });
  if (!door) {
    return res.status(404).json({ error: "Puerta no encontrada o sin acceso en este residencial" });
  }

  if (door.residencial.status !== "activa") {
    return res.status(403).json({
      error: `Acceso restringido: El residencial se encuentra ${door.residencial.status.toUpperCase()}. ${door.residencial.statusReason ? `Motivo: ${door.residencial.statusReason}` : "Contacte a administración central."}`,
    });
  }

  const limitCheck = await checkOpeningLimits(
    door.residencialId,
    doorId,
    req.user.unitId ?? null,
    req.user.userId
  );
  if (!limitCheck.allowed) {
    return res.status(429).json({ error: limitCheck.reason });
  }

  // Despacho seguro por puente MQTT hacia el hardware de caseta
  const hardwareResult = await mqttBridge.dispatchDoorOpen(door, {
    userId: req.user.userId,
    unit: req.user.unitId,
    role: req.user.role,
    origin: "app",
  });

  await prisma.opening.create({
    data: {
      doorId,
      userId: req.user.userId,
      unitId: req.user.unitId ?? undefined,
      origin: "app",
    },
  });

  return res.json({
    success: hardwareResult.success,
    message: hardwareResult.message,
    doorId: door.id,
    mode: hardwareResult.mode,
    relayChannel: hardwareResult.relayChannel,
  });
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
