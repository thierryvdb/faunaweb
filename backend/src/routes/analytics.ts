import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../services/db';
import { gerarFinanceiroDataset } from '../services/financeiro';

const periodoSchema = z.object({
  airportId: z.coerce.number().optional(),
  inicio: z.string().optional(),
  fim: z.string().optional()
});

function periodosComDefaults(filtros: { inicio?: string; fim?: string }) {
  const hoje = new Date();
  return {
    inicio: filtros.inicio ?? new Date(hoje.getFullYear(), 0, 1).toISOString().slice(0, 10),
    fim: filtros.fim ?? new Date(hoje.getFullYear(), 11, 31).toISOString().slice(0, 10)
  };
}

export async function analyticsRoutes(app: FastifyInstance) {
  app.get('/api/analytics/painel-resumo', async (request) => {
    const filtros = periodoSchema.parse(request.query ?? {});
    const { inicio, fim } = periodosComDefaults(filtros);
    const userAirportId = (request as any).user?.airport_id as number | undefined;
    const airportId = filtros.airportId ?? userAirportId ?? null;
    const { rows } = await db.query(
      `WITH params AS (
         SELECT $1::date AS ini,
                $2::date AS fim,
                GREATEST(($2::date - $1::date + 1), 1) AS dias,
                $3::bigint AS airport_id
       ),
       mov AS (
         SELECT COUNT(*) AS registros,
                SUM(COALESCE(m.movements_in_day, 1)) AS movimentos
         FROM wildlife.fact_movement m, params p
         WHERE m.date_utc BETWEEN p.ini AND p.fim
           AND (p.airport_id IS NULL OR m.airport_id = p.airport_id)
       ),
       sightings AS (
         SELECT COUNT(*) AS registros,
                SUM(COALESCE(s.effort_hours, 0)) AS horas
         FROM wildlife.fact_sighting s, params p
         WHERE s.date_utc BETWEEN p.ini AND p.fim
           AND (p.airport_id IS NULL OR s.airport_id = p.airport_id)
       ),
       sighting_items AS (
         SELECT COUNT(*) AS itens
         FROM wildlife.fact_sighting_item si
         JOIN wildlife.fact_sighting s ON s.sighting_id = si.sighting_id
         JOIN params p ON s.date_utc BETWEEN p.ini AND p.fim
         WHERE p.airport_id IS NULL OR s.airport_id = p.airport_id
       ),
       strikes AS (
         SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE damage_id IS NOT NULL) AS com_dano,
                COUNT(*) FILTER (WHERE species_id IS NOT NULL) AS identificadas
         FROM wildlife.fact_strike s, params p
         WHERE s.date_utc BETWEEN p.ini AND p.fim
           AND (p.airport_id IS NULL OR s.airport_id = p.airport_id)
       ),
       strike_mass AS (
         SELECT SUM(sp.mass_grams * COALESCE(s.quantity, 1)) AS massa_total
         FROM wildlife.fact_strike s
         JOIN wildlife.dim_species sp ON sp.species_id = s.species_id
         JOIN params p ON s.date_utc BETWEEN p.ini AND p.fim
         WHERE p.airport_id IS NULL OR s.airport_id = p.airport_id
       ),
       actions AS (
         SELECT COUNT(*) AS total,
                AVG(efficacy_percent) AS eficacia_media,
                AVG(duration_min) AS duracao_media,
                COUNT(*) FILTER (WHERE COALESCE(lethal_control, false)) AS letais
         FROM wildlife.fact_control_action a, params p
         WHERE a.date_utc BETWEEN p.ini AND p.fim
           AND (p.airport_id IS NULL OR a.airport_id = p.airport_id)
       ),
       atrativos AS (
         SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'ativo') AS ativos,
                COUNT(*) FILTER (WHERE status = 'mitigando') AS mitigando,
                COUNT(*) FILTER (WHERE status = 'resolvido') AS resolvidos
         FROM wildlife.fact_attractor a, params p
         WHERE a.date_utc BETWEEN p.ini AND p.fim
           AND (p.airport_id IS NULL OR a.airport_id = p.airport_id)
       ),
       inspec AS (
         SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE inspection_type = 'site') AS site,
                COUNT(*) FILTER (WHERE inspection_type = 'asa') AS asa
         FROM wildlife.fact_inspection i, params p
         WHERE i.date_utc BETWEEN p.ini AND p.fim
           AND (p.airport_id IS NULL OR i.airport_id = p.airport_id)
       ),
       carc AS (
         SELECT COUNT(*) AS total
         FROM wildlife.fact_carcass c, params p
         WHERE c.date_utc BETWEEN p.ini AND p.fim
           AND (p.airport_id IS NULL OR c.airport_id = p.airport_id)
       ),
       audits AS (
         SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'pendente') AS pendente,
                COUNT(*) FILTER (WHERE status = 'em_execucao') AS em_execucao,
                COUNT(*) FILTER (WHERE status = 'resolvido') AS resolvido
         FROM wildlife.fact_environment_audit ea, params p
         WHERE ea.date_utc BETWEEN p.ini AND p.fim
           AND (p.airport_id IS NULL OR ea.airport_id = p.airport_id)
       ),
       focos AS (
         SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'monitorado') AS monitorado,
                COUNT(*) FILTER (WHERE status = 'em_gestao') AS em_gestao,
                COUNT(*) FILTER (WHERE status = 'mitigado') AS mitigado
         FROM wildlife.fact_asa_focus f, params p
         WHERE COALESCE(f.notified_at, f.created_at::date) BETWEEN p.ini AND p.fim
           AND (p.airport_id IS NULL OR f.airport_id = p.airport_id)
       ),
       notices AS (
         SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status <> 'encerrado') AS em_aberto,
                COUNT(*) FILTER (WHERE status = 'encerrado') AS encerrados
         FROM wildlife.fact_external_notice n, params p
         WHERE COALESCE(n.sent_at, n.created_at::date) BETWEEN p.ini AND p.fim
           AND (p.airport_id IS NULL OR n.airport_id = p.airport_id)
       ),
       trainings AS (
         SELECT COUNT(*) AS total,
                SUM(COALESCE(hours_total, 0)) AS horas
         FROM wildlife.fact_training_session t, params p
         WHERE t.start_date BETWEEN p.ini AND p.fim
           AND (p.airport_id IS NULL OR t.airport_id = p.airport_id)
       ),
       training_comp AS (
         SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'valido') AS validos,
                COUNT(*) FILTER (WHERE status = 'expirado') AS expirados,
                COUNT(*) FILTER (WHERE status = 'pendente') AS pendentes
         FROM wildlife.fact_training_completion c
         LEFT JOIN wildlife.dim_personnel dp ON dp.personnel_id = c.personnel_id
         JOIN params p ON TRUE
         WHERE c.completion_date BETWEEN p.ini AND p.fim
           AND (p.airport_id IS NULL OR dp.airport_id = p.airport_id)
       )
       SELECT
         json_build_object(
           'registros', COALESCE(mov.registros, 0),
           'movimentos', COALESCE(mov.movimentos, 0),
           'media_diaria',
             CASE
               WHEN mov.movimentos IS NOT NULL AND mov.movimentos > 0
                 THEN ROUND(mov.movimentos::numeric / p.dias, 2)::double precision
               ELSE NULL
             END
         ) AS movimentos,
         json_build_object(
           'registros', COALESCE(sightings.registros, 0),
           'itens', COALESCE(sighting_items.itens, 0),
           'horas', COALESCE(sightings.horas, 0),
           'tah',
             CASE
               WHEN sightings.horas IS NOT NULL AND sightings.horas > 0 AND sighting_items.itens IS NOT NULL
                 THEN ROUND(sighting_items.itens::numeric / NULLIF(sightings.horas, 0), 2)::double precision
               ELSE NULL
             END
         ) AS avistamentos,
         json_build_object(
           'total', COALESCE(strikes.total, 0),
           'com_dano', COALESCE(strikes.com_dano, 0),
           'pct_dano',
             CASE
               WHEN strikes.total > 0
                 THEN ROUND((strikes.com_dano::numeric / strikes.total) * 100, 1)::double precision
               ELSE NULL
             END,
           'sr10k',
             CASE
               WHEN mov.movimentos IS NOT NULL AND mov.movimentos > 0
                 THEN ROUND((strikes.total::numeric / mov.movimentos) * 10000, 2)::double precision
               ELSE NULL
             END,
           'pct_identificadas',
             CASE
               WHEN strikes.total > 0
                 THEN ROUND((strikes.identificadas::numeric / strikes.total) * 100, 1)::double precision
               ELSE NULL
             END,
           'massa_total_kg',
             CASE
               WHEN strike_mass.massa_total IS NOT NULL
                 THEN ROUND(strike_mass.massa_total / 1000, 1)::double precision
               ELSE NULL
             END
         ) AS colisoes,
         json_build_object(
           'total', COALESCE(actions.total, 0),
           'letais', COALESCE(actions.letais, 0),
           'eficacia_media',
             CASE
               WHEN actions.eficacia_media IS NOT NULL
                 THEN ROUND(actions.eficacia_media, 1)::double precision
               ELSE NULL
             END,
           'duracao_media_min',
             CASE
               WHEN actions.duracao_media IS NOT NULL
                 THEN ROUND(actions.duracao_media, 1)::double precision
               ELSE NULL
             END
         ) AS acoes,
         json_build_object(
           'total', COALESCE(atrativos.total, 0),
           'ativos', COALESCE(atrativos.ativos, 0),
           'mitigando', COALESCE(atrativos.mitigando, 0),
           'resolvidos', COALESCE(atrativos.resolvidos, 0)
         ) AS atrativos,
         json_build_object(
           'total', COALESCE(inspec.total, 0),
           'site', COALESCE(inspec.site, 0),
           'asa', COALESCE(inspec.asa, 0)
         ) AS inspecoes,
         json_build_object(
           'carcacas', COALESCE(carc.total, 0),
           'auditorias', json_build_object(
             'total', COALESCE(audits.total, 0),
             'em_aberto', COALESCE(audits.pendente, 0) + COALESCE(audits.em_execucao, 0),
             'resolvidas', COALESCE(audits.resolvido, 0)
           ),
           'focosAsa', json_build_object(
             'total', COALESCE(focos.total, 0),
             'monitorado', COALESCE(focos.monitorado, 0),
             'gestao', COALESCE(focos.em_gestao, 0),
             'mitigado', COALESCE(focos.mitigado, 0)
           ),
           'comunicados', json_build_object(
             'total', COALESCE(notices.total, 0),
             'em_aberto', COALESCE(notices.em_aberto, 0),
             'encerrados', COALESCE(notices.encerrados, 0)
           ),
           'treinamentos', json_build_object(
             'eventos', COALESCE(trainings.total, 0),
             'horas',
               CASE
                 WHEN trainings.horas IS NOT NULL
                   THEN ROUND(trainings.horas, 1)::double precision
                 ELSE 0
               END,
             'participantes', COALESCE(training_comp.total, 0),
             'validos', COALESCE(training_comp.validos, 0)
           )
         ) AS governanca
       FROM params p
       LEFT JOIN mov ON TRUE
       LEFT JOIN sightings ON TRUE
       LEFT JOIN sighting_items ON TRUE
       LEFT JOIN strikes ON TRUE
       LEFT JOIN strike_mass ON TRUE
       LEFT JOIN actions ON TRUE
       LEFT JOIN atrativos ON TRUE
       LEFT JOIN inspec ON TRUE
       LEFT JOIN carc ON TRUE
       LEFT JOIN audits ON TRUE
       LEFT JOIN focos ON TRUE
       LEFT JOIN notices ON TRUE
       LEFT JOIN trainings ON TRUE
       LEFT JOIN training_comp ON TRUE`,
      [inicio, fim, airportId]
    );
    return {
      periodo: { inicio, fim },
      ...(rows[0] ?? {})
    };
  });

  app.get('/api/analytics/financeiro', async (request) => {
    const filtros = periodoSchema.parse(request.query ?? {});
    const { inicio, fim } = periodosComDefaults(filtros);
    const dataset = await gerarFinanceiroDataset({
      airportId: filtros.airportId ?? null,
      inicio,
      fim
    });
    return { periodo: { inicio, fim }, ...dataset };
  });

  app.get('/api/analytics/incidentes', async (request) => {
    const filtros = periodoSchema.parse(request.query ?? {});
    const { inicio, fim } = periodosComDefaults(filtros);
    const params = [filtros.airportId ?? null, inicio, fim];

    const [porAno, porCategoria, porIncidente, porDano, porFase, porEspecie] = await Promise.all([
      db.query(
        `SELECT date_part('year', date_utc)::int AS ano,
                COUNT(*)::bigint AS eventos,
                COUNT(*) FILTER (WHERE damage_id IS NOT NULL)::bigint AS com_dano
         FROM wildlife.fact_strike
         WHERE date_utc BETWEEN $2 AND $3 AND ($1::bigint IS NULL OR airport_id=$1)
         GROUP BY ano
         ORDER BY ano DESC`,
        params
      ),
      db.query(
        `SELECT COALESCE(tg.name, 'Nao classificado') AS categoria,
                COUNT(*)::bigint AS eventos
         FROM wildlife.fact_strike s
         LEFT JOIN wildlife.dim_species sp ON sp.species_id = s.species_id
         LEFT JOIN wildlife.lu_taxon_group tg ON tg.group_id = sp.group_id
         WHERE s.date_utc BETWEEN $2 AND $3 AND ($1::bigint IS NULL OR s.airport_id=$1)
         GROUP BY categoria
         ORDER BY eventos DESC`,
        params
      ),
      db.query(
        `SELECT COALESCE(event_type,'desconhecido') AS tipo_incidente,
                COUNT(*)::bigint AS eventos
         FROM wildlife.fact_strike
         WHERE date_utc BETWEEN $2 AND $3 AND ($1::bigint IS NULL OR airport_id=$1)
         GROUP BY tipo_incidente
         ORDER BY eventos DESC`,
        params
      ),
      db.query(
        `SELECT COALESCE(dc.name, 'Sem dano') AS dano,
                COUNT(*)::bigint AS eventos
         FROM wildlife.fact_strike s
         LEFT JOIN wildlife.lu_damage_class dc ON dc.damage_id = s.damage_id
         WHERE s.date_utc BETWEEN $2 AND $3 AND ($1::bigint IS NULL OR s.airport_id=$1)
         GROUP BY dano
         ORDER BY eventos DESC`,
        params
      ),
      db.query(
        `SELECT COALESCE(pf.name, 'Nao informado') AS fase_voo,
                COUNT(*)::bigint AS eventos
         FROM wildlife.fact_strike s
         LEFT JOIN wildlife.lu_phase_of_flight pf ON pf.phase_id = s.phase_id
         WHERE s.date_utc BETWEEN $2 AND $3 AND ($1::bigint IS NULL OR s.airport_id=$1)
         GROUP BY fase_voo
         ORDER BY eventos DESC`,
        params
      ),
      db.query(
        `SELECT COALESCE(sp.common_name, 'Nao identificada') AS especie,
                COUNT(*)::bigint AS eventos
         FROM wildlife.fact_strike s
         LEFT JOIN wildlife.dim_species sp ON sp.species_id = s.species_id
         WHERE s.date_utc BETWEEN $2 AND $3 AND ($1::bigint IS NULL OR s.airport_id=$1)
         GROUP BY especie
         ORDER BY eventos DESC
         LIMIT 20`,
        params
      )
    ]);

    return {
      periodo: { inicio, fim },
      porAno: porAno.rows,
      porCategoria: porCategoria.rows,
      porIncidente: porIncidente.rows,
      porDano: porDano.rows,
      porFase: porFase.rows,
      principaisEspecies: porEspecie.rows
    };
  });
}
