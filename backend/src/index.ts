import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config";
import { generalLimiter } from "./middleware/rateLimiter";
import authRoutes from "./routes/auth";
import doorsRoutes from "./routes/doors";
import visitorsRoutes from "./routes/visitors";
import incidentsRoutes from "./routes/incidents";
import paymentsRoutes from "./routes/payments";
import limitsRoutes from "./routes/limits";
import unitsRoutes from "./routes/units";

const app = express();
app.use(helmet());
app.use(cors());
app.use(generalLimiter);
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/doors", doorsRoutes);
app.use("/visitors", visitorsRoutes);
app.use("/incidents", incidentsRoutes);
app.use("/payments", paymentsRoutes);
app.use("/limits", limitsRoutes);
app.use("/units", unitsRoutes);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

app.listen(config.port, () => {
  console.log(`API escuchando en http://localhost:${config.port}`);
});
