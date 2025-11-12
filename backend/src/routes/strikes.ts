import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../services/db';

const corpo = z.object({
  airport_id: z.coerce.number(),
  date_utc: z.string(),
  time_local: z.string(),
  time_period_id: z.coerce.number().optional(),
  event_type: z.enum(['colisao_ave','colisao_outro_animal','quase_colisao']).optional(),
  location_id: z.coerce.number(),
  latitude_dec: z.number().optional(),
  longitude_dec: z.number().optional(),
  precip_id: z.coerce.number().optional(),
  wind_id: z.coerce.number().optional(),
  vis_id: z.coerce.number().optional(),
  phase_id: z.coerce.number().optional(),
  species_id: z.coerce.number().optional(),
  id_confidence: z.enum(['Alta', 'Media', 'Baixa', 'Nao_identificada']).optional(),
  quantity: z.coerce.number().min(1).optional(),
  damage_id: z.coerce.number().optional(),
  ingestion: z.boolean().optional(),
  effect_id: z.coerce.number().optional(),
  part_id: z.coerce.number().optional(),
  parts: z.array(z.coerce.number()).optional(),
  time_out_hours: z.coerce.number().min(0).optional(),
  cost_brl: z.coerce.number().min(0).optional(),
  sample_collected: z.boolean().optional(),
  severity_weight: z.coerce.number().optional(),
  aircraft_registration: z.string().optional(),
  aircraft_type: z.string().optional(),
  engine_type_id: z.coerce.number().optional(),
  near_miss: z.boolean().optional(),
  pilot_alerted: z.boolean().optional(),
  est_mass_id: z.coerce.number().optional(),
  est_mass_grams: z.coerce.number().optional(),
  reported_by_user_id: z.coerce.number().optional(),
  reporter_name: z.string().optional(),
  reporter_contact: z.string().optional(),
  quadrant: z.string().optional(),
  impact_height_agl_m: z.coerce.number().min(0).optional(),
  aircraft_speed_kt: z.coerce.number().min(0).optional(),
  operational_consequence: z.string().optional(),
  visible_damage_notes: z.string().optional(),
  investigated_by: z.string().optional(),
  carcass_found: z.boolean().optional(),
  actions_taken: z.string().optional(),
  inside_aerodrome: z.boolean().optional(),
  risk_mgmt_notes: z.string().optional(),
  related_attractor_id: z.coerce.number().optional(),
  photo_url: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().url().optional()),
  source_ref: z.string().optional(),
  notes: z.string().optional()
});

const paramsId = z.object({ id: z.coerce.number() });

export async function strikesRoutes(app: FastifyInstance) {
  app.get('/api/colisoes', async (request) => {
    const querySchema = z.object({
      airportId: z.coerce.number().optional(),
      inicio: z.string().optional(),
      fim: z.string().optional(),
      fase: z.coerce.number().optional(),
      pagina: z.coerce.number().optional().default(1),
      limite: z.coerce.number().optional().default(50)
    });
    const filtros = querySchema.parse(request.query ?? {});
    const condicoes: string[] = [];
    const valores: any[] = [];
    if (filtros.airportId) {
      condicoes.push(`s.airport_id=$${condicoes.length + 1}`);
      valores.push(filtros.airportId);
    }
    if (filtros.fase) {
      condicoes.push(`s.phase_id=$${condicoes.length + 1}`);
      valores.push(filtros.fase);
    }
    if (filtros.inicio) {
      condicoes.push(`s.date_utc >= $${condicoes.length + 1}`);
      valores.push(filtros.inicio);
    }
    if (filtros.fim) {
      condicoes.push(`s.date_utc <= $${condicoes.length + 1}`);
      valores.push(filtros.fim);
    }
    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    const offset = (filtros.pagina - 1) * filtros.limite;
    valores.push(filtros.limite, offset);
    const { rows } = await db.query(
      `SELECT s.strike_id AS id, s.airport_id, s.date_utc, s.time_local, s.time_period_id, s.event_type, s.location_id,
              COALESCE(l.code, CONCAT('ID ', s.location_id::text)) AS location_nome,
              s.latitude_dec, s.longitude_dec, s.precip_id, s.wind_id, s.vis_id, s.phase_id, s.species_id,
              s.id_confidence, s.quantity, s.damage_id, s.ingestion, s.effect_id, s.part_id, s.time_out_hours,
              s.cost_brl, s.sample_collected, s.severity_weight,
              s.aircraft_registration, s.aircraft_type, s.engine_type_id, s.near_miss, s.pilot_alerted,
              s.est_mass_id, s.est_mass_grams,
              s.reported_by_user_id, s.reporter_name, s.reporter_contact,
              s.related_attractor_id, fa.description AS related_attractor_desc,
              s.quadrant, s.impact_height_agl_m, s.aircraft_speed_kt, s.operational_consequence, s.visible_damage_notes,
              s.investigated_by, s.carcass_found, s.actions_taken, s.inside_aerodrome, s.risk_mgmt_notes, s.related_attractor_id,
              s.photo_url,
              s.source_ref, s.notes
       FROM wildlife.fact_strike s
       LEFT JOIN wildlife.dim_location l ON l.location_id = s.location_id
       LEFT JOIN wildlife.fact_attractor fa ON fa.attractor_id = s.related_attractor_id
       ${where}
       ORDER BY s.date_utc DESC, s.time_local DESC
       LIMIT $${valores.length - 1} OFFSET $${valores.length}`,
      valores
    );
    return rows;
  });

  app.post('/api/colisoes', async (request, reply) => {
    const body = corpo.parse(request.body);
    const created = await db.transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO wildlife.fact_strike (
          airport_id, date_utc, time_local, time_period_id, event_type,
          location_id, latitude_dec, longitude_dec,
          precip_id, wind_id, vis_id,
          phase_id, species_id, id_confidence, quantity, damage_id, ingestion, effect_id, part_id,
          time_out_hours, cost_brl, sample_collected, severity_weight,
          aircraft_registration, aircraft_type, engine_type_id,
          near_miss, pilot_alerted,
          est_mass_id, est_mass_grams,
          reported_by_user_id, reporter_name, reporter_contact,
          quadrant, impact_height_agl_m, aircraft_speed_kt, operational_consequence, visible_damage_notes,
          investigated_by, carcass_found, actions_taken, inside_aerodrome, risk_mgmt_notes, related_attractor_id,
          photo_url,
          source_ref, notes
        ) VALUES (
          $1,$2,$3,$4,$5,
          $6,$7,$8,
          $9,$10,$11,
          $12,$13,$14,$15,$16,$17,$18,$19,
          $20,$21,$22,$23,
          $24,$25,$26,
          $27,$28,
          $29,$30,
          $31,$32,$33,
          $34,$35,$36,$37,$38,$39,$40,$41,$42,
          $43,
          $44,$45
        ) RETURNING strike_id AS id` ,
        [
          body.airport_id,
          body.date_utc,
          body.time_local,
          body.time_period_id ?? null,
          body.event_type ?? 'colisao_ave',
          body.location_id,
          body.latitude_dec ?? null,
          body.longitude_dec ?? null,
          body.precip_id ?? null,
          body.wind_id ?? null,
          body.vis_id ?? null,
          body.phase_id ?? null,
          body.species_id ?? null,
          body.id_confidence ?? null,
          body.quantity ?? null,
          body.damage_id ?? null,
          body.ingestion ?? null,
          body.effect_id ?? null,
          body.part_id ?? null,
          body.time_out_hours ?? null,
          body.cost_brl ?? null,
          body.sample_collected ?? null,
          body.severity_weight ?? null,
          body.aircraft_registration ?? null,
          body.aircraft_type ?? null,
          body.engine_type_id ?? null,
          body.near_miss ?? null,
          body.pilot_alerted ?? null,
          body.est_mass_id ?? null,
          body.est_mass_grams ?? null,
          body.reported_by_user_id ?? null,
          body.reporter_name ?? null,
          body.reporter_contact ?? null,
          body.quadrant ?? null,
          body.impact_height_agl_m ?? null,
          body.aircraft_speed_kt ?? null,
          body.operational_consequence ?? null,
          body.visible_damage_notes ?? null,
          body.investigated_by ?? null,
          body.carcass_found ?? null,
          body.actions_taken ?? null,
          body.inside_aerodrome ?? null,
          body.risk_mgmt_notes ?? null,
          body.related_attractor_id ?? null,
          body.photo_url && (body.photo_url as string).trim() !== '' ? body.photo_url : null,
          body.source_ref ?? null,
          body.notes ?? null
        ]
      );
      const id = rows[0].id as number;
      if (body.parts?.length) {
        for (const p of body.parts) {
          await client.query(
            `INSERT INTO wildlife.fact_strike_part (strike_id, part_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [id, p]
          );
        }
      }
      return id;
    });
    return reply.code(201).send({ id: created });
  });

  app.put('/api/colisoes/:id', async (request, reply) => {
    const { id } = paramsId.parse(request.params);
    const body = corpo.partial().parse(request.body ?? {});
    const pares = Object.entries(body).filter(([chave, valor]) => chave !== 'parts' && valor !== undefined);
    if (!pares.length) {
      return reply.code(400).send({ mensagem: 'Informe dados para atualizar' });
    }
    const sets = pares.map(([campo], idx) => `${campo}=$${idx + 1}`);
    const valores = pares.map(([, valor]) => valor);
    valores.push(id);
    const { rowCount } = await db.query(
      `UPDATE wildlife.fact_strike SET ${sets.join(', ')}, updated_at=now() WHERE strike_id=$${pares.length + 1}`,
      valores
    );
    if (!rowCount) {
      return reply.code(404).send({ mensagem: 'Colisao nao encontrada' });
    }
    if (body.parts) {
      await db.query('DELETE FROM wildlife.fact_strike_part WHERE strike_id=$1', [id]);
      for (const p of body.parts) {
        await db.query(
          `INSERT INTO wildlife.fact_strike_part (strike_id, part_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [id, p]
        );
      }
    }
    return { id };
  });

  app.delete('/api/colisoes/:id', async (request, reply) => {
    const { id } = paramsId.parse(request.params);
    await db.query('DELETE FROM wildlife.fact_strike WHERE strike_id=$1', [id]);
    return reply.code(204).send();
  });
}
