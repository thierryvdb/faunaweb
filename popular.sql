SET search_path TO wildlife, public;

-- Airports used across the sample scenarios
INSERT INTO airport (icao_code, iata_code, name, city, state, country, latitude_dec, longitude_dec, elevation_ft)
VALUES
  ('SBFA', 'FA1', 'Aeroporto Falcao Azul', 'Foz Azul', 'BA', 'Brasil', -16.427, -39.082, 200),
  ('SBLH', 'LH1', 'Aeroporto Lago Horizonte', 'Lagoa Linda', 'SP', 'Brasil', -22.431, -46.912, 2800),
  ('SBTU', 'TU1', 'Aeroporto Trilha do Urubu', 'Serra Alta', 'AM', 'Brasil', -3.123, -60.021, 250)
ON CONFLICT (icao_code)
DO UPDATE SET
  name = EXCLUDED.name,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  latitude_dec = EXCLUDED.latitude_dec,
  longitude_dec = EXCLUDED.longitude_dec;

-- Create 20 operational locations per airport (reused by the facts)
WITH target_airports AS (
  SELECT airport_id, icao_code FROM airport WHERE icao_code IN ('SBFA','SBLH','SBTU')
),
loc_data AS (
  SELECT
    a.airport_id,
    CONCAT('LOC-', a.icao_code, '-', LPAD(gs::text, 2, '0')) AS code,
    CONCAT('Area operacional ', gs, ' do aeroporto ', a.icao_code) AS description
  FROM target_airports a
  CROSS JOIN generate_series(1, 20) AS gs
)
INSERT INTO dim_location (airport_id, code, description)
SELECT d.airport_id, d.code, d.description
FROM loc_data d
WHERE NOT EXISTS (
  SELECT 1 FROM dim_location l WHERE l.code = d.code
);

-- Common species leveraged by sightings/strikes
INSERT INTO dim_species (common_name, scientific_name, group_id, notes)
VALUES
  ('Tiziu', 'Volatinia jacarina', 1, 'Passeriforme comum'),
  ('Quero-quero', 'Vanellus chilensis', 1, 'Especie territorial'),
  ('Carcara', 'Caracara plancus', 2, 'Rapineiro oportunista')
ON CONFLICT DO NOTHING;

-------------------------------------------------------------------------------
-- Movimentos operacionais: 30 por aeroporto (90 registros)
-------------------------------------------------------------------------------
WITH airports AS (
  SELECT airport_id FROM airport WHERE icao_code IN ('SBFA','SBLH','SBTU')
),
movimentos AS (
  SELECT
    a.airport_id,
    (DATE '2025-01-01' + (g % 120))::date AS data_ref,
    (TIME '05:30' + (g % 12) * INTERVAL '1 hour')::time AS hora_local,
    CASE WHEN g % 2 = 0 THEN 'Pouso' ELSE 'Decolagem' END AS tipo,
    CONCAT('RWY ', 9 + (g % 3)) AS runway,
    CONCAT('Emb-19', (g % 3) + 1) AS aircraft_type,
    NULL::smallint AS engine_type_id,
    (g % 40) + 5 AS quantidade
  FROM airports a
  CROSS JOIN generate_series(0, 29) AS g
)
INSERT INTO fact_movement (airport_id, date_utc, time_local, movement_type, runway, aircraft_type, engine_type_id, movements_in_day)
SELECT airport_id, data_ref, hora_local, tipo, runway, aircraft_type, engine_type_id, quantidade
FROM movimentos;

-------------------------------------------------------------------------------
-- Avistamentos: 30 registros em diferentes locais
-------------------------------------------------------------------------------
WITH loc_pool AS (
  SELECT l.location_id, l.airport_id
  FROM dim_location l
  WHERE l.code LIKE 'LOC-%'
),
avistamentos AS (
  SELECT
    lp.airport_id,
    lp.location_id,
    (DATE '2025-02-01' + (g % 60))::date AS data_ref,
    (TIME '06:15' + (g % 10) * INTERVAL '30 minutes')::time AS hora_local,
    -20 + (random() * 5) AS latitude,
    -45 + (random() * 5) AS longitude,
    CONCAT('Equipe ', (g % 6) + 1) AS equipe,
    CONCAT('Registro de patrulha #', g + 1) AS observacao
  FROM generate_series(0, 29) AS g
  JOIN LATERAL (
    SELECT location_id, airport_id
    FROM loc_pool
    ORDER BY random()
    LIMIT 1
  ) lp ON TRUE
)
INSERT INTO fact_sighting (
  airport_id,
  date_utc,
  time_local,
  location_id,
  latitude_dec,
  longitude_dec,
  observer_team,
  notes
)
SELECT airport_id, data_ref, hora_local, location_id, latitude, longitude, equipe, observacao
FROM avistamentos;

-------------------------------------------------------------------------------
-- Colisoes: 30 eventos com custos associados
-------------------------------------------------------------------------------
WITH loc_pool AS (
  SELECT l.location_id, l.airport_id FROM dim_location l WHERE l.code LIKE 'LOC-%'
),
species_ids AS (
  SELECT species_id FROM dim_species WHERE common_name IN ('Tiziu','Quero-quero','Carcara')
),
novas_colisoes AS (
  INSERT INTO fact_strike (
    airport_id,
    date_utc,
    time_local,
    location_id,
    event_type,
    latitude_dec,
    longitude_dec,
    species_id,
    quantity,
    near_miss,
    pilot_alerted,
    flight_delay,
    delay_minutes,
    notes
  )
  SELECT
    lp.airport_id,
    (DATE '2025-03-01' + g)::date,
    (TIME '07:00' + (g % 8) * INTERVAL '45 minutes')::time,
    lp.location_id,
    CASE g % 3 WHEN 0 THEN 'colisao_outro_animal' WHEN 1 THEN 'quase_colisao' ELSE 'colisao_ave' END,
    -20 + (random() * 5),
    -45 + (random() * 5),
    (SELECT species_id FROM species_ids ORDER BY random() LIMIT 1),
    (g % 5) + 1,
    (g % 4 = 0),
    (g % 3 = 0),
    (g % 2 = 0),
    CASE WHEN g % 2 = 0 THEN ((g % 15) + 5) ELSE NULL END,
    CONCAT('Colisao de teste #', g + 1)
  FROM generate_series(0, 29) AS g
  JOIN LATERAL (
    SELECT location_id, airport_id
    FROM loc_pool
    ORDER BY random()
    LIMIT 1
  ) lp ON TRUE
  RETURNING strike_id
)
INSERT INTO fact_strike_cost (strike_id, cost_type, amount_brl)
SELECT n.strike_id, c.tipo,
       CASE c.tipo
         WHEN 'direto' THEN 2500 + (n.strike_id % 400)
         WHEN 'indireto' THEN 900 + (n.strike_id % 200)
         ELSE 350 + (n.strike_id % 150)
       END
FROM novas_colisoes n
CROSS JOIN (VALUES ('direto'),('indireto'),('outros')) AS c(tipo);

-------------------------------------------------------------------------------
-- Acoes de controle: 30 registros
-------------------------------------------------------------------------------
WITH loc_pool AS (
  SELECT l.location_id, l.airport_id FROM dim_location l WHERE l.code LIKE 'LOC-%'
),
tipo_acao AS (
  SELECT action_type_id FROM lu_action_type ORDER BY action_type_id LIMIT 1
)
INSERT INTO fact_control_action (
  airport_id,
  date_utc,
  time_local,
  location_id,
  action_type_id,
  description,
  duration_min,
  result_notes
)
SELECT
  lp.airport_id,
  (DATE '2025-02-10' + g)::date,
  (TIME '09:00' + (g % 6) * INTERVAL '30 minutes')::time,
  lp.location_id,
  tipo_acao.action_type_id,
  CONCAT('Dispersao controlada #', g + 1),
  15 + (g % 20),
  'Acao executada conforme planejado'
FROM generate_series(0, 29) AS g
JOIN LATERAL (
  SELECT location_id, airport_id
  FROM dim_location
  WHERE code LIKE 'LOC-%'
  ORDER BY random()
  LIMIT 1
) lp ON TRUE
CROSS JOIN tipo_acao;

-------------------------------------------------------------------------------
-- Atrativos monitorados: 30 registros
-------------------------------------------------------------------------------
WITH aer AS (
  SELECT airport_id FROM airport WHERE icao_code IN ('SBFA','SBLH','SBTU')
),
tipo_atrativo AS (
  SELECT attractor_type_id FROM lu_attractor_type ORDER BY attractor_type_id LIMIT 1
)
INSERT INTO fact_attractor (
  airport_id,
  date_utc,
  latitude_dec,
  longitude_dec,
  attractor_type_id,
  description,
  distance_m_runway,
  status,
  responsible_org
)
SELECT
  a.airport_id,
  (DATE '2025-01-05' + g)::date,
  -20 + (random() * 5),
  -45 + (random() * 5),
  tipo_atrativo.attractor_type_id,
  CONCAT('Atrativo temporario #', g + 1),
  150 + (g % 200),
  CASE g % 3 WHEN 0 THEN 'ativo' WHEN 1 THEN 'mitigando' ELSE 'resolvido' END,
  'Concessionaria'
FROM aer a
CROSS JOIN generate_series(0, 29) AS g
CROSS JOIN tipo_atrativo;
