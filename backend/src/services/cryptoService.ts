import crypto from "crypto";

export interface EncryptedEnvelope {
  ver: string;       // Versión del protocolo, ej: "1.0"
  gid: string;       // Gateway ID de la caseta
  ts: number;        // Timestamp UTC en milisegundos
  nonce: string;     // Token criptográfico único anti-repetición
  iv: string;        // Vector de inicialización (12 bytes en hex)
  tag: string;       // Etiqueta de autenticación GCM (16 bytes en hex)
  cipher: string;    // Carga útil cifrada en Base64
}

export interface AntiReplayConfig {
  maxTimeDriftMs: number; // Tolerancia de desviación horaria máxima (ej. 30,000 ms = 30 seg)
}

export class CryptoService {
  private static seenNonces = new Map<string, number>(); // Nonce -> Timestamp de expiración
  private static MAX_TIME_DRIFT_MS = 30000; // 30 segundos
  private static CLEANUP_INTERVAL_MS = 60000; // Limpieza periódica de caché cada 1 min

  static {
    // Tarea en segundo plano para podar nonces expirados
    if (typeof setInterval !== "undefined") {
      setInterval(() => {
        const now = Date.now();
        for (const [nonce, expiresAt] of this.seenNonces.entries()) {
          if (now > expiresAt) {
            this.seenNonces.delete(nonce);
          }
        }
      }, this.CLEANUP_INTERVAL_MS).unref();
    }
  }

  /**
   * Deriva una clave simétrica de 256 bits (32 bytes) a partir de la hardwareApiKey del residencial.
   */
  private static deriveKey(secretKey: string): Buffer {
    return crypto.createHash("sha256").update(secretKey, "utf8").digest();
  }

  /**
   * Cifra cualquier objeto o mensaje con AES-256-GCM y empaqueta el sobre criptográfico.
   */
  public static encryptPayload<T>(
    data: T,
    gatewayId: string,
    secretKey: string
  ): EncryptedEnvelope {
    const key = this.deriveKey(secretKey);
    const iv = crypto.randomBytes(12); // Recomendado para GCM (96 bits)
    const nonce = crypto.randomBytes(16).toString("hex");
    const timestamp = Date.now();

    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    // Datos asociados autenticados (AAD): vincula la versión, el gatewayId y el timestamp
    const aad = Buffer.from(`${gatewayId}:${timestamp}:${nonce}`, "utf8");
    cipher.setAAD(aad);

    const plaintext = JSON.stringify(data);
    let ciphertext = cipher.update(plaintext, "utf8", "base64");
    ciphertext += cipher.final("base64");

    const authTag = cipher.getAuthTag();

    return {
      ver: "1.0",
      gid: gatewayId,
      ts: timestamp,
      nonce,
      iv: iv.toString("hex"),
      tag: authTag.toString("hex"),
      cipher: ciphertext,
    };
  }

  /**
   * Valida la ventana de tiempo del mensaje y el nonce para evitar ataques de repetición (Replay Attacks).
   */
  public static validateAntiReplay(envelope: EncryptedEnvelope): {
    valid: boolean;
    reason?: string;
  } {
    const now = Date.now();
    const drift = Math.abs(now - envelope.ts);

    // 1. Validar ventana de tiempo máxima (tolerancia contra desincronización y captura previa)
    if (drift > this.MAX_TIME_DRIFT_MS) {
      return {
        valid: false,
        reason: `Replay Attack Detectado o Reloj Desfasado: Diferencia de ${Math.round(
          drift / 1000
        )}s supera el límite de ${this.MAX_TIME_DRIFT_MS / 1000}s.`,
      };
    }

    // 2. Validar que el Nonce no haya sido procesado previamente
    if (this.seenNonces.has(envelope.nonce)) {
      return {
        valid: false,
        reason: `Replay Attack Bloqueado: El nonce [${envelope.nonce}] ya fue procesado con anterioridad.`,
      };
    }

    // Registrar nonce en caché con expiración igual a la ventana de tolerancia * 2
    this.seenNonces.set(envelope.nonce, now + this.MAX_TIME_DRIFT_MS * 2);
    return { valid: true };
  }

  /**
   * Descifra el sobre verificando la integridad con el Auth Tag GCM y aplicando protección anti-replay.
   */
  public static decryptPayload<T>(
    envelope: EncryptedEnvelope,
    secretKey: string,
    enforceAntiReplay: boolean = true
  ): T {
    if (enforceAntiReplay) {
      const replayCheck = this.validateAntiReplay(envelope);
      if (!replayCheck.valid) {
        throw new Error(replayCheck.reason);
      }
    }

    const key = this.deriveKey(secretKey);
    const iv = Buffer.from(envelope.iv, "hex");
    const authTag = Buffer.from(envelope.tag, "hex");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);

    // Los datos asociados autenticados deben coincidir exactamente con los usados al cifrar
    const aad = Buffer.from(`${envelope.gid}:${envelope.ts}:${envelope.nonce}`, "utf8");
    decipher.setAAD(aad);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(envelope.cipher, "base64", "utf8");
    decrypted += decipher.final("utf8");

    return JSON.parse(decrypted) as T;
  }

  /**
   * Limpia manualmente la caché de nonces (útil para pruebas unitarias).
   */
  public static resetNonceCache(): void {
    this.seenNonces.clear();
  }
}
