import express from "express";
import cors from "cors";
import path from "path";
import { config } from "./config";
import authRoutes from "./routes/auth";
import doorsRoutes from "./routes/doors";
import visitorsRoutes from "./routes/visitors";
import incidentsRoutes from "./routes/incidents";
import paymentsRoutes from "./routes/payments";
import limitsRoutes from "./routes/limits";
import unitsRoutes from "./routes/units";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/doors", doorsRoutes);
app.use("/visitors", visitorsRoutes);
app.use("/incidents", incidentsRoutes);
app.use("/payments", paymentsRoutes);
app.use("/limits", limitsRoutes);
app.use("/units", unitsRoutes);

if (config.uploadDir) {
  app.use("/uploads", express.static(path.resolve(config.uploadDir)));
}

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

app.listen(config.port, () => {
  console.log(`API escuchando en http://localhost:${config.port}`);
});
