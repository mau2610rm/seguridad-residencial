import rateLimit from "express-rate-limit";

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300, // límite de peticiones por ventana por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes desde esta IP, por favor intenta de nuevo más tarde." },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 intentos por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de autenticación. Por favor intenta de nuevo en 15 minutos." },
});

export const codeValidateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 15, // máximo 15 intentos por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de validación de códigos. Por favor espera unos minutos." },
});
