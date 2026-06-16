/**
 * k6/carga.js
 * ============================================================
 * Prueba de CARGA con Grafana k6
 * Objetivo: verificar que la API soporta carga moderada
 *           sin degradación significativa.
 *
 * Escenario 1 — Lecturas intensivas (70/20/10%)
 * Escenario 2 — CRUD mixto (50/20/15/15%)
 *
 * Ejecutar:
 *   k6 run k6/carga.js
 *   k6 run --out json=k6/resultados/carga.json k6/carga.js
 * ============================================================
 */

import http    from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

// ─── Métricas personalizadas ─────────────────────────────────────────────
const errorRate        = new Rate("error_rate");
const getGamesDuration = new Trend("get_games_duration",   true);
const getByIdDuration  = new Trend("get_by_id_duration",   true);
const postDuration     = new Trend("post_game_duration",   true);
const putDuration      = new Trend("put_game_duration",    true);
const totalRequests    = new Counter("total_requests");

// ─── Configuración de escenarios ─────────────────────────────────────────
export const options = {
  scenarios: {
    // ── Escenario 1: Lecturas intensivas ──────────────────────────────
    lecturas_intensivas: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m",   target: 100 }, // Ramp-up gradual a 100 VUs
        { duration: "3m",   target: 100 }, // Carga sostenida
        { duration: "30s",  target: 0   }, // Ramp-down
      ],
      gracefulRampDown: "30s",
    },

    // ── Escenario 2: CRUD mixto ───────────────────────────────────────
    crud_mixto: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 50  },
        { duration: "4m",  target: 100 },
        { duration: "30s", target: 0   },
      ],
      gracefulRampDown: "30s",
      // Inicia después del escenario 1 (4m30s + 30s de buffer)
      startTime: "5m",
    },
  },

  // ── Umbrales de aceptación ──────────────────────────────────────────
  thresholds: {
    // Tasa de error < 5%
    "error_rate":              ["rate<0.05"],
    // P95 de todas las solicitudes HTTP < 2000 ms
    "http_req_duration":       ["p(95)<2000"],
    // P95 por tipo de endpoint
    "get_games_duration":      ["p(95)<1500"],
    "get_by_id_duration":      ["p(95)<800"],
    "post_game_duration":      ["p(95)<1200"],
    // Solicitudes fallidas < 5%
    "http_req_failed":         ["rate<0.05"],
  },
};

// ─── Configuración base ───────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

const HEADERS = {
  "Content-Type": "application/json",
  "Accept":       "application/json",
};

// Géneros y plataformas para generación de datos aleatorios
const GENEROS    = ["Acción","Aventura","RPG","Estrategia","Deportes","Simulación","Terror","Puzzle"];
const PLATAFORMAS = ["PC","PlayStation 5","Xbox Series X","Nintendo Switch","Mobile"];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPrice() {
  return parseFloat((Math.random() * 79 + 0.99).toFixed(2));
}

function randomDate() {
  const start = new Date(2000, 0, 1).getTime();
  const end   = new Date(2024, 11, 31).getTime();
  return new Date(start + Math.random() * (end - start))
    .toISOString()
    .split("T")[0];
}

function randomGameBody() {
  const adjectives = ["Shadow","Cyber","Dark","Neon","Steel","Fire","Iron","Gold","Crystal","Star"];
  const nouns      = ["Quest","Legend","Warriors","Odyssey","Saga","Empire","Knights","Hunters"];
  return {
    nombre:            `${randomItem(adjectives)} ${randomItem(nouns)}`,
    genero:            randomItem(GENEROS),
    plataforma:        randomItem(PLATAFORMAS),
    fecha_lanzamiento: randomDate(),
    precio:            randomPrice(),
  };
}

// ─── Función principal (VU script) ────────────────────────────────────────
export default function () {
  const scenario = __ENV.SCENARIO_NAME || "lecturas_intensivas";

  if (scenario === "crud_mixto") {
    runCrudMixto();
  } else {
    runLecturasIntensivas();
  }
}

// ─── Escenario 1: Lecturas intensivas ────────────────────────────────────
function runLecturasIntensivas() {
  const rand = Math.random();

  group("Escenario 1 — Lecturas Intensivas", () => {
    if (rand < 0.70) {
      // 70% → GET /games (paginado)
      group("GET /games", () => {
        const page  = Math.floor(Math.random() * 10) + 1;
        const limit = randomItem([10, 20, 50]);
        const res   = http.get(
          `${BASE_URL}/games?page=${page}&limit=${limit}`,
          { headers: HEADERS }
        );
        totalRequests.add(1);
        getGamesDuration.add(res.timings.duration);

        const ok = check(res, {
          "GET /games → status 200": (r) => r.status === 200,
          "GET /games → tiene data":  (r) => {
            try { return Array.isArray(JSON.parse(r.body).data); }
            catch { return false; }
          },
        });
        errorRate.add(!ok);
      });

    } else if (rand < 0.90) {
      // 20% → GET /games/:id
      group("GET /games/:id", () => {
        const id  = Math.floor(Math.random() * 950) + 1;
        const res = http.get(`${BASE_URL}/games/${id}`, { headers: HEADERS });
        totalRequests.add(1);
        getByIdDuration.add(res.timings.duration);

        const ok = check(res, {
          "GET /games/:id → status 200 o 404": (r) => [200, 404].includes(r.status),
        });
        errorRate.add(!ok);
      });

    } else {
      // 10% → POST /games
      group("POST /games", () => {
        const res = http.post(
          `${BASE_URL}/games`,
          JSON.stringify(randomGameBody()),
          { headers: HEADERS }
        );
        totalRequests.add(1);
        postDuration.add(res.timings.duration);

        const ok = check(res, {
          "POST /games → status 201": (r) => r.status === 201,
        });
        errorRate.add(!ok);
      });
    }
  });

  sleep(Math.random() * 0.5 + 0.1); // Pausa 0.1–0.6 s entre iteraciones
}

// ─── Escenario 2: CRUD mixto ─────────────────────────────────────────────
function runCrudMixto() {
  const rand = Math.random();

  group("Escenario 2 — CRUD Mixto", () => {
    if (rand < 0.50) {
      // 50% → GET /games
      const page  = Math.floor(Math.random() * 5) + 1;
      const res   = http.get(`${BASE_URL}/games?page=${page}&limit=20`, { headers: HEADERS });
      totalRequests.add(1);
      getGamesDuration.add(res.timings.duration);
      const ok = check(res, { "GET /games → 200": (r) => r.status === 200 });
      errorRate.add(!ok);

    } else if (rand < 0.70) {
      // 20% → GET /games/:id
      const id  = Math.floor(Math.random() * 950) + 1;
      const res = http.get(`${BASE_URL}/games/${id}`, { headers: HEADERS });
      totalRequests.add(1);
      getByIdDuration.add(res.timings.duration);
      const ok = check(res, { "GET /games/:id → 200 o 404": (r) => [200, 404].includes(r.status) });
      errorRate.add(!ok);

    } else if (rand < 0.85) {
      // 15% → POST /games
      const res = http.post(
        `${BASE_URL}/games`,
        JSON.stringify(randomGameBody()),
        { headers: HEADERS }
      );
      totalRequests.add(1);
      postDuration.add(res.timings.duration);
      const ok = check(res, { "POST /games → 201": (r) => r.status === 201 });
      errorRate.add(!ok);

    } else {
      // 15% → PUT /games/:id
      const id  = Math.floor(Math.random() * 950) + 1;
      const body = { precio: randomPrice(), genero: randomItem(GENEROS) };
      const res = http.put(
        `${BASE_URL}/games/${id}`,
        JSON.stringify(body),
        { headers: HEADERS }
      );
      totalRequests.add(1);
      putDuration.add(res.timings.duration);
      const ok = check(res, { "PUT /games/:id → 200 o 404": (r) => [200, 404].includes(r.status) });
      errorRate.add(!ok);
    }
  });

  sleep(Math.random() * 0.3 + 0.1);
}
