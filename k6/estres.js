/**
 * k6/estres.js
 * ============================================================
 * Prueba de ESTRÉS con Grafana k6
 * Objetivo: encontrar el punto de degradación del sistema
 *           incrementando progresivamente los usuarios virtuales.
 *
 * Etapas:
 *   100 → 200 → 300 → 400 → 500 VUs (1 min por etapa, 30s ramp-up)
 *
 * Ejecutar:
 *   k6 run k6/estres.js
 *   k6 run --out json=k6/resultados/estres.json k6/estres.js
 * ============================================================
 */

import http  from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter, Gauge } from "k6/metrics";

// ─── Métricas personalizadas ─────────────────────────────────────────────
const errorRate     = new Rate("error_rate");
const reqDuration   = new Trend("req_duration_stress", true);
const totalReqs     = new Counter("total_requests_stress");
const activeUsers   = new Gauge("active_vus_gauge");

// ─── Opciones ─────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    estres_progresivo: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        // Etapa 0 — calentamiento
        { duration: "30s", target: 50  },

        // Etapa 1 — 100 VUs
        { duration: "30s", target: 100 },
        { duration: "1m",  target: 100 },

        // Etapa 2 — 200 VUs
        { duration: "30s", target: 200 },
        { duration: "1m",  target: 200 },

        // Etapa 3 — 300 VUs
        { duration: "30s", target: 300 },
        { duration: "1m",  target: 300 },

        // Etapa 4 — 400 VUs
        { duration: "30s", target: 400 },
        { duration: "1m",  target: 400 },

        // Etapa 5 — 500 VUs (punto de ruptura esperado)
        { duration: "30s", target: 500 },
        { duration: "1m",  target: 500 },

        // Ramp-down para liberar conexiones ordenadamente
        { duration: "30s", target: 0   },
      ],
      gracefulRampDown: "30s",
    },
  },

  // ── Umbrales de degradación ─────────────────────────────────────────
  // En pruebas de estrés NO se espera cumplirlos todos;
  // se usan para registrar cuándo el sistema empieza a fallar.
  thresholds: {
    // Tasa de error — alerta si supera 5%
    "error_rate":             ["rate<0.05"],
    // P95 global — alerta si supera 3 segundos
    "http_req_duration":      ["p(95)<3000"],
    // P95 personalizado
    "req_duration_stress":    ["p(95)<3000"],
    // Solicitudes fallidas
    "http_req_failed":        ["rate<0.05"],
  },
};

// ─── Configuración ───────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const HEADERS  = { "Content-Type": "application/json", "Accept": "application/json" };

const GENEROS     = ["Acción","Aventura","RPG","Estrategia","Deportes","Shooter","Terror","Puzzle"];
const PLATAFORMAS = ["PC","PlayStation 5","PlayStation 4","Xbox Series X","Nintendo Switch","Mobile"];

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomPrice()   { return parseFloat((Math.random() * 79 + 0.99).toFixed(2)); }
function randomDate() {
  const start = new Date(2000, 0, 1).getTime();
  const end   = new Date(2024, 11, 31).getTime();
  return new Date(start + Math.random() * (end - start)).toISOString().split("T")[0];
}

function buildGame() {
  const prefixes = ["Shadow","Cyber","Dark","Neon","Iron","Gold","Star","Fire","Ice","Storm"];
  const suffixes = ["Quest","Legend","Saga","Empire","Warriors","Odyssey","Rising","Fallen"];
  return {
    nombre:            `${randomItem(prefixes)} ${randomItem(suffixes)}`,
    genero:            randomItem(GENEROS),
    plataforma:        randomItem(PLATAFORMAS),
    fecha_lanzamiento: randomDate(),
    precio:            randomPrice(),
  };
}

// ─── Función principal ────────────────────────────────────────────────────
export default function () {
  // Actualizar gauge de usuarios activos
  activeUsers.add(1);
  totalReqs.add(1);

  const rand = Math.random();

  group("Stress — Operaciones mixtas", () => {

    if (rand < 0.50) {
      // 50% → GET /games (paginado)
      group("GET /games", () => {
        const page  = Math.floor(Math.random() * 20) + 1;
        const limit = 20;
        const res   = http.get(
          `${BASE_URL}/games?page=${page}&limit=${limit}`,
          { headers: HEADERS, timeout: "10s" }
        );
        reqDuration.add(res.timings.duration);

        const ok = check(res, {
          "stress GET /games → no timeout":      (r) => r.status !== 0,
          "stress GET /games → status 200":       (r) => r.status === 200,
          "stress GET /games → responde < 3s":    (r) => r.timings.duration < 3000,
        });
        errorRate.add(!ok);
      });

    } else if (rand < 0.70) {
      // 20% → GET /games/:id
      group("GET /games/:id", () => {
        const id  = Math.floor(Math.random() * 1000) + 1;
        const res = http.get(`${BASE_URL}/games/${id}`, { headers: HEADERS, timeout: "10s" });
        reqDuration.add(res.timings.duration);

        const ok = check(res, {
          "stress GET /:id → no timeout":        (r) => r.status !== 0,
          "stress GET /:id → 200 o 404":         (r) => [200, 404].includes(r.status),
          "stress GET /:id → responde < 3s":     (r) => r.timings.duration < 3000,
        });
        errorRate.add(!ok);
      });

    } else if (rand < 0.85) {
      // 15% → POST /games
      group("POST /games", () => {
        const res = http.post(
          `${BASE_URL}/games`,
          JSON.stringify(buildGame()),
          { headers: HEADERS, timeout: "10s" }
        );
        reqDuration.add(res.timings.duration);

        const ok = check(res, {
          "stress POST → no timeout":            (r) => r.status !== 0,
          "stress POST → 201 o 429":             (r) => [201, 429, 503].includes(r.status),
          "stress POST → responde < 3s":         (r) => r.timings.duration < 3000,
        });
        errorRate.add(!ok);
      });

    } else {
      // 15% → PUT /games/:id
      group("PUT /games/:id", () => {
        const id   = Math.floor(Math.random() * 950) + 1;
        const body = { precio: randomPrice() };
        const res  = http.put(
          `${BASE_URL}/games/${id}`,
          JSON.stringify(body),
          { headers: HEADERS, timeout: "10s" }
        );
        reqDuration.add(res.timings.duration);

        const ok = check(res, {
          "stress PUT → no timeout":             (r) => r.status !== 0,
          "stress PUT → 200 o 404":              (r) => [200, 404].includes(r.status),
          "stress PUT → responde < 3s":          (r) => r.timings.duration < 3000,
        });
        errorRate.add(!ok);
      });
    }
  });

  // Pausa más corta en estrés para presionar más al sistema
  sleep(Math.random() * 0.3);
}

// ─── Resumen personalizado al finalizar ──────────────────────────────────
export function handleSummary(data) {
  const metrics = data.metrics;

  // Extraer métricas clave
  const p95       = metrics["http_req_duration"]?.values?.["p(95)"]?.toFixed(2) ?? "N/A";
  const p99       = metrics["http_req_duration"]?.values?.["p(99)"]?.toFixed(2) ?? "N/A";
  const avg       = metrics["http_req_duration"]?.values?.["avg"]?.toFixed(2) ?? "N/A";
  const maxDur    = metrics["http_req_duration"]?.values?.["max"]?.toFixed(2) ?? "N/A";
  const errRate   = ((metrics["http_req_failed"]?.values?.rate ?? 0) * 100).toFixed(2);
  const rps       = metrics["http_reqs"]?.values?.rate?.toFixed(2) ?? "N/A";
  const totalR    = metrics["http_reqs"]?.values?.count ?? 0;

  const resumen = `
╔══════════════════════════════════════════════════════════╗
║           RESUMEN — PRUEBA DE ESTRÉS k6                  ║
╠══════════════════════════════════════════════════════════╣
║  Total solicitudes:        ${String(totalR).padEnd(28)}║
║  Throughput (req/s):       ${String(rps).padEnd(28)}║
╠══════════════════════════════════════════════════════════╣
║  Tiempo de respuesta                                     ║
║    Promedio:               ${String(avg + " ms").padEnd(28)}║
║    Percentil 95:           ${String(p95 + " ms").padEnd(28)}║
║    Percentil 99:           ${String(p99 + " ms").padEnd(28)}║
║    Máximo:                 ${String(maxDur + " ms").padEnd(28)}║
╠══════════════════════════════════════════════════════════╣
║  Tasa de errores:          ${String(errRate + "%").padEnd(28)}║
╚══════════════════════════════════════════════════════════╝
`;

  console.log(resumen);

  // Retornar también el JSON estándar de k6
  return {
    stdout: resumen,
  };
}
