import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { OAuth2Client } from "google-auth-library";
import { config } from "../config";
import { AuthRequest, JwtPayload, authMiddleware } from "../middleware/auth";
import { authLimiter } from "../middleware/rateLimiter";

const prisma = new PrismaClient();
const router = Router();
const googleClient = new OAuth2Client(config.google.clientId);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const googleAuthSchema = z.object({
  idToken: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
  role: z.enum(["admin_residencial", "guardia", "residente"]),
  residencialId: z.string().optional(),
  unitId: z.string().optional(),
});

function signTokens(payload: JwtPayload) {
  const secret = config.jwt.secret;
  const accessToken = jwt.sign(payload, secret, { expiresIn: config.jwt.expiresIn } as jwt.SignOptions);
  const refreshToken = jwt.sign(
    { ...payload, type: "refresh" },
    secret,
    { expiresIn: config.jwt.refreshExpiresIn } as jwt.SignOptions
  );
  return { accessToken, refreshToken };
}

router.post("/login", authLimiter, async (req: Request, res: Response) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: body.email },
      include: { unit: true, residencial: true },
    });
    if (!user || !user.passwordHash || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as JwtPayload["role"],
      residencialId: user.residencialId,
      unitId: user.unitId ?? undefined,
    };
    const { accessToken, refreshToken } = signTokens(payload);
    return res.json({
      accessToken,
      refreshToken,
      expiresIn: config.jwt.expiresIn,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        residencialId: user.residencialId,
        unitId: user.unitId,
        residencial: user.residencial ? { id: user.residencial.id, nombre: user.residencial.nombre } : null,
        unit: user.unit ? { id: user.unit.id, number: user.unit.number } : null,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: "Datos inválidos", details: e.errors });
    }
    throw e;
  }
});

router.post("/google", authLimiter, async (req: Request, res: Response) => {
  try {
    const body = googleAuthSchema.parse(req.body);
    let email: string;
    let name: string | undefined;
    let googleId: string;
    let picture: string | undefined;

    // Si el token es de simulación/desarrollo (ej. "dev-mock:usuario@demo.com")
    if (body.idToken.startsWith("dev-mock:")) {
      email = body.idToken.replace("dev-mock:", "").trim().toLowerCase();
      googleId = "google-mock-" + email;
      name = email.split("@")[0];
    } else {
      // Verificación real criptográfica mediante Google Auth Library
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: body.idToken,
          audience: config.google.clientId || undefined,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
          return res.status(401).json({ error: "Token de Google inválido: no contiene email" });
        }
        email = payload.email.toLowerCase();
        googleId = payload.sub;
        name = payload.name;
        picture = payload.picture;
      } catch (err: unknown) {
        return res.status(401).json({
          error: "No se pudo verificar el token de Google",
          details: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Buscar si el usuario existe en el sistema residencial
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { googleId },
          { email },
        ],
      },
      include: { unit: true, residencial: true },
    });

    if (!user) {
      return res.status(403).json({
        error: `El correo ${email} no está registrado en ningún residencial. Solicita a tu administración que te dé de alta como residente o guardia.`,
      });
    }

    // Vincular googleId o actualizar avatar si hace falta
    if (!user.googleId || (picture && !user.avatarUrl) || (!user.name && name)) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: user.googleId ?? googleId,
          avatarUrl: user.avatarUrl ?? picture,
          name: user.name ?? name,
        },
        include: { unit: true, residencial: true },
      });
    }

    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as JwtPayload["role"],
      residencialId: user.residencialId,
      unitId: user.unitId ?? undefined,
    };
    const { accessToken, refreshToken } = signTokens(payload);

    return res.json({
      accessToken,
      refreshToken,
      expiresIn: config.jwt.expiresIn,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        residencialId: user.residencialId,
        unitId: user.unitId,
        residencial: user.residencial ? { id: user.residencial.id, nombre: user.residencial.nombre } : null,
        unit: user.unit ? { id: user.unit.id, number: user.unit.number } : null,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: "Datos inválidos", details: e.errors });
    }
    throw e;
  }
});

router.post("/refresh", authLimiter, async (req: Request, res: Response) => {
  const refreshToken = req.body.refreshToken ?? req.headers["x-refresh-token"];
  if (!refreshToken) {
    return res.status(401).json({ error: "Refresh token no proporcionado" });
  }
  try {
    const decoded = jwt.verify(refreshToken, config.jwt.secret) as JwtPayload & { type?: string };
    if (decoded.type !== "refresh") {
      return res.status(401).json({ error: "Token inválido" });
    }
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, residencialId: true, unitId: true },
    });
    if (!user) {
      return res.status(401).json({ error: "Usuario no encontrado" });
    }
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as JwtPayload["role"],
      residencialId: user.residencialId,
      unitId: user.unitId ?? undefined,
    };
    const { accessToken } = signTokens(payload);
    return res.json({ accessToken, expiresIn: config.jwt.expiresIn });
  } catch {
    return res.status(401).json({ error: "Refresh token inválido o expirado" });
  }
});

router.get("/me", authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      role: true,
      residencialId: true,
      unitId: true,
      residencial: { select: { id: true, nombre: true, direccion: true } },
      unit: { select: { id: true, number: true } },
    },
  });
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  return res.json(user);
});

export default router;
