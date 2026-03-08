import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type Role = "admin_residencial" | "guardia" | "residente";

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
  residencialId: string;
  unitId?: string;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token no proporcionado" });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, residencialId: true, unitId: true },
    });
    if (!user) {
      return res.status(401).json({ error: "Usuario no encontrado" });
    }
    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role as Role,
      residencialId: user.residencialId,
      unitId: user.unitId ?? undefined,
    };
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

export function requireRoles(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "No autenticado" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Sin permisos para esta acción" });
    }
    next();
  };
}
