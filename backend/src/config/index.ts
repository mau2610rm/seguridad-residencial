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
};
