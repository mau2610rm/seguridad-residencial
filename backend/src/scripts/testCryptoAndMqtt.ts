import { CryptoService, EncryptedEnvelope } from "../services/cryptoService";

async function runSecurityTests() {
  console.log("=================================================");
  console.log("🔒 RESIDIA IOT - SUITE DE PRUEBAS CRIPTOGRÁFICAS");
  console.log("=================================================\n");

  const testGatewayId = "GW-DEMO-01";
  const testSecretKey = "res_hw_99f2e34a76b1001";
  const attackerKey = "res_hw_malicious_attacker_key_99";

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${detail ? `- ${detail}` : ""}`);
    }
  }

  // PRUEBA 1: Cifrado y Descifrado Legítimo con AES-256-GCM
  try {
    const payload = {
      action: "TRIGGER_RELAY",
      doorId: "seed-door-1",
      relayChannel: "Relay 1",
      openPulseMs: 1500,
      timestamp: Date.now(),
    };

    const envelope = CryptoService.encryptPayload(payload, testGatewayId, testSecretKey);

    assert(
      envelope.ver === "1.0" &&
        envelope.gid === testGatewayId &&
        envelope.iv.length === 24 && // 12 bytes en hex
        envelope.tag.length === 32 && // 16 bytes en hex
        typeof envelope.cipher === "string",
      "Prueba 1.1: Generación válida de sobre cifrado AES-256-GCM con AAD e IV"
    );

    const decrypted = CryptoService.decryptPayload<typeof payload>(envelope, testSecretKey, true);
    assert(
      decrypted.action === payload.action &&
        decrypted.doorId === payload.doorId &&
        decrypted.relayChannel === payload.relayChannel,
      "Prueba 1.2: Descifrado e integridad verificada con clave simétrica correcta"
    );
  } catch (err: any) {
    assert(false, "Prueba 1: Falló el flujo de cifrado/descifrado", err.message);
  }

  // PRUEBA 2: Resistencia contra Clave Incorrecta / Atacante
  try {
    const payload = { action: "TRIGGER_RELAY", secret: "super_secret" };
    const envelope = CryptoService.encryptPayload(payload, testGatewayId, testSecretKey);

    let failedAsExpected = false;
    try {
      CryptoService.decryptPayload(envelope, attackerKey, false);
    } catch {
      failedAsExpected = true;
    }

    assert(
      failedAsExpected,
      "Prueba 2: Rechazo criptográfico cuando el atacante no posee la hardwareApiKey"
    );
  } catch (err: any) {
    assert(false, "Prueba 2: Error inesperado", err.message);
  }

  // PRUEBA 3: Detección de Manipulación (Tampering / Man-in-the-Middle)
  try {
    const payload = { action: "TRIGGER_RELAY", relayChannel: "Relay 1" };
    const envelope = CryptoService.encryptPayload(payload, testGatewayId, testSecretKey);

    // Alterar 1 carácter del ciphertext
    const tamperedCipher =
      envelope.cipher.slice(0, -2) + (envelope.cipher.endsWith("A") ? "B" : "A");
    const tamperedEnvelope: EncryptedEnvelope = { ...envelope, cipher: tamperedCipher };

    let tamperedDetected = false;
    try {
      CryptoService.decryptPayload(tamperedEnvelope, testSecretKey, false);
    } catch {
      tamperedDetected = true;
    }

    assert(
      tamperedDetected,
      "Prueba 3: Auth Tag de GCM rechaza inmediatamente cualquier alteración en tránsito (Tampering)"
    );
  } catch (err: any) {
    assert(false, "Prueba 3: Error inesperado", err.message);
  }

  // PRUEBA 4: Protección contra Ataques de Repetición (Replay Attack - Timestamp Expirado)
  try {
    const payload = { action: "TRIGGER_RELAY", timestamp: Date.now() - 45000 }; // 45 segundos en el pasado
    const envelope = CryptoService.encryptPayload(payload, testGatewayId, testSecretKey);

    // Forzar timestamp desfasado en el sobre
    envelope.ts = Date.now() - 45000;

    let replayExpiredBlocked = false;
    try {
      CryptoService.decryptPayload(envelope, testSecretKey, true);
    } catch (err: any) {
      if (err.message.includes("Replay Attack Detectado") || err.message.includes("desfasado")) {
        replayExpiredBlocked = true;
      }
    }

    assert(
      replayExpiredBlocked,
      "Prueba 4: Bloqueo de paquete antiguo (>30s) para mitigar repetición de tramas capturadas"
    );
  } catch (err: any) {
    assert(false, "Prueba 4: Error inesperado", err.message);
  }

  // PRUEBA 5: Protección contra Reutilización de Nonce (Replay Attack - Paquete duplicado)
  try {
    const payload = { action: "TRIGGER_RELAY", timestamp: Date.now() };
    const envelope = CryptoService.encryptPayload(payload, testGatewayId, testSecretKey);

    // Primer descifrado: Debe pasar
    CryptoService.decryptPayload(envelope, testSecretKey, true);

    // Segundo descifrado inmediato del mismo sobre (replay idéntico dentro de la ventana de tiempo)
    let duplicateNonceBlocked = false;
    try {
      CryptoService.decryptPayload(envelope, testSecretKey, true);
    } catch (err: any) {
      if (err.message.includes("Replay Attack Bloqueado") || err.message.includes("ya fue procesado")) {
        duplicateNonceBlocked = true;
      }
    }

    assert(
      duplicateNonceBlocked,
      "Prueba 5: Detección y descarte de Nonce duplicado en ventana activa de memoria"
    );
  } catch (err: any) {
    assert(false, "Prueba 5: Error inesperado", err.message);
  }

  console.log("\n=================================================");
  console.log(`📊 RESULTADOS: ${passedTests} de ${totalTests} pruebas exitosas (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log("=================================================\n");

  if (passedTests === totalTests) {
    console.log("🏆 Todas las pruebas de seguridad de hardware han sido SUPERADAS.");
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runSecurityTests().catch((e) => {
  console.error("Error fatal en suite de pruebas:", e);
  process.exit(1);
});
