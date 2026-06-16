/**
 * app.js
 * Configura la aplicación Express: middlewares globales, rutas y manejo de errores.
 */

const express = require("express");
const morgan  = require("morgan");
const cors    = require("cors");

const gamesRouter = require("./routes/games");

const app = express();

// ─── Middlewares globales ─────────────────────────────────────────────────

// Parsear JSON en el body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS — permitir cualquier origen (ajustar en producción real)
app.use(cors());

// Logging HTTP (solo en desarrollo para no saturar logs en pruebas de carga)
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
} else {
  // En producción solo loguear errores 4xx/5xx para no afectar rendimiento
  app.use(morgan("combined", {
    skip: (req, res) => res.statusCode < 400,
  }));
}

// ─── Health check ─────────────────────────────────────────────────────────
// Útil para Docker healthcheck y monitoreo externo
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── Rutas de la API ──────────────────────────────────────────────────────
app.use("/games", gamesRouter);

// ─── Ruta no encontrada (404) ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta ${req.method} ${req.originalUrl} no encontrada`,
  });
});

// ─── Manejador global de errores (500) ───────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[Error no manejado]", err.stack);
  res.status(500).json({
    success: false,
    message: "Error interno del servidor",
  });
});

module.exports = app;
