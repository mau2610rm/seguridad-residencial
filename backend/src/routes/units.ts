import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest, authMiddleware } from "../middleware/auth";
import { Router } from "express";

const prisma = new PrismaClient();
const router = Router();

router.use(authMiddleware);

router.get("/", async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  const where: { residencialId: string; userId?: string } = { residencialId: req.user.residencialId };
  if (req.user.role === "residente") {
    where.userId = req.user.userId;
  }
  const units = await prisma.unit.findMany({
    where,
    select: { id: true, number: true },
    orderBy: { number: "asc" },
  });
  return res.json(units);
});

export default router;
