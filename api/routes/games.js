/**
 * routes/games.js
 * Define las rutas del recurso /games y aplica validaciones
 * con express-validator antes de pasar al controlador.
 */

const { Router }    = require("express");
const { body, param, query } = require("express-validator");
const ctrl          = require("../controllers/gamesController");

const router = Router();

// ─── Reglas de validación reutilizables ───────────────────────────────────

/** Valida que :id sea un entero positivo */
const validateId = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("El ID debe ser un número entero positivo")
    .toInt(),
];

/** Valida el body para crear un juego (todos los campos requeridos) */
const validateCreateBody = [
  body("nombre")
    .trim()
    .notEmpty()
    .withMessage("El nombre es obligatorio")
    .isLength({ max: 255 })
    .withMessage("El nombre no puede superar 255 caracteres"),

  body("genero")
    .trim()
    .notEmpty()
    .withMessage("El género es obligatorio")
    .isLength({ max: 100 })
    .withMessage("El género no puede superar 100 caracteres"),

  body("plataforma")
    .trim()
    .notEmpty()
    .withMessage("La plataforma es obligatoria")
    .isLength({ max: 100 })
    .withMessage("La plataforma no puede superar 100 caracteres"),

  body("fecha_lanzamiento")
    .notEmpty()
    .withMessage("La fecha de lanzamiento es obligatoria")
    .isDate()
    .withMessage("La fecha de lanzamiento debe tener el formato YYYY-MM-DD"),

  body("precio")
    .notEmpty()
    .withMessage("El precio es obligatorio")
    .isFloat({ min: 0.01 })
    .withMessage("El precio debe ser un número positivo mayor a 0")
    .toFloat(),
];

/** Valida el body para actualizar (todos los campos son opcionales, pero si se envían deben ser válidos) */
const validateUpdateBody = [
  body("nombre")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("El nombre no puede estar vacío si se proporciona")
    .isLength({ max: 255 })
    .withMessage("El nombre no puede superar 255 caracteres"),

  body("genero")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("El género no puede estar vacío si se proporciona")
    .isLength({ max: 100 }),

  body("plataforma")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("La plataforma no puede estar vacía si se proporciona")
    .isLength({ max: 100 }),

  body("fecha_lanzamiento")
    .optional()
    .isDate()
    .withMessage("La fecha de lanzamiento debe tener el formato YYYY-MM-DD"),

  body("precio")
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage("El precio debe ser un número positivo mayor a 0")
    .toFloat(),
];

/** Valida los query params de paginación */
const validatePagination = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("El parámetro page debe ser un entero >= 1")
    .toInt(),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("El parámetro limit debe ser un entero entre 1 y 100")
    .toInt(),
];

// ─── Rutas ────────────────────────────────────────────────────────────────

// GET  /games          → listar todos (con paginación y filtros opcionales)
router.get("/", validatePagination, ctrl.getAllGames);

// GET  /games/:id      → obtener uno por ID
router.get("/:id", validateId, ctrl.getGameById);

// POST /games          → crear nuevo juego
router.post("/", validateCreateBody, ctrl.createGame);

// PUT  /games/:id      → actualizar juego existente
router.put("/:id", [...validateId, ...validateUpdateBody], ctrl.updateGame);

// DELETE /games/:id    → eliminar juego
router.delete("/:id", validateId, ctrl.deleteGame);

module.exports = router;
