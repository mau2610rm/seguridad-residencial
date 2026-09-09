export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  jwt: {
    secret: process.env.JWT_SECRET || "dev-secret-change-in-production",
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
  },
  uploadDir: process.env.UPLOAD_DIR || "./uploads",
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || "",
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  },
  mqtt: {
    brokerUrl: process.env.MQTT_BROKER_URL || "mqtt://localhost:1883",
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    reconnectPeriodMs: 5000,
    connectTimeoutMs: 10000,
  },
};
