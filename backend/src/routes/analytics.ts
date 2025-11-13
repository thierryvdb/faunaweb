import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../services/db';

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
  app.get('/api/analytics/financeiro', async (request) => {
    const filtros = periodoSchema.parse(request.query ?? {});
    const { inicio, fim } = periodosComDefaults(filtros);
    const { rows } = await db.query(
      `WITH strikes AS (
         SELECT s.airport_id,
                date_part('year', s.date_utc)::int AS ano,
                COALESCE(tg.name, 'Nao classificado') AS categoria,
                COALESCE(s.event_type, 'desconhecido') AS tipo_incidente,
                COALESCE(dc.name, 'Sem dano') AS dano,
                s.severity_weight,
                COALESCE(cost.cost_direto, 0) AS custo_direto,
                COALESCE(cost.cost_indireto, 0) AS custo_indireto,
                COALESCE(cost.cost_outros, 0) +
                  CASE WHEN cost.has_cost THEN 0 ELSE COALESCE(s.cost_brl, 0) END AS custo_outros,
                CASE WHEN cost.has_cost THEN COALESCE(cost.cost_total, 0) ELSE COALESCE(s.cost_brl, 0) END AS custo_total
         FROM wildlife.fact_strike s
         LEFT JOIN wildlife.dim_species sp ON sp.species_id = s.species_id
         LEFT JOIN wildlife.lu_taxon_group tg ON tg.group_id = sp.group_id
         LEFT JOIN wildlife.lu_damage_class dc ON dc.damage_id = s.damage_id
         LEFT JOIN LATERAL (
            SELECT
              SUM(CASE WHEN cost_type = 'direto' THEN amount_brl ELSE 0 END) AS cost_direto,
              SUM(CASE WHEN cost_type = 'indireto' THEN amount_brl ELSE 0 END) AS cost_indireto,
              SUM(CASE WHEN cost_type NOT IN ('direto','indireto') THEN amount_brl ELSE 0 END) AS cost_outros,
              SUM(amount_brl) AS cost_total,
              COUNT(*) > 0 AS has_cost
            FROM wildlife.fact_strike_cost c
            WHERE c.strike_id = s.strike_id
         ) cost ON true
         WHERE s.date_utc BETWEEN $2 AND $3
           AND ($1::bigint IS NULL OR s.airport_id = $1)
       )
       SELECT ano,
              categoria,
              tipo_incidente,
              dano,
              COUNT(*)::bigint AS eventos,
              AVG(severity_weight)::numeric(10,2) AS severidade_media,
              SUM(custo_direto)::numeric(18,2)   AS custo_direto,
              SUM(custo_indireto)::numeric(18,2) AS custo_indireto,
              SUM(custo_outros)::numeric(18,2)   AS custo_outros,
              SUM(custo_total)::numeric(18,2)    AS custo_total
       FROM strikes
       GROUP BY ano, categoria, tipo_incidente, dano
       ORDER BY ano DESC, custo_total DESC`,
      [filtros.airportId ?? null, inicio, fim]
    );
    return { periodo: { inicio, fim }, dados: rows };
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
