# Game Performance Project

Sistema de gestión de juegos con pruebas de carga y estrés usando **Grafana k6**.

## Autores
Billy Martinez ─ Bastian Lagos

Asignatura: ICC735-1 Pruebas de software

Tarea: Implementación de pruebas de Carga y Estrés sobre un Sistema de Gestión de Juegos

## Arquitectura

```
Usuarios Virtuales (k6)
         ↓
    API REST (Express.js) :3000
         ↓
  node-postgres (pg) — Pool de 20 conexiones
         ↓
    PostgreSQL 17 :5432
         ↓
   Tabla: games (~1000 registros)
```

Todo orquestado con **Docker Compose**.

---

## Estructura del proyecto

```
game-performance-project/
├── api/
│   ├── controllers/
│   │   └── gamesController.js   # Lógica CRUD
│   ├── routes/
│   │   └── games.js             # Rutas + validaciones express-validator
│   ├── database/
│   │   └── db.js                # Pool de conexiones PostgreSQL
│   ├── app.js                   # Configuración Express (middlewares, rutas, errores)
│   ├── server.js                # Punto de entrada (verifica BD antes de arrancar)
│   ├── package.json
│   └── Dockerfile
├── database/
│   ├── init.sql                 # Creación de tabla + índices
│   └── seed.sql                 # Inserción de 1000 juegos aleatorios
├── k6/
│   ├── carga.js                 # Prueba de carga (2 escenarios)
│   ├── estres.js                # Prueba de estrés (100→500 VUs)
│   └── resultados/              # JSON de salida de k6
├── docker-compose.yml
└── README.md
```

---

## Requisitos previos

| Herramienta    | Versión mínima |
|----------------|----------------|
| Docker         | 24+            |
| Docker Compose | 2.20+          |
| k6             | 0.50+          |

### Instalar k6

```bash
# macOS
brew install k6

# Ubuntu/Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
     --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Windows (winget)
winget install k6 --source winget
```

---

## Levantar el sistema

```bash
# 1. Clonar / ubicarse en la carpeta del proyecto
cd game-performance-project

# 2. Construir imágenes y levantar servicios
docker compose up --build -d

# 3. Verificar que ambos servicios estén saludables
docker compose ps

# 4. Probar el health check de la API
curl http://localhost:3000/health
```

---

## Endpoints disponibles

| Método   | Ruta             | Descripción                          |
|----------|------------------|--------------------------------------|
| `GET`    | `/health`        | Estado del servidor                  |
| `GET`    | `/games`         | Listar juegos (paginado)             |
| `GET`    | `/games/:id`     | Obtener un juego por ID              |
| `POST`   | `/games`         | Crear un juego                       |
| `PUT`    | `/games/:id`     | Actualizar un juego                  |
| `DELETE` | `/games/:id`     | Eliminar un juego                    |

### Paginación y filtros (GET /games)

```
GET /games?page=1&limit=20&genero=RPG&plataforma=PC
```

### Ejemplo — Crear un juego (POST /games)

```json
{
  "nombre": "Cyber Quest II",
  "genero": "RPG",
  "plataforma": "PC",
  "fecha_lanzamiento": "2023-11-15",
  "precio": 49.99
}
```

---

## Pruebas funcionales

Importar la colección en Postman / Insomnia / Bruno con estos casos:

| Caso                      | Método   | URL                       | Body                        | Esperado |
|---------------------------|----------|---------------------------|-----------------------------|----------|
| Listar juegos             | GET      | /games                    | —                           | 200      |
| Listar con paginación     | GET      | /games?page=2&limit=10    | —                           | 200      |
| Obtener existente         | GET      | /games/1                  | —                           | 200      |
| Obtener inexistente       | GET      | /games/999999             | —                           | 404      |
| Crear válido              | POST     | /games                    | JSON completo               | 201      |
| Crear inválido (precio -) | POST     | /games                    | precio: -5                  | 400      |
| Crear inválido (sin nombre)| POST    | /games                    | sin campo nombre            | 400      |
| Actualizar existente      | PUT      | /games/1                  | { "precio": 29.99 }         | 200      |
| Actualizar inexistente    | PUT      | /games/999999             | { "precio": 29.99 }         | 404      |
| Eliminar existente        | DELETE   | /games/5                  | —                           | 204      |
| Eliminar inexistente      | DELETE   | /games/999999             | —                           | 404      |
| ID no numérico            | GET      | /games/abc                | —                           | 400      |

---

## Ejecutar pruebas de carga

```bash
# Prueba de carga — resultado en consola
k6 run k6/carga.js

# Exportar resultados a JSON
k6 run --out json=k6/resultados/carga.json k6/carga.js

# Cambiar URL base (si la API está en otro host)
k6 run -e BASE_URL=http://192.168.1.100:3000 k6/carga.js
```

### Escenarios de carga

**Escenario 1 — Lecturas intensivas** (100 VUs, ~4m30s)

| Operación         | Distribución |
|-------------------|-------------|
| GET /games        | 70%         |
| GET /games/:id    | 20%         |
| POST /games       | 10%         |

**Escenario 2 — CRUD mixto** (100 VUs, ~5m)

| Operación         | Distribución |
|-------------------|-------------|
| GET /games        | 50%         |
| GET /games/:id    | 20%         |
| POST /games       | 15%         |
| PUT /games/:id    | 15%         |

---

## Ejecutar pruebas de estrés

```bash
# Prueba de estrés — resultado en consola
k6 run k6/estres.js

# Exportar resultados a JSON
k6 run --out json=k6/resultados/estres.json k6/estres.js
```

### Etapas de estrés

| Etapa | VUs  | Duración |
|-------|------|----------|
| 0     | 50   | 30s (calentamiento) |
| 1     | 100  | 1m       |
| 2     | 200  | 1m       |
| 3     | 300  | 1m       |
| 4     | 400  | 1m       |
| 5     | 500  | 1m (punto de ruptura) |

---

## Umbrales definidos

| Métrica                        | Umbral carga | Umbral estrés |
|-------------------------------|-------------|---------------|
| `http_req_failed`             | < 5%        | < 5%          |
| `http_req_duration` p(95)     | < 2000 ms   | < 3000 ms     |
| `get_games_duration` p(95)    | < 1500 ms   | —             |
| `get_by_id_duration` p(95)    | < 800 ms    | —             |
| `post_game_duration` p(95)    | < 1200 ms   | —             |

---

## Detener el sistema

```bash
docker compose down          # Detiene contenedores
docker compose down -v       # Detiene y elimina volúmenes (borra datos BD)
```

---

## Variables de entorno (API)

| Variable      | Valor por defecto | Descripción                     |
|---------------|-------------------|---------------------------------|
| `NODE_ENV`    | `development`     | Entorno de ejecución            |
| `PORT`        | `3000`            | Puerto del servidor HTTP        |
| `DB_HOST`     | `localhost`       | Host de PostgreSQL              |
| `DB_PORT`     | `5432`            | Puerto de PostgreSQL            |
| `DB_USER`     | `postgres`        | Usuario de PostgreSQL           |
| `DB_PASSWORD` | `postgres123`     | Contraseña de PostgreSQL        |
| `DB_NAME`     | `gamesdb`         | Nombre de la base de datos      |