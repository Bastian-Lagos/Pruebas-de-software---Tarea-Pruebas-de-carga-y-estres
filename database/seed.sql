-- ============================================================
-- seed.sql — Inserción de ~1000 juegos de prueba
-- ============================================================

INSERT INTO games (nombre, genero, plataforma, fecha_lanzamiento, precio)
SELECT
    -- Nombre generado combinando prefijos y sufijos
    (ARRAY[
        'Shadow','Cyber','Dark','Neon','Steel','Fire','Ice','Storm','Iron','Gold',
        'Silver','Crystal','Void','Star','Moon','Sun','Blade','Thunder','Frost','Ember',
        'Titan','Omega','Alpha','Nova','Ghost','Phantom','Crimson','Azure','Emerald','Obsidian'
    ])[floor(random()*30)+1]
    || ' ' ||
    (ARRAY[
        'Quest','Legend','Chronicles','Warriors','Odyssey','Realm','Saga','Empire',
        'Knights','Hunters','Rising','Fallen','Origins','Reborn','Unleashed','Evolution',
        'Revolution','Conquest','Uprising','Redemption','Ascension','Descent','Awakening',
        'Legacy','Prophecy','Dominion','Frontiers','Horizons','Nexus','Protocol'
    ])[floor(random()*30)+1]
    || ' ' ||
    (ARRAY[
        'I','II','III','IV','V','VI','','','','',
        '','','','','','','','','',''
    ])[floor(random()*20)+1],

    -- Género
    (ARRAY[
        'Acción','Aventura','RPG','Estrategia','Deportes','Simulación',
        'Terror','Puzzle','Plataformas','Lucha','Carreras','Shooter',
        'MMORPG','Battle Royale','Sandbox','Survival','Indie','Casual'
    ])[floor(random()*18)+1],

    -- Plataforma
    (ARRAY[
        'PC','PlayStation 5','PlayStation 4','Xbox Series X','Xbox One',
        'Nintendo Switch','Mobile','PlayStation 3','Xbox 360','Mac'
    ])[floor(random()*10)+1],

    -- Fecha de lanzamiento (entre 2000 y 2024)
    DATE '2000-01-01' + floor(random() * 8766)::int,

    -- Precio entre 0.99 y 79.99
    ROUND((random() * 79 + 0.99)::numeric, 2)

FROM generate_series(1, 1000);
