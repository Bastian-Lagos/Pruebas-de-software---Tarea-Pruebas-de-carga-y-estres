/**
 * controllers/gamesController.js
 * Lógica de negocio para las operaciones CRUD sobre la tabla games.
 * Cada función recibe (req, res) y ejecuta consultas SQL a través del pool.
 */

const { pool } = require("../database/db");
const { validationResult } = require("express-validator");

// ─── Helper: formatear errores de validación ───────────────────────────────
function handleValidationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Error de validación",
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  return null;
}

// ─── GET /games ───────────────────────────────────────────────────────────
/**
 * Obtiene todos los juegos con soporte de paginación.
 * Query params: page (default 1), limit (default 20)
 */
async function getAllGames(req, res) {
  try {
    // Paginación
    const page  = Math.max(1, parseInt(req.query.page  || "1",  10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "20", 10)));
    const offset = (page - 1) * limit;

    // Filtros opcionales
    const { genero, plataforma } = req.query;
    const conditions = [];
    const params     = [];

    if (genero) {
      params.push(`%${genero}%`);
      conditions.push(`genero ILIKE $${params.length}`);
    }
    if (plataforma) {
      params.push(`%${plataforma}%`);
      conditions.push(`plataforma ILIKE $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Consulta paginada
    params.push(limit, offset);
    const dataQuery = `
      SELECT id, nombre, genero, plataforma, fecha_lanzamiento, precio
      FROM games
      ${where}
      ORDER BY id ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    // Consulta para el total (sin limit/offset)
    const countParams  = params.slice(0, params.length - 2);
    const countQuery   = `SELECT COUNT(*) AS total FROM games ${where}`;

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, params),
      pool.query(countQuery, countParams),
    ]);

    const total      = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      data: dataResult.rows,
      pagination: { page, limit, total, totalPages },
    });
  } catch (error) {
    console.error("[getAllGames] Error:", error.message);
    return res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

// ─── GET /games/:id ────────────────────────────────────────────────────────
/**
 * Obtiene un juego por su ID.
 */
async function getGameById(req, res) {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return validationError;

  try {
    const { id } = req.params;
    const result = await pool.query(
      "SELECT id, nombre, genero, plataforma, fecha_lanzamiento, precio FROM games WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: `Juego con ID ${id} no encontrado` });
    }

    return res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("[getGameById] Error:", error.message);
    return res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

// ─── POST /games ───────────────────────────────────────────────────────────
/**
 * Crea un nuevo juego.
 * Body: { nombre, genero, plataforma, fecha_lanzamiento, precio }
 */
async function createGame(req, res) {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return validationError;

  try {
    const { nombre, genero, plataforma, fecha_lanzamiento, precio } = req.body;

    const result = await pool.query(
      `INSERT INTO games (nombre, genero, plataforma, fecha_lanzamiento, precio)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nombre, genero, plataforma, fecha_lanzamiento, precio`,
      [nombre, genero, plataforma, fecha_lanzamiento, precio]
    );

    return res.status(201).json({
      success: true,
      message: "Juego creado exitosamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("[createGame] Error:", error.message);
    return res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

// ─── PUT /games/:id ────────────────────────────────────────────────────────
/**
 * Actualiza un juego existente por su ID.
 * Body: uno o más campos a actualizar.
 */
async function updateGame(req, res) {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return validationError;

  try {
    const { id } = req.params;

    // Verificar que el juego existe
    const existing = await pool.query("SELECT id FROM games WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: `Juego con ID ${id} no encontrado` });
    }

    // Construir la actualización dinámica con los campos enviados
    const fields  = ["nombre", "genero", "plataforma", "fecha_lanzamiento", "precio"];
    const updates = [];
    const values  = [];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        values.push(req.body[field]);
        updates.push(`${field} = $${values.length}`);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: "No se enviaron campos para actualizar" });
    }

    // Agregar updated_at
    updates.push(`updated_at = NOW()`);

    values.push(id);
    const query = `
      UPDATE games
      SET ${updates.join(", ")}
      WHERE id = $${values.length}
      RETURNING id, nombre, genero, plataforma, fecha_lanzamiento, precio
    `;

    const result = await pool.query(query, values);

    return res.status(200).json({
      success: true,
      message: "Juego actualizado exitosamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("[updateGame] Error:", error.message);
    return res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

// ─── DELETE /games/:id ─────────────────────────────────────────────────────
/**
 * Elimina un juego por su ID.
 */
async function deleteGame(req, res) {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return validationError;

  try {
    const { id } = req.params;
    const result = await pool.query(
      "DELETE FROM games WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: `Juego con ID ${id} no encontrado` });
    }

    return res.status(204).send();
  } catch (error) {
    console.error("[deleteGame] Error:", error.message);
    return res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

module.exports = { getAllGames, getGameById, createGame, updateGame, deleteGame };
