import { Response } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { AuthRequest, authMiddleware, requireRoles } from "../middleware/auth";
import { Router } from "express";

const prisma = new PrismaClient();
const router = Router();

const confirmSchema = z.object({
  reference: z.string().optional(),
});

router.use(authMiddleware);

router.get("/", async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  const where: Record<string, unknown> = {};
  if (req.user.role === "residente" && req.user.unitId) {
    where.unitId = req.user.unitId;
  } else if (req.user.role === "admin_residencial") {
    where.unit = { residencialId: req.user.residencialId };
  } else {
    where.unitId = req.user.unitId;
  }
  const payments = await prisma.payment.findMany({
    where,
    include: { unit: { select: { id: true, number: true } } },
    orderBy: { dueDate: "desc" },
  });
  return res.json(payments);
});

router.post("/:id/confirm", requireRoles("admin_residencial"), async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  const payment = await prisma.payment.findFirst({
    where: {
      id: req.params.id,
      unit: { residencialId: req.user.residencialId },
    },
  });
  if (!payment) return res.status(404).json({ error: "Pago no encontrado" });
  const body = confirmSchema.parse(req.body || {});
  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "pagado",
      paidAt: new Date(),
      reference: body.reference ?? payment.reference,
    },
    include: { unit: { select: { id: true, number: true } } },
  });
  return res.json(updated);
});

export default router;
