/**
 * server.js
 * Punto de entrada del servidor.
 * Verifica la conexión a la BD antes de aceptar solicitudes.
 */

const app                  = require("./app");
const { testConnection }   = require("./database/db");

const PORT = parseInt(process.env.PORT || "3000", 10);

async function start() {
  try {
    // Verificar conexión a PostgreSQL antes de arrancar
    await testConnection();

    app.listen(PORT, "0.0.0.0", () => {
      console.log("===========================================");
      console.log(` API Games corriendo en http://0.0.0.0:${PORT}`);
      console.log(` Entorno: ${process.env.NODE_ENV || "development"}`);
      console.log("===========================================");
    });
  } catch (error) {
    console.error("[server] No se pudo conectar a la base de datos:", error.message);
    process.exit(1);
  }
}

// Manejo de señales para cierre graceful
process.on("SIGTERM", () => {
  console.log("[server] SIGTERM recibido. Cerrando servidor...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[server] SIGINT recibido. Cerrando servidor...");
  process.exit(0);
});

start();
