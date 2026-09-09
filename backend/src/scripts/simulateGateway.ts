import mqtt from "mqtt";
import { PrismaClient } from "@prisma/client";
import { CryptoService, EncryptedEnvelope } from "../services/cryptoService";
import { config } from "../config";

const prisma = new PrismaClient();

interface SimulateOptions {
  residencialId?: string;
  residencialNombre?: string;
  gatewayId?: string;
  apiKey?: string;
  brokerUrl?: string;
}

export function startGatewaySimulator(options: SimulateOptions = {}) {
  const residencialId = options.residencialId || "seed-residencial-1";
  const residencialNombre = options.residencialNombre || "Residencial";
  const gatewayId = options.gatewayId || "GW-DEMO-01";
  const apiKey = options.apiKey || "res_hw_99f2e34a76b1001";
  const brokerUrl = options.brokerUrl || config.mqtt.brokerUrl || "mqtt://localhost:1883";

  console.log("\n==========================================================");
  console.log("📟 SIMULADOR DE HARDWARE IOT PARA CASETA DE SEGURIDAD");
  console.log(`   Fraccionamiento: ${residencialNombre}`);
  console.log(`   Residencial ID:  ${residencialId}`);
  console.log(`   Gateway ID:      ${gatewayId}`);
  console.log(`   API Key:         ${apiKey.slice(0, 10)}...`);
  console.log(`   Broker MQTT:     ${brokerUrl}`);
  console.log("==========================================================\n");

  const client = mqtt.connect(brokerUrl, {
    clientId: `sim_${gatewayId}_${Math.random().toString(16).slice(2, 6)}`,
    clean: true,
    reconnectPeriod: 4000,
  });

  const cmdTopic = `residia/${residencialId}/gateways/${gatewayId}/cmd`;
  const ackTopic = `residia/${residencialId}/gateways/${gatewayId}/ack`;
  const telemetryTopic = `residia/${residencialId}/gateways/${gatewayId}/telemetry`;

  let uptimeSeconds = 0;
  let telemetryTimer: NodeJS.Timeout | null = null;

  client.on("connect", () => {
    console.log(`🟢 [Hardware Gateway] Enlazado exitosamente al broker MQTT (${brokerUrl})`);

    // Suscribirse a órdenes entrantes del backend para este residencial
    client.subscribe(cmdTopic, { qos: 1 }, (err) => {
      if (err) {
        console.error("❌ Error al suscribirse a canal de comandos:", err);
      } else {
        console.log(`📡 [Hardware Gateway] Escuchando comandos cifrados en: ${cmdTopic}`);
        console.log(`\n👉 PARA PROBAR EL PING EN VIVO AHORA:`);
        console.log(`   1. Abre en tu navegador la consola interactiva:`);
        console.log(`      http://localhost:3000/superadmin/residenciales/${residencialId}/hardware/ping`);
        console.log(`   2. O haz clic en "Ping IoT" en la app móvil`);
        console.log(`   3. ¡Verás los paquetes cifrados y el pulso del actuador llegar aquí en tiempo real!\n`);
      }
    });

    // Enviar telemetría inicial y luego periódica cada 25 segundos
    sendTelemetry();
    telemetryTimer = setInterval(sendTelemetry, 25000);
  });

  function sendTelemetry() {
    uptimeSeconds += 25;
    const telemetryData = {
      gatewayId,
      uptimeSeconds,
      freeMemoryBytes: 198420,
      cpuTempCelsius: +(41.5 + Math.random() * 2).toFixed(1),
      wifiRssi: -55 - Math.floor(Math.random() * 8),
      relaysStatus: {
        "Relay 1": "OPEN",
        "Relay 2": "OPEN",
      },
      timestamp: Date.now(),
    };

    // Cifrar telemetría antes de emitirla
    const envelope = CryptoService.encryptPayload(telemetryData, gatewayId, apiKey);
    client.publish(telemetryTopic, JSON.stringify(envelope), { qos: 1 });
    console.log(`💓 [Heartbeat IoT] [${residencialNombre}] Telemetría enviada (Uptime: ${uptimeSeconds}s | RSSI: ${telemetryData.wifiRssi} dBm)`);
  }

  client.on("message", (topic, messageBuffer) => {
    if (topic !== cmdTopic) return;

    try {
      const raw = messageBuffer.toString("utf8");
      const envelope: EncryptedEnvelope = JSON.parse(raw);

      console.log(`\n📥 [Hardware Gateway] Paquete recibido en ${topic} (Cifrado: ${envelope.cipher.length} bytes)`);

      // 1. Descifrar con validación de Anti-Replay
      const command = CryptoService.decryptPayload<any>(envelope, apiKey, true);
      console.log(`🔓 [Descifrado Exitoso] Acción: ${command.action} | RequestId: ${command.requestId}`);

      if (command.action === "TRIGGER_RELAY") {
        const channel = command.relayChannel || "Relay 1";
        const pulseMs = command.openPulseMs || 1500;
        const doorName = command.doorName || "Puerta";

        console.log(`⚡ [ACTUADOR FÍSICO] Disparando ${channel} para "${doorName}"`);
        console.log(`   └─ [CONTACTO CERRADO] Circuito energizado por ${pulseMs}ms...`);

        setTimeout(() => {
          console.log(`   └─ [CONTACTO ABIERTO] Pulso completado. Retornando a reposo.`);

          // 2. Emitir confirmación física (ACK) cifrada
          const ackPayload = {
            action: "TRIGGER_RELAY_ACK",
            requestId: command.requestId,
            status: "SUCCESS",
            relayChannel: channel,
            executionTimeMs: 12,
            doorSensors: {
              reedSwitch: "ACTIVATED",
              loopDetector: "CLEAR",
            },
            timestamp: Date.now(),
          };

          const ackEnvelope = CryptoService.encryptPayload(ackPayload, gatewayId, apiKey);
          client.publish(ackTopic, JSON.stringify(ackEnvelope), { qos: 1 });
          console.log(`📤 [ACK Enviado] Confirmación física de apertura emitida al backend.\n`);
        }, 150);
      } else if (command.action === "PING") {
        console.log(`🏓 [PING IoT] Solicitud de eco recibida de SuperAdmin. Respondiendo...`);
        const ackPayload = {
          action: "PING_ACK",
          requestId: command.requestId,
          status: "SUCCESS",
          executionTimeMs: 2,
          timestamp: Date.now(),
        };

        const ackEnvelope = CryptoService.encryptPayload(ackPayload, gatewayId, apiKey);
        client.publish(ackTopic, JSON.stringify(ackEnvelope), { qos: 1 });
        console.log(`📤 [PING ACK Enviado] Respuesta de eco enviada a SuperAdmin.\n`);
      }
    } catch (err: any) {
      console.error(`🚨 [ALERTA DE SEGURIDAD EN CASETA] Rechazo de paquete: ${err.message}`);
    }
  });

  client.on("error", (err) => {
    console.warn(`[Hardware Gateway Warning] ${err.message}`);
  });

  return {
    client,
    stop: () => {
      if (telemetryTimer) clearInterval(telemetryTimer);
      client.end();
    },
  };
}

// Ejecutar directamente si es invocado por CLI con soporte de autodescubrimiento
async function main() {
  const arg = process.argv[2];

  let targets = [];

  if (arg === "--all") {
    targets = await prisma.residencial.findMany({
      where: { hardwareApiKey: { not: null } },
    });
  } else if (arg) {
    // Buscar por ID exacto o coincidencia de nombre
    const found = await prisma.residencial.findFirst({
      where: {
        OR: [
          { id: arg },
          { nombre: { contains: arg } },
          { hardwareGatewayId: arg },
        ],
      },
    });
    if (found) targets.push(found);
  } else {
    // Si no se pasó argumento, buscar el residencial más reciente con hardwareApiKey configurado
    const found = await prisma.residencial.findFirst({
      where: { hardwareApiKey: { not: null } },
      orderBy: { updatedAt: "desc" },
    });
    if (found) targets.push(found);
  }

  if (!targets.length) {
    console.log("No se encontraron residenciales con hardwareApiKey en la base de datos.");
    console.log("Iniciando simulador con parámetros demo por defecto...");
    startGatewaySimulator();
    return;
  }

  for (const res of targets) {
    startGatewaySimulator({
      residencialId: res.id,
      residencialNombre: res.nombre,
      gatewayId: res.hardwareGatewayId || "GW-DEMO-01",
      apiKey: res.hardwareApiKey || "res_hw_default_key",
      brokerUrl: res.hardwareBrokerUrl || config.mqtt.brokerUrl,
    });
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
