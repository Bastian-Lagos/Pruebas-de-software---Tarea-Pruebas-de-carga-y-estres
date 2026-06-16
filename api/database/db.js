/**
 * database/db.js
 * Configura y exporta el pool de conexiones a PostgreSQL.
 * Se usa node-postgres (pg) con un pool para reutilizar conexiones
 * y soportar múltiples solicitudes concurrentes.
 */

const { Pool } = require("pg");

// Configuración del pool de conexiones.
// Los valores se leen desde variables de entorno definidas en docker-compose.yml
const pool = new Pool({
  host:     process.env.DB_HOST     || "localhost",
  port:     parseInt(process.env.DB_PORT || "5432", 10),
  user:     process.env.DB_USER     || "postgres",
  password: process.env.DB_PASSWORD || "postgres123",
  database: process.env.DB_NAME     || "gamesdb",

  // Tamaño máximo del pool (importante para pruebas de carga)
  max: 20,

  // Tiempo máximo de espera para obtener una conexión del pool (ms)
  connectionTimeoutMillis: 5000,

  // Tiempo máximo de inactividad de una conexión antes de cerrarla (ms)
  idleTimeoutMillis: 30000,

  // Tiempo máximo de una consulta antes de cancelarla (ms)
  statement_timeout: 10000,
});

// Evento para logging de conexiones
pool.on("connect", () => {
  if (process.env.NODE_ENV !== "production") {
    console.log("[DB] Nueva conexión establecida con PostgreSQL");
  }
});

// Evento para errores en conexiones inactivas del pool
pool.on("error", (err) => {
  console.error("[DB] Error inesperado en conexión inactiva:", err.message);
});

/**
 * Verifica la conectividad con la base de datos.
 * Se llama al iniciar el servidor.
 */
async function testConnection() {
  const client = await pool.connect();
  try {
    const result = await client.query("SELECT NOW() AS now");
    console.log(`[DB] Conexión exitosa. Timestamp del servidor: ${result.rows[0].now}`);
  } finally {
    client.release();
  }
}

module.exports = { pool, testConnection };
