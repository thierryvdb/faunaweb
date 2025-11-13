import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../services/db';

const itemSchema = z.object({
  species_id: z.coerce.number(),
  quantity: z.coerce.number().min(1),
  behavior: z.string().optional(),
  id_confidence: z.enum(['Alta', 'Media', 'Baixa']).optional()
});

const corpo = z.object({
  airport_id: z.coerce.number(),
  date_utc: z.string(),
  time_local: z.string(),
  time_period_id: z.coerce.number().optional(),
  event_type: z.literal('avistamento').optional(),
  location_id: z.coerce.number(),
  latitude_dec: z.number().optional(),
  longitude_dec: z.number().optional(),
  quadrant: z.string().optional(),
  fauna_height_agl_m: z.coerce.number().min(0).optional(),
  inside_aerodrome: z.boolean().optional(),
  detection_method: z.coerce.number().optional(),
  effort_hours: z.coerce.number().min(0).optional(),
  effort_km: z.coerce.number().min(0).optional(),
  effort_area_ha: z.coerce.number().min(0).optional(),
  precip_id: z.coerce.number().optional(),
  wind_id: z.coerce.number().optional(),
  vis_id: z.coerce.number().optional(),
  photo_url: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().url().optional()),
  confidence_overall: z.string().optional(),
  observer_team: z.string().optional(),
  risk_mgmt_notes: z.string().optional(),
  related_attractor_id: z.coerce.number().optional(),
  actions_taken: z.string().optional(),
  reported_by_user_id: z.coerce.number().optional(),
  reporter_name: z.string().optional(),
  reporter_contact: z.string().optional(),
  notes: z.string().optional(),
  itens: z.array(itemSchema).optional()
});

const paramsId = z.object({ id: z.coerce.number() });

export async function sightingsRoutes(app: FastifyInstance) {
  app.get('/api/avistamentos', async (request) => {
    const querySchema = z.object({
      airportId: z.coerce.number().optional(),
      inicio: z.string().optional(),
      fim: z.string().optional(),
      locationId: z.coerce.number().optional(),
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
    if (filtros.locationId) {
      condicoes.push(`s.location_id=$${condicoes.length + 1}`);
      valores.push(filtros.locationId);
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
      `SELECT s.sighting_id AS id, s.airport_id, s.date_utc, s.time_local, s.time_period_id, s.event_type, s.location_id,
              COALESCE(l.code, CONCAT('ID ', s.location_id::text)) AS location_nome,
              s.latitude_dec, s.longitude_dec, s.quadrant, s.fauna_height_agl_m, s.inside_aerodrome,
              s.detection_method, s.effort_hours, s.effort_km, s.effort_area_ha, s.precip_id, s.wind_id, s.vis_id,
              s.photo_url, s.confidence_overall, s.observer_team, s.risk_mgmt_notes, s.related_attractor_id, fa.description AS related_attractor_desc, s.actions_taken,
              s.reported_by_user_id, s.reporter_name, s.reporter_contact, s.notes,
               COALESCE((
                 SELECT json_agg(json_build_object(
                   'sighting_item_id', si.sighting_item_id,
                   'species_id', si.species_id,
                   'quantity', si.quantity,
                   'behavior', si.behavior,
                   'id_confidence', si.id_confidence
                 ) ORDER BY si.sighting_item_id)
                 FROM wildlife.fact_sighting_item si
                 WHERE si.sighting_id = s.sighting_id
               ), '[]'::json) AS itens
       FROM wildlife.fact_sighting s
       LEFT JOIN wildlife.dim_location l ON l.location_id = s.location_id
       LEFT JOIN wildlife.fact_attractor fa ON fa.attractor_id = s.related_attractor_id
       ${where}
       ORDER BY s.date_utc DESC, s.time_local DESC
       LIMIT $${valores.length - 1} OFFSET $${valores.length}`,
      valores
    );
    return rows.map((row) => ({ ...row, itens: row.itens ?? [] }));
  });

  app.post('/api/avistamentos', async (request, reply) => {
    const body = corpo.parse(request.body);
    const resultado = await db.transaction(async (client) => {
      const insercao = await client.query(
        `INSERT INTO wildlife.fact_sighting (
          airport_id, date_utc, time_local, time_period_id, event_type,
          location_id, latitude_dec, longitude_dec, quadrant, fauna_height_agl_m, inside_aerodrome,
          detection_method, effort_hours, effort_km, effort_area_ha, precip_id, wind_id, vis_id, photo_url, confidence_overall,
          observer_team, risk_mgmt_notes, related_attractor_id, actions_taken,
          reported_by_user_id, reporter_name, reporter_contact, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
          RETURNING sighting_id AS id`,
        [
          body.airport_id,
          body.date_utc,
          body.time_local,
          body.time_period_id ?? null,
          body.event_type ?? 'avistamento',
          body.location_id,
          body.latitude_dec ?? null,
          body.longitude_dec ?? null,
          body.quadrant ?? null,
          body.fauna_height_agl_m ?? null,
          body.inside_aerodrome ?? null,
          body.detection_method ?? null,
          body.effort_hours ?? null,
          body.effort_km ?? null,
          body.effort_area_ha ?? null,
          body.precip_id ?? null,
          body.wind_id ?? null,
          body.vis_id ?? null,
          body.photo_url && (body.photo_url as string).trim() !== '' ? body.photo_url : null,
          body.confidence_overall ?? null,
          body.observer_team ?? null,
          body.risk_mgmt_notes ?? null,
          body.related_attractor_id ?? null,
          body.actions_taken ?? null,
          body.reported_by_user_id ?? null,
          body.reporter_name ?? null,
          body.reporter_contact ?? null,
          body.notes ?? null
        ]
      );
      const sightingId = insercao.rows[0].id;
      if (body.itens?.length) {
        for (const item of body.itens) {
          await client.query(
            `INSERT INTO wildlife.fact_sighting_item (sighting_id, species_id, quantity, behavior, id_confidence)
             VALUES ($1,$2,$3,$4,$5)`,
            [sightingId, item.species_id, item.quantity, item.behavior ?? null, item.id_confidence ?? null]
          );
        }
      }
      return sightingId;
    });

    return reply.code(201).send({ id: resultado });
  });

  app.put('/api/avistamentos/:id', async (request, reply) => {
    const { id } = paramsId.parse(request.params);
    const body = corpo.partial().parse(request.body ?? {});
    const pares = Object.entries(body).filter(([chave, valor]) => chave !== 'itens' && valor !== undefined);
    const atualizado = await db.transaction(async (client) => {
      if (pares.length) {
        const sets = pares.map(([campo], idx) => `${campo}=$${idx + 1}`);
        const valores = pares.map(([, valor]) => valor);
        valores.push(id);
        const { rowCount } = await client.query(
          `UPDATE wildlife.fact_sighting SET ${sets.join(', ')}, updated_at=now() WHERE sighting_id=$${pares.length + 1}`,
          valores
        );
        if (!rowCount) {
          return null;
        }
      }
      if (body.itens) {
        await client.query('DELETE FROM wildlife.fact_sighting_item WHERE sighting_id=$1', [id]);
        for (const item of body.itens) {
          await client.query(
            `INSERT INTO wildlife.fact_sighting_item (sighting_id, species_id, quantity, behavior, id_confidence)
             VALUES ($1,$2,$3,$4,$5)`,
            [id, item.species_id, item.quantity, item.behavior ?? null, item.id_confidence ?? null]
          );
        }
      }
      return id;
    });

    if (!atualizado) {
      return reply.code(404).send({ mensagem: 'Avistamento nao encontrado' });
    }
    return { id };
  });

  app.delete('/api/avistamentos/:id', async (request, reply) => {
    const { id } = paramsId.parse(request.params);
    await db.query('DELETE FROM wildlife.fact_sighting WHERE sighting_id=$1', [id]);
    return reply.code(204).send();
  });
}
