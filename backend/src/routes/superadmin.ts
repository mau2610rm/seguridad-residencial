import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { AuthRequest, authMiddleware, requireRoles } from "../middleware/auth";
import { mqttBridge } from "../services/mqttBridge";

const prisma = new PrismaClient();
const router = Router();

function renderPingDiagnosticsHtml(residencial: any, pingResult: any, pingedAt: Date) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Residia IoT - Consola de Diagnóstico de Hardware</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #111827;
      --card-border: #1f293d;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --emerald: #10b981;
      --emerald-bg: rgba(16, 185, 129, 0.12);
      --amber: #f59e0b;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 32px 20px;
      display: flex;
      justify-content: center;
    }
    .container {
      width: 100%;
      max-width: 860px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--card-border);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-logo {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: bold;
      color: #fff;
    }
    .brand-text h1 {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    .brand-text p {
      font-size: 12px;
      color: var(--text-muted);
    }
    .badge-status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      background: var(--emerald-bg);
      color: var(--emerald);
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: var(--emerald);
      box-shadow: 0 0 10px var(--emerald);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.9); }
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .card-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
    }
    .item {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 10px;
      padding: 14px;
    }
    .item-label {
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .item-val {
      font-size: 15px;
      font-weight: 600;
      color: #fff;
      word-break: break-all;
    }
    .val-mono {
      font-family: var(--font-mono);
      font-size: 13px;
      color: #93c5fd;
    }
    .val-accent {
      color: var(--emerald);
      font-size: 22px;
      font-weight: 800;
    }
    .actions {
      display: flex;
      gap: 12px;
      margin-top: 20px;
      flex-wrap: wrap;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.15s ease;
      border: none;
    }
    .btn-primary {
      background: var(--primary);
      color: #fff;
    }
    .btn-primary:hover {
      background: var(--primary-hover);
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.07);
      color: var(--text);
      border: 1px solid var(--card-border);
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.12);
    }
    .terminal {
      background: #050811;
      border: 1px solid #172133;
      border-radius: 12px;
      padding: 16px;
      font-family: var(--font-mono);
      font-size: 12px;
      color: #a7f3d0;
      line-height: 1.7;
      overflow-x: auto;
      max-height: 220px;
      overflow-y: auto;
    }
    .terminal-header {
      font-size: 11px;
      color: var(--text-muted);
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
    }
    .tx { color: #60a5fa; }
    .rx { color: #34d399; }
    .crypto { color: #fbbf24; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">
        <div class="brand-logo">R</div>
        <div class="brand-text">
          <h1>Residia IoT Hardware Hub</h1>
          <p>Consola de Enlace y Diagnóstico en Tiempo Real</p>
        </div>
      </div>
      <div class="badge-status">
        <div class="dot"></div>
        <span id="badge-text">ONLINE</span>
      </div>
    </div>

    <div class="card">
      <div class="card-title">📡 Estado del Enlace IoT</div>
      <div class="grid">
        <div class="item">
          <div class="item-label">Fraccionamiento</div>
          <div class="item-val">${residencial.nombre}</div>
        </div>
        <div class="item">
          <div class="item-label">Gateway ID</div>
          <div class="item-val val-mono">${residencial.hardwareGatewayId || "GW-DEFAULT"}</div>
        </div>
        <div class="item">
          <div class="item-label">Latencia RTT</div>
          <div class="item-val val-accent"><span id="latency-num">${pingResult.latencyMs}</span> <span style="font-size: 14px; font-weight: normal; color: var(--text-muted)">ms</span></div>
        </div>
        <div class="item">
          <div class="item-label">Broker MQTT</div>
          <div class="item-val val-mono">${residencial.hardwareBrokerUrl || "mqtt://localhost:1883"}</div>
        </div>
        <div class="item">
          <div class="item-label">Seguridad Criptográfica</div>
          <div class="item-val" style="color: #60a5fa">AES-256-GCM + Anti-Replay</div>
        </div>
        <div class="item">
          <div class="item-label">Último Eco (Ping)</div>
          <div class="item-val" id="last-ping" style="font-size: 13px;">${pingedAt.toLocaleTimeString()}</div>
        </div>
      </div>

      <div class="actions">
        <button class="btn btn-primary" id="btn-ping" onclick="runPing()">
          <span>⚡ Enviar Ping Ahora</span>
        </button>
        <a class="btn btn-secondary" href="?format=json" target="_blank">
          <span>📄 Ver JSON Crudo</span>
        </a>
      </div>
    </div>

    <div class="card">
      <div class="terminal-header">
        <span>CONSOLA DE EVENTOS MQTT & CRIPTOGRAFÍA</span>
        <span>Topic: residia/${residencial.id}/gateways/${residencial.hardwareGatewayId || "GW-DEFAULT"}/cmd</span>
      </div>
      <div class="terminal" id="terminal-logs">
        <div><span class="crypto">[CRYPTO]</span> Algoritmo simétrico inicializado: AES-256-GCM (PBKDF2 10k iter)</div>
        <div><span class="tx">[TX]</span> Ping command despachado hacia concentrador de caseta</div>
        <div><span class="rx">[RX]</span> ${pingResult.message}</div>
        <div><span class="rx">[ACK]</span> Telemetría de hardware verificada (RTT: ${pingResult.latencyMs}ms)</div>
      </div>
    </div>
  </div>

  <script>
    async function runPing() {
      const btn = document.getElementById('btn-ping');
      const latencyNum = document.getElementById('latency-num');
      const lastPing = document.getElementById('last-ping');
      const terminal = document.getElementById('terminal-logs');
      
      btn.disabled = true;
      btn.style.opacity = '0.6';
      btn.innerHTML = '<span>⏳ Verificando enlace...</span>';
      
      try {
        const start = Date.now();
        const res = await fetch(window.location.pathname + '?format=json', { method: 'POST' });
        const data = await res.json();
        
        latencyNum.textContent = data.latencyMs ?? (Date.now() - start);
        lastPing.textContent = new Date().toLocaleTimeString();
        
        const line = document.createElement('div');
        line.innerHTML = '<span class="rx">[' + new Date().toLocaleTimeString() + ']</span> Eco confirmado exitosamente (' + data.latencyMs + 'ms) - ' + (data.message || 'OK');
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
      } catch (e) {
        const line = document.createElement('div');
        line.innerHTML = '<span style="color: #f87171">[ERROR]</span> Falla al comunicarse con backend: ' + e.message;
        terminal.appendChild(line);
      } finally {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.innerHTML = '<span>⚡ Enviar Ping Ahora</span>';
      }
    }
  </script>
</body>
</html>`;
}

// ====================================================================
// 0. DIAGNÓSTICO & PING IOT (Soporta consola web interactiva y llamadas API)
// ====================================================================
router.all("/residenciales/:id/hardware/ping", async (req: AuthRequest, res: Response) => {
  try {
    const residencial = await prisma.residencial.findUnique({
      where: { id: req.params.id },
    });

    if (!residencial) {
      return res.status(404).json({ error: "Residencia no encontrada" });
    }

    const pingResult = await mqttBridge.pingHardware(
      residencial.id,
      residencial.hardwareGatewayId || "GW-DEFAULT",
      residencial.hardwareApiKey || "default-key"
    );

    const now = new Date();
    await prisma.residencial.update({
      where: { id: residencial.id },
      data: {
        hardwareStatus: "online",
        lastHardwarePing: now,
      },
    });

    // Si el cliente es un navegador web (HTML) y no pide json explícito
    const wantsHtml = req.headers.accept?.includes("text/html") && req.query.format !== "json";
    if (wantsHtml) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Security-Policy", "default-src * 'unsafe-inline' 'unsafe-eval';");
      return res.send(renderPingDiagnosticsHtml(residencial, pingResult, now));
    }

    return res.json({
      success: pingResult.success,
      status: "online",
      gatewayId: residencial.hardwareGatewayId,
      brokerUrl: residencial.hardwareBrokerUrl,
      latencyMs: pingResult.latencyMs,
      pingedAt: now.toISOString(),
      message: pingResult.message,
    });
  } catch (err) {
    console.error("Error al probar hardware ping:", err);
    return res.status(500).json({ error: "Error al ejecutar prueba de conectividad IoT" });
  }
});

// Todas las demás rutas de administración requieren autenticación y rol super_admin
router.use(authMiddleware);
router.use(requireRoles("super_admin"));

// ==========================================
// 1. MÉTRICAS GLOBALES DEL SISTEMA
// ==========================================
router.get("/metrics", async (_req: AuthRequest, res: Response) => {
  try {
    const [
      totalResidenciales,
      activeResidenciales,
      totalAdmins,
      totalDoors,
      onlineHardware,
      allResidenciales,
    ] = await Promise.all([
      prisma.residencial.count(),
      prisma.residencial.count({ where: { status: "activa" } }),
      prisma.user.count({ where: { role: "admin_residencial" } }),
      prisma.door.count(),
      prisma.residencial.count({ where: { hardwareStatus: "online" } }),
      prisma.residencial.findMany({
        select: { monthlyFee: true, status: true },
      }),
    ]);

    const projectedMRR = allResidenciales
      .filter((r) => r.status === "activa")
      .reduce((sum, r) => sum + (r.monthlyFee || 0), 0);

    return res.json({
      totalResidenciales,
      activeResidenciales,
      inactiveResidenciales: totalResidenciales - activeResidenciales,
      totalAdmins,
      totalDoors,
      onlineHardware,
      projectedMRR,
    });
  } catch (err) {
    console.error("Error al obtener métricas:", err);
    return res.status(500).json({ error: "Error al calcular métricas globales" });
  }
});

// ==========================================
// 2. GESTIÓN DE RESIDENCIALES
// ==========================================

const residencialCreateSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  direccion: z.string().optional(),
  status: z.enum(["activa", "inactiva", "suspendida"]).default("activa"),
  statusReason: z.string().optional(),
  maxDoors: z.number().int().min(1).default(4),
  planType: z.enum(["basic", "pro", "enterprise"]).default("pro"),
  monthlyFee: z.number().min(0).default(1500),
  billingCycleDay: z.number().int().min(1).max(31).default(1),
  billingStatus: z.enum(["al_dia", "vencido", "gracia"]).default("al_dia"),
  billingNotes: z.string().optional(),
  hardwareGatewayId: z.string().optional(),
  hardwareBrokerUrl: z.string().optional(),
  doors: z
    .array(
      z.object({
        name: z.string().min(1),
        doorType: z.enum(["principal", "peatonal", "vehicular", "servicio"]).default("principal"),
        relayChannel: z.string().default("Relay 1"),
        openPulseMs: z.number().int().default(1500),
        controllerId: z.string().optional(),
        cameraRtspUrl: z.string().optional(),
      })
    )
    .optional(),
});

// Listar todas las residencias
router.get("/residenciales", async (_req: AuthRequest, res: Response) => {
  try {
    const residenciales = await prisma.residencial.findMany({
      include: {
        _count: {
          select: {
            doors: true,
            units: true,
            users: true,
            incidents: true,
          },
        },
        doors: true,
        users: {
          where: { role: "admin_residencial" },
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(residenciales);
  } catch (err) {
    console.error("Error al listar residenciales:", err);
    return res.status(500).json({ error: "Error al obtener residencias" });
  }
});

// Detalle de una residencia
router.get("/residenciales/:id", async (req: AuthRequest, res: Response) => {
  try {
    const residencial = await prisma.residencial.findUnique({
      where: { id: req.params.id },
      include: {
        doors: { orderBy: { name: "asc" } },
        users: {
          where: { role: "admin_residencial" },
          select: { id: true, name: true, email: true, createdAt: true },
        },
        _count: {
          select: { units: true, users: true, incidents: true },
        },
      },
    });

    if (!residencial) {
      return res.status(404).json({ error: "Residencia no encontrada" });
    }

    return res.json(residencial);
  } catch (err) {
    console.error("Error al obtener residencia:", err);
    return res.status(500).json({ error: "Error al obtener detalle de residencia" });
  }
});

// Crear nueva residencia
router.post("/residenciales", async (req: AuthRequest, res: Response) => {
  try {
    const data = residencialCreateSchema.parse(req.body);

    const gatewayId =
      data.hardwareGatewayId?.trim() ||
      `GW-${data.nombre.slice(0, 3).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const apiKey = `res_hw_${crypto.randomBytes(16).toString("hex")}`;
    const brokerUrl = data.hardwareBrokerUrl?.trim() || "mqtts://iot.residia.io:8883";

    const nuevoResidencial = await prisma.residencial.create({
      data: {
        nombre: data.nombre.trim(),
        direccion: data.direccion?.trim() || null,
        status: data.status,
        statusReason: data.statusReason?.trim() || null,
        maxDoors: data.maxDoors,
        planType: data.planType,
        monthlyFee: data.monthlyFee,
        billingCycleDay: data.billingCycleDay,
        billingStatus: data.billingStatus,
        billingNotes: data.billingNotes?.trim() || null,
        hardwareGatewayId: gatewayId,
        hardwareApiKey: apiKey,
        hardwareBrokerUrl: brokerUrl,
        hardwareStatus: "unconfigured",
      },
    });

    // Si se enviaron puertas iniciales o si creamos por defecto
    type InitialDoor = {
      name: string;
      doorType: string;
      relayChannel?: string;
      openPulseMs?: number;
      controllerId?: string;
      cameraRtspUrl?: string;
    };

    const initialDoors: InitialDoor[] = data.doors?.length
      ? data.doors
      : [
          {
            name: "Acceso Principal Vehicular",
            doorType: "principal",
            relayChannel: "Relay 1",
            openPulseMs: 1500,
            controllerId: "CTRL-01",
          },
          {
            name: "Entrada Peatonal Caseta",
            doorType: "peatonal",
            relayChannel: "Relay 2",
            openPulseMs: 1200,
            controllerId: "CTRL-01",
          },
        ];

    for (const d of initialDoors) {
      await prisma.door.create({
        data: {
          name: d.name,
          doorType: d.doorType,
          relayChannel: d.relayChannel || "Relay 1",
          openPulseMs: d.openPulseMs || 1500,
          controllerId: d.controllerId || "CTRL-01",
          cameraRtspUrl: d.cameraRtspUrl || null,
          residencialId: nuevoResidencial.id,
        },
      });
    }

    const residencialCompleto = await prisma.residencial.findUnique({
      where: { id: nuevoResidencial.id },
      include: { doors: true },
    });

    return res.status(201).json(residencialCompleto);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Datos inválidos", details: err.errors });
    }
    console.error("Error al crear residencia:", err);
    return res.status(500).json({ error: "Error al crear la residencia" });
  }
});

// Actualizar residencia
router.put("/residenciales/:id", async (req: AuthRequest, res: Response) => {
  try {
    const {
      nombre,
      direccion,
      status,
      statusReason,
      maxDoors,
      planType,
      monthlyFee,
      billingCycleDay,
      billingStatus,
      billingNotes,
      hardwareGatewayId,
      hardwareBrokerUrl,
      hardwareStatus,
    } = req.body;

    const updated = await prisma.residencial.update({
      where: { id: req.params.id },
      data: {
        ...(nombre !== undefined && { nombre: nombre.trim() }),
        ...(direccion !== undefined && { direccion: direccion?.trim() || null }),
        ...(status !== undefined && { status }),
        ...(statusReason !== undefined && { statusReason: statusReason?.trim() || null }),
        ...(maxDoors !== undefined && { maxDoors: parseInt(maxDoors, 10) }),
        ...(planType !== undefined && { planType }),
        ...(monthlyFee !== undefined && { monthlyFee: parseFloat(monthlyFee) }),
        ...(billingCycleDay !== undefined && { billingCycleDay: parseInt(billingCycleDay, 10) }),
        ...(billingStatus !== undefined && { billingStatus }),
        ...(billingNotes !== undefined && { billingNotes: billingNotes?.trim() || null }),
        ...(hardwareGatewayId !== undefined && { hardwareGatewayId: hardwareGatewayId?.trim() || null }),
        ...(hardwareBrokerUrl !== undefined && { hardwareBrokerUrl: hardwareBrokerUrl?.trim() || null }),
        ...(hardwareStatus !== undefined && { hardwareStatus }),
      },
      include: { doors: true },
    });

    return res.json(updated);
  } catch (err) {
    console.error("Error al actualizar residencia:", err);
    return res.status(500).json({ error: "Error al actualizar la residencia" });
  }
});

// Cambiar estado rápido (Activar / Desactivar / Suspender)
router.patch("/residenciales/:id/status", async (req: AuthRequest, res: Response) => {
  try {
    const { status, statusReason } = req.body;
    if (!["activa", "inactiva", "suspendida"].includes(status)) {
      return res.status(400).json({ error: "Estado no válido (debe ser activa, inactiva o suspendida)" });
    }

    const updated = await prisma.residencial.update({
      where: { id: req.params.id },
      data: {
        status,
        statusReason: statusReason?.trim() || null,
      },
    });

    return res.json({
      success: true,
      message: `Residencia ${updated.nombre} ahora está ${updated.status}`,
      residencial: updated,
    });
  } catch (err) {
    console.error("Error al cambiar estado de residencia:", err);
    return res.status(500).json({ error: "Error al cambiar estado" });
  }
});

// ==========================================
// 3. PUERTAS & HARDWARE POR RESIDENCIA
// ==========================================

// Agregar puerta a residencia
router.post("/residenciales/:id/doors", async (req: AuthRequest, res: Response) => {
  try {
    const residencial = await prisma.residencial.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { doors: true } } },
    });

    if (!residencial) {
      return res.status(404).json({ error: "Residencia no encontrada" });
    }

    if (residencial._count.doors >= residencial.maxDoors) {
      return res.status(400).json({
        error: `Límite alcanzado: Esta residencia tiene configurado un máximo de ${residencial.maxDoors} entradas/puertas. Modifica el límite en la configuración general si deseas agregar más.`,
      });
    }

    const { name, doorType, relayChannel, controllerId, openPulseMs, cameraRtspUrl } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: "El nombre de la puerta es requerido" });
    }

    const newDoor = await prisma.door.create({
      data: {
        name: name.trim(),
        doorType: doorType || "principal",
        relayChannel: relayChannel?.trim() || `Relay ${residencial._count.doors + 1}`,
        controllerId: controllerId?.trim() || "CTRL-01",
        openPulseMs: parseInt(openPulseMs, 10) || 1500,
        cameraRtspUrl: cameraRtspUrl?.trim() || null,
        residencialId: residencial.id,
      },
    });

    return res.status(201).json(newDoor);
  } catch (err) {
    console.error("Error al agregar puerta:", err);
    return res.status(500).json({ error: "Error al registrar la puerta" });
  }
});

// Editar configuración física de una puerta
router.put("/doors/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { name, doorType, relayChannel, controllerId, openPulseMs, cameraRtspUrl } = req.body;

    const updated = await prisma.door.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(doorType && { doorType }),
        ...(relayChannel !== undefined && { relayChannel: relayChannel?.trim() || null }),
        ...(controllerId !== undefined && { controllerId: controllerId?.trim() || null }),
        ...(openPulseMs !== undefined && { openPulseMs: parseInt(openPulseMs, 10) }),
        ...(cameraRtspUrl !== undefined && { cameraRtspUrl: cameraRtspUrl?.trim() || null }),
      },
    });

    return res.json(updated);
  } catch (err) {
    console.error("Error al actualizar puerta:", err);
    return res.status(500).json({ error: "Error al actualizar la puerta" });
  }
});

// Eliminar puerta
router.delete("/doors/:id", async (req: AuthRequest, res: Response) => {
  try {
    await prisma.door.delete({
      where: { id: req.params.id },
    });
    return res.json({ success: true, message: "Puerta eliminada correctamente" });
  } catch (err) {
    console.error("Error al eliminar puerta:", err);
    return res.status(500).json({ error: "Error al eliminar la puerta" });
  }
});

// Regenerar clave secreta del hardware
router.post("/residenciales/:id/hardware/regenerate-key", async (req: AuthRequest, res: Response) => {
  try {
    const newApiKey = `res_hw_${crypto.randomBytes(16).toString("hex")}`;
    const updated = await prisma.residencial.update({
      where: { id: req.params.id },
      data: { hardwareApiKey: newApiKey },
      select: { id: true, nombre: true, hardwareGatewayId: true, hardwareApiKey: true },
    });

    return res.json({
      success: true,
      message: "Nueva API Key generada. Recuerda actualizar la configuración en el Gateway de caseta.",
      hardwareApiKey: updated.hardwareApiKey,
    });
  } catch (err) {
    console.error("Error al regenerar API key de hardware:", err);
    return res.status(500).json({ error: "Error al regenerar la clave" });
  }
});

// ==========================================
// 4. ADMINISTRADORES RESIDENCIALES
// ==========================================

// Listar todos los administradores residenciales
router.get("/admins", async (_req: AuthRequest, res: Response) => {
  try {
    const admins = await prisma.user.findMany({
      where: { role: "admin_residencial" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        residencialId: true,
        residencial: {
          select: { id: true, nombre: true, status: true },
        },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(admins);
  } catch (err) {
    console.error("Error al listar administradores:", err);
    return res.status(500).json({ error: "Error al obtener administradores" });
  }
});

// Crear nuevo administrador asignado a una residencia
const createAdminSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(6, "La contraseña debe tener mínimo 6 caracteres"),
  name: z.string().min(2, "El nombre debe tener mínimo 2 caracteres"),
  residencialId: z.string().min(1, "Debes seleccionar una residencia"),
});

router.post("/admins", async (req: AuthRequest, res: Response) => {
  try {
    const data = createAdminSchema.parse(req.body);

    const residencial = await prisma.residencial.findUnique({
      where: { id: data.residencialId },
    });
    if (!residencial) {
      return res.status(404).json({ error: "La residencia seleccionada no existe" });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    });
    if (existingUser) {
      return res.status(400).json({ error: "Ya existe un usuario con este correo electrónico" });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const newAdmin = await prisma.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        name: data.name.trim(),
        passwordHash,
        role: "admin_residencial",
        residencialId: residencial.id,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        residencialId: true,
        residencial: { select: { id: true, nombre: true } },
        createdAt: true,
      },
    });

    return res.status(201).json(newAdmin);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Datos inválidos", details: err.errors });
    }
    console.error("Error al crear administrador:", err);
    return res.status(500).json({ error: "Error al dar de alta al administrador" });
  }
});

// Actualizar administrador o reasignar residencia
router.put("/admins/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, residencialId, password } = req.body;

    const dataToUpdate: any = {};
    if (name?.trim()) dataToUpdate.name = name.trim();
    if (email?.trim()) dataToUpdate.email = email.toLowerCase().trim();
    if (residencialId) {
      const exists = await prisma.residencial.findUnique({ where: { id: residencialId } });
      if (!exists) return res.status(404).json({ error: "Residencia no encontrada" });
      dataToUpdate.residencialId = residencialId;
    }
    if (password?.trim()) {
      if (password.length < 6) return res.status(400).json({ error: "Contraseña mínima de 6 caracteres" });
      dataToUpdate.passwordHash = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        residencialId: true,
        residencial: { select: { id: true, nombre: true } },
      },
    });

    return res.json(updated);
  } catch (err) {
    console.error("Error al actualizar administrador:", err);
    return res.status(500).json({ error: "Error al actualizar administrador" });
  }
});

// Eliminar administrador
router.delete("/admins/:id", async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user || user.role !== "admin_residencial") {
      return res.status(404).json({ error: "Administrador residencial no encontrado" });
    }

    await prisma.user.delete({ where: { id: req.params.id } });
    return res.json({ success: true, message: "Administrador eliminado correctamente" });
  } catch (err) {
    console.error("Error al eliminar administrador:", err);
    return res.status(500).json({ error: "Error al eliminar administrador" });
  }
});

export default router;
