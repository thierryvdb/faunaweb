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
