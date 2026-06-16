-- ============================================================
-- init.sql — Creación de la tabla games
-- ============================================================

CREATE TABLE IF NOT EXISTS games (
    id               SERIAL PRIMARY KEY,
    nombre           VARCHAR(255)    NOT NULL,
    genero           VARCHAR(100)    NOT NULL,
    plataforma       VARCHAR(100)    NOT NULL,
    fecha_lanzamiento DATE           NOT NULL,
    precio           DECIMAL(10, 2)  NOT NULL,
    created_at       TIMESTAMP       DEFAULT NOW(),
    updated_at       TIMESTAMP       DEFAULT NOW()
);

-- Índices para mejorar el rendimiento en consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_games_genero     ON games(genero);
CREATE INDEX IF NOT EXISTS idx_games_plataforma ON games(plataforma);
CREATE INDEX IF NOT EXISTS idx_games_precio     ON games(precio);
