import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../services/db';

const rangeSchema = z.object({
  inicio: z.string().optional(),
  fim: z.string().optional(),
  airportId: z.coerce.number().optional()
});

export async function kpisRoutes(app: FastifyInstance) {
  app.get('/kpis/resumo', async (request) => {
    const filtros = rangeSchema.parse(request.query ?? {});
    const agora = new Date();
    const inicioPadrao = new Date(agora.getFullYear(), 0, 1).toISOString().slice(0, 10);
    const fimPadrao = new Date(agora.getFullYear(), 11, 31).toISOString().slice(0, 10);
    const inicio = filtros.inicio ?? inicioPadrao;
    const fim = filtros.fim ?? fimPadrao;
    const userAirportId = (request as any).user?.airport_id as number | undefined;
    const selectedAirport = filtros.airportId ?? userAirportId ?? null;
    const { rows } = await db.query(
      `WITH periodo AS (
         SELECT $1::date AS ini, $2::date AS fim
       ),
       mov AS (
         SELECT airport_id, SUM(movements)::numeric AS movimentos
         FROM wildlife_kpi.v_movements_daily m, periodo p
         WHERE m.day BETWEEN p.ini AND p.fim
         GROUP BY airport_id
       ),
       str AS (
         SELECT airport_id,
                SUM(strikes)::numeric AS strikes,
                SUM(strikes_com_dano)::numeric AS strikes_com_dano,
                AVG(severidade_media_peso)::numeric AS severidade_media
         FROM wildlife_kpi.v_strikes_daily s, periodo p
         WHERE s.day BETWEEN p.ini AND p.fim
         GROUP BY airport_id
       ),
       effort AS (
         SELECT airport_id,
                SUM(avistamentos_itens)::numeric AS itens,
                SUM(horas_patrulha)::numeric AS horas
         FROM wildlife_kpi.v_sightings_effort_daily e, periodo p
         WHERE e.day BETWEEN p.ini AND p.fim
         GROUP BY airport_id
       ),
       mass AS (
         SELECT s.airport_id,
                SUM(sp.mass_grams * COALESCE(s.quantity, 1))::numeric AS massa_total,
                COUNT(*) FILTER (WHERE s.species_id IS NOT NULL) AS strikes_identificados,
                COUNT(*) AS strikes_total
         FROM wildlife.fact_strike s
         JOIN wildlife.dim_species sp ON sp.species_id = s.species_id
         JOIN periodo p ON s.date_utc BETWEEN p.ini AND p.fim
         GROUP BY s.airport_id
       )
       SELECT a.airport_id, a.icao_code, a.name,
              COALESCE(m.movimentos,0) AS movimentos,
              COALESCE(str.strikes,0) AS strikes,
              COALESCE(str.strikes_com_dano,0) AS strikes_com_dano,
              str.severidade_media,
              effort.itens, effort.horas,
              mass.massa_total, mass.strikes_identificados, mass.strikes_total
       FROM wildlife.airport a
       LEFT JOIN mov m ON m.airport_id = a.airport_id
       LEFT JOIN str ON str.airport_id = a.airport_id
       LEFT JOIN effort ON effort.airport_id = a.airport_id
       LEFT JOIN mass ON mass.airport_id = a.airport_id
       WHERE $3::bigint IS NULL OR a.airport_id = $3
       ORDER BY a.name`,
      [inicio, fim, selectedAirport]
    );

    const aeroportos = rows.map((row) => {
      const movimentos = Number(row.movimentos ?? 0);
      const strikes = Number(row.strikes ?? 0);
      const strikesComDano = Number(row.strikes_com_dano ?? 0);
      const massaTotal = row.massa_total ? Number(row.massa_total) : null;
      const horas = row.horas ? Number(row.horas) : null;
      const itens = row.itens ? Number(row.itens) : null;
      const strikesTotal = row.strikes_total ? Number(row.strikes_total) : null;
      const strikesIdent = row.strikes_identificados ? Number(row.strikes_identificados) : null;
      const sr10k = movimentos > 0 ? Number(((strikes ?? 0) / movimentos) * 10000) : null;
      const damageRate = movimentos > 0 ? Number(((strikesComDano ?? 0) / movimentos) * 10000) : null;
      const pctDano = strikes > 0 ? Number((strikesComDano / strikes) * 100) : null;
      const tah = horas && horas > 0 && itens !== null ? Number(itens / horas) : null;
      const pctIdent = strikesTotal && strikesTotal > 0 && strikesIdent !== null ? Number((strikesIdent / strikesTotal) * 100) : null;
      const mmPor1M = movimentos > 0 && massaTotal !== null ? Number((massaTotal / movimentos) * 1000000) : null;
      return {
        airport_id: row.airport_id,
        icao: row.icao_code,
        nome: row.name,
        movimentos,
        strikes,
        sr10k,
        damage_rate_10k: damageRate,
        pct_strikes_com_dano: pctDano,
        severidade_media: row.severidade_media ? Number(row.severidade_media) : null,
        tah_itens_por_hora: tah,
        pct_identificados: pctIdent,
        massa_total_grams: massaTotal,
        mm_real_por_1M: mmPor1M
      };
    });

    return { periodo: { inicio, fim }, aeroportos };
  });

  app.post('/kpis/did', async (request) => {
    const schema = z.object({
      action_id: z.coerce.number(),
      control_locations: z.array(z.coerce.number()).min(1),
      janela_dias: z.coerce.number().optional().default(30)
    });
    const body = schema.parse(request.body);
    const { rows } = await db.query(
      'SELECT * FROM wildlife_kpi.kpi_did_sr10k($1, $2::bigint[], $3)',
      [body.action_id, body.control_locations, body.janela_dias]
    );
    return rows[0] ?? null;
  });

  app.post('/kpis/ba-espacial', async (request) => {
    const schema = z.object({
      action_id: z.coerce.number(),
      raio_m: z.number().min(10),
      janela_dias: z.coerce.number().optional().default(30)
    });
    const body = schema.parse(request.body);
    const { rows } = await db.query(
  'SELECT * FROM wildlife_kpi.kpi_ba_spatial($1, $2, $3)',
  [body.action_id, body.raio_m, body.janela_dias]
  );
  return rows[0] ?? null;
  });

  app.get('/kpis/baist', async (request) => {
    const filtros = rangeSchema.parse(request.query ?? {});
    const agora = new Date();
    const inicioPadrao = new Date(agora.getFullYear(), 0, 1).toISOString().slice(0, 10);
    const fimPadrao = new Date(agora.getFullYear(), 11, 31).toISOString().slice(0, 10);
    const inicio = filtros.inicio ?? inicioPadrao;
    const fim = filtros.fim ?? fimPadrao;
    const userAirportId = (request as any).user?.airport_id as number | undefined;
    const selectedAirport = filtros.airportId ?? userAirportId ?? null;
    const { rows } = await db.query(
      'SELECT * FROM wildlife_kpi.fn_baist_indicadores($1,$2,$3)',
      [inicio, fim, selectedAirport]
    );
    return { periodo: { inicio, fim }, aeroportos: rows };
  });
}
