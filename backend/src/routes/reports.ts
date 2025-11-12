import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../services/db';

const periodoSchema = z.object({
  airportId: z.coerce.number().optional(),
  inicio: z.string().optional(),
  fim: z.string().optional()
});

export async function reportsRoutes(app: FastifyInstance) {
  app.get('/api/relatorios/pareto-especies', async (request) => {
    const filtros = periodoSchema.parse(request.query ?? {});
    const { inicio, fim } = periodosComDefaults(filtros);
    const { rows } = await db.query(
      `SELECT s.airport_id, COALESCE(ds.common_name, 'Nao identificada') AS especie, COUNT(*)::bigint AS strikes
       FROM wildlife.fact_strike s
       LEFT JOIN wildlife.dim_species ds ON ds.species_id = s.species_id
       WHERE s.date_utc BETWEEN $2 AND $3 AND ($1::bigint IS NULL OR s.airport_id=$1)
       GROUP BY s.airport_id, especie
       ORDER BY strikes DESC`,
      [filtros.airportId ?? null, inicio, fim]
    );
    return { periodo: { inicio, fim }, dados: rows };
  });

  app.get('/api/relatorios/fases-voo', async (request) => {
    const filtros = periodoSchema.parse(request.query ?? {});
    const { inicio, fim } = periodosComDefaults(filtros);
    const { rows } = await db.query(
      `SELECT s.airport_id, pf.name AS fase_voo, COUNT(*)::bigint AS strikes
       FROM wildlife.fact_strike s
       LEFT JOIN wildlife.lu_phase_of_flight pf ON pf.phase_id = s.phase_id
       WHERE s.date_utc BETWEEN $2 AND $3 AND ($1::bigint IS NULL OR s.airport_id=$1)
       GROUP BY s.airport_id, pf.name
       ORDER BY strikes DESC`,
      [filtros.airportId ?? null, inicio, fim]
    );
    return { periodo: { inicio, fim }, dados: rows };
  });

  app.get('/api/relatorios/partes-dano', async (request) => {
    const filtros = periodoSchema.parse(request.query ?? {});
    const { inicio, fim } = periodosComDefaults(filtros);
    const { rows } = await db.query(
      `SELECT s.airport_id, ph.name AS parte,
              COUNT(*) FILTER (WHERE d.name IS DISTINCT FROM 'Sem dano')::bigint AS eventos_com_dano,
              COUNT(*)::bigint AS eventos_total
       FROM wildlife.fact_strike s
       LEFT JOIN wildlife.lu_part_hit ph ON ph.part_id = s.part_id
       LEFT JOIN wildlife.lu_damage_class d ON d.damage_id = s.damage_id
       WHERE s.date_utc BETWEEN $2 AND $3 AND ($1::bigint IS NULL OR s.airport_id=$1)
       GROUP BY s.airport_id, ph.name
       ORDER BY eventos_com_dano DESC NULLS LAST`,
      [filtros.airportId ?? null, inicio, fim]
    );
    return {
      periodo: { inicio, fim },
      dados: rows.map((row) => ({
        ...row,
        pct_com_dano: row.eventos_total > 0 ? Number((row.eventos_com_dano / row.eventos_total) * 100).toFixed(2) : null
      }))
    };
  });

  app.get('/api/relatorios/ba-janela', async (request) => {
    const filtros = z.object({ airportId: z.coerce.number().optional() }).parse(request.query ?? {});
    const { rows } = await db.query(
      `SELECT * FROM wildlife_kpi.kpi_ba_sr_tah WHERE $1::bigint IS NULL OR airport_id=$1 ORDER BY action_id DESC`,
      [filtros.airportId ?? null]
    );
    return { janela_padrao_dias: 30, dados: rows };
  });
}

function periodosComDefaults(filtros: { inicio?: string; fim?: string }) {
  const hoje = new Date();
  return {
    inicio: filtros.inicio ?? new Date(hoje.getFullYear(), 0, 1).toISOString().slice(0, 10),
    fim: filtros.fim ?? new Date(hoje.getFullYear(), 11, 31).toISOString().slice(0, 10)
  };
}
