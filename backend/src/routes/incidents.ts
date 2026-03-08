import { Response } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { AuthRequest, authMiddleware, requireRoles } from "../middleware/auth";
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { config } from "../config";

const prisma = new PrismaClient();
const router = Router();

const uploadDir = config.uploadDir;
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `incident-${unique}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const createSchema = z.object({
  type: z.string().min(1),
  description: z.string().min(1),
  location: z.string().optional(),
});

const updateSchema = z.object({
  status: z.string().optional(),
  description: z.string().optional(),
});

router.use(authMiddleware);

router.get("/", async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  const where: Record<string, unknown> = { residencialId: req.user.residencialId };
  const page = Math.max(1, parseInt(String(req.query.page)) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit)) || 20));
  const skip = (page - 1) * limit;

  const [incidents, total] = await Promise.all([
    prisma.incident.findMany({
      where,
      include: { reportedBy: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.incident.count({ where }),
  ]);
  return res.json({ data: incidents, total, page, limit });
});

router.post("/", upload.array("photos", 5), async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  try {
    const body = createSchema.parse(req.body);
    const files = (req as unknown as { files?: Express.Multer.File[] }).files;
    const photoPaths = files?.length
      ? files.map((f) => f.filename).join(",")
      : undefined;

    const incident = await prisma.incident.create({
      data: {
        type: body.type,
        description: body.description,
        location: body.location,
        photos: photoPaths,
        reportedById: req.user.userId,
        residencialId: req.user.residencialId,
      },
      include: { reportedBy: { select: { id: true, name: true, email: true } } },
    });
    return res.status(201).json(incident);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: "Datos inválidos", details: e.errors });
    }
    throw e;
  }
});

router.patch("/:id", requireRoles("admin_residencial", "guardia"), async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  const incident = await prisma.incident.findFirst({
    where: { id: req.params.id, residencialId: req.user.residencialId },
  });
  if (!incident) return res.status(404).json({ error: "Incidente no encontrado" });
  const body = updateSchema.parse(req.body);
  const updated = await prisma.incident.update({
    where: { id: incident.id },
    data: body,
    include: { reportedBy: { select: { id: true, name: true, email: true } } },
  });
  return res.json(updated);
});

router.get("/:id", async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  const incident = await prisma.incident.findFirst({
    where: { id: req.params.id, residencialId: req.user.residencialId },
    include: { reportedBy: { select: { id: true, name: true, email: true } } },
  });
  if (!incident) return res.status(404).json({ error: "Incidente no encontrado" });
  return res.json(incident);
});

export default router;
