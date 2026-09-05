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
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de archivo no permitido. Solo se aceptan imágenes JPEG, PNG y WebP."));
    }
  },
});

const createSchema = z.object({
  type: z.string().min(1),
  description: z.string().min(1),
  location: z.string().optional(),
});

const updateSchema = z.object({
  status: z.enum(["reportado", "en_progreso", "resuelto", "cancelado"]).optional(),
  resolutionNotes: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
});

router.use(authMiddleware);

router.get("/", async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  const where: Record<string, unknown> = { residencialId: req.user.residencialId };

  const statusQuery = req.query.status as string | undefined;
  if (statusQuery && statusQuery !== "all") {
    const statuses = statusQuery.split(",").map((s) => s.trim());
    where.status = { in: statuses };
  }

  const page = Math.max(1, parseInt(String(req.query.page)) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit)) || 20));
  const skip = (page - 1) * limit;

  const [incidents, total] = await Promise.all([
    prisma.incident.findMany({
      where,
      include: {
        reportedBy: { select: { id: true, name: true, email: true } },
      },
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

router.patch("/:id", async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  const incident = await prisma.incident.findFirst({
    where: { id: req.params.id, residencialId: req.user.residencialId },
  });
  if (!incident) return res.status(404).json({ error: "Incidente no encontrado" });

  const isStaff = req.user.role === "admin_residencial" || req.user.role === "guardia";
  const isReporter = incident.reportedById === req.user.userId;

  if (!isStaff && !isReporter) {
    return res.status(403).json({ error: "No tienes permiso para modificar este incidente" });
  }

  try {
    const body = updateSchema.parse(req.body);
    const dataToUpdate: Record<string, unknown> = {};

    if (body.description !== undefined) dataToUpdate.description = body.description;
    if (body.location !== undefined) dataToUpdate.location = body.location;
    if (body.resolutionNotes !== undefined) dataToUpdate.resolutionNotes = body.resolutionNotes;

    if (body.status !== undefined) {
      dataToUpdate.status = body.status;
      if (body.status === "resuelto") {
        dataToUpdate.resolvedAt = new Date();
        dataToUpdate.resolvedById = req.user.userId;
        if (body.resolutionNotes) dataToUpdate.resolutionNotes = body.resolutionNotes;
      } else if (body.status === "cancelado") {
        dataToUpdate.resolvedAt = new Date();
        dataToUpdate.resolvedById = req.user.userId;
        if (body.resolutionNotes) {
          dataToUpdate.resolutionNotes = body.resolutionNotes;
        } else if (!incident.resolutionNotes) {
          dataToUpdate.resolutionNotes = "Incidente cancelado";
        }
      } else if (body.status === "en_progreso") {
        dataToUpdate.resolvedAt = null;
        dataToUpdate.resolvedById = null;
      }
    }

    const updated = await prisma.incident.update({
      where: { id: incident.id },
      data: dataToUpdate,
      include: { reportedBy: { select: { id: true, name: true, email: true } } },
    });
    return res.json(updated);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: "Datos inválidos", details: e.errors });
    }
    throw e;
  }
});

router.get("/photos/:filename", async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  const filename = path.basename(req.params.filename);

  const incident = await prisma.incident.findFirst({
    where: {
      residencialId: req.user.residencialId,
      photos: { contains: filename },
    },
  });

  if (!incident) {
    return res.status(404).json({ error: "Foto no encontrada o no autorizada" });
  }

  const filePath = path.resolve(uploadDir, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Archivo físico no encontrado" });
  }

  return res.sendFile(filePath);
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
