import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../services/db';
import { requireRead, requireCreate, requireUpdate, requireDelete } from '../utils/auth';

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
  aerodrome_location_id: z.coerce.number().optional(),
  occurrence_phase_id: z.coerce.number().optional(),
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
  app.get('/api/avistamentos', { preHandler: [app.authenticate, requireRead] }, async (request) => {
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
              s.aerodrome_location_id,
              s.occurrence_phase_id,
              s.latitude_dec, s.longitude_dec, s.quadrant, s.fauna_height_agl_m, s.inside_aerodrome,
              s.detection_method, s.effort_hours, s.effort_km, s.effort_area_ha, s.precip_id, s.wind_id, s.vis_id,
              s.photo_url, s.confidence_overall, s.observer_team, s.risk_mgmt_notes, s.related_attractor_id, fa.description AS related_attractor_desc, s.actions_taken,
              s.reported_by_user_id, s.reporter_name, s.reporter_contact, s.notes,
              al.name AS aerodrome_location_label,
              op.name AS occurrence_phase_label,
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
       LEFT JOIN wildlife.lu_aerodrome_location al ON al.aerodrome_location_id = s.aerodrome_location_id
       LEFT JOIN wildlife.lu_occurrence_phase op ON op.occurrence_phase_id = s.occurrence_phase_id
       ${where}
       ORDER BY s.date_utc DESC, s.time_local DESC
       LIMIT $${valores.length - 1} OFFSET $${valores.length}`,
      valores
    );
    return rows.map((row) => ({ ...row, itens: row.itens ?? [] }));
  });

  app.post('/api/avistamentos', { preHandler: [app.authenticate, requireCreate] }, async (request, reply) => {
    const body = corpo.parse(request.body);
    const resultado = await db.transaction(async (client) => {
      const colunas = [
        'airport_id',
        'date_utc',
        'time_local',
        'time_period_id',
        'event_type',
        'location_id',
        'aerodrome_location_id',
        'occurrence_phase_id',
        'latitude_dec',
        'longitude_dec',
        'quadrant',
        'fauna_height_agl_m',
        'inside_aerodrome',
        'detection_method',
        'effort_hours',
        'effort_km',
        'effort_area_ha',
        'precip_id',
        'wind_id',
        'vis_id',
        'photo_url',
        'confidence_overall',
        'observer_team',
        'risk_mgmt_notes',
        'related_attractor_id',
        'actions_taken',
        'reported_by_user_id',
        'reporter_name',
        'reporter_contact',
        'notes'
      ] as const;

      const valoresMapa: Record<(typeof colunas)[number], any> = {
        airport_id: body.airport_id,
        date_utc: body.date_utc,
        time_local: body.time_local,
        time_period_id: body.time_period_id ?? null,
        event_type: body.event_type ?? 'avistamento',
        location_id: body.location_id,
        aerodrome_location_id: body.aerodrome_location_id ?? null,
        occurrence_phase_id: body.occurrence_phase_id ?? null,
        latitude_dec: body.latitude_dec ?? null,
        longitude_dec: body.longitude_dec ?? null,
        quadrant: body.quadrant ?? null,
        fauna_height_agl_m: body.fauna_height_agl_m ?? null,
        inside_aerodrome: body.inside_aerodrome ?? null,
        detection_method: body.detection_method ?? null,
        effort_hours: body.effort_hours ?? null,
        effort_km: body.effort_km ?? null,
        effort_area_ha: body.effort_area_ha ?? null,
        precip_id: body.precip_id ?? null,
        wind_id: body.wind_id ?? null,
        vis_id: body.vis_id ?? null,
        photo_url: body.photo_url && (body.photo_url as string).trim() !== '' ? body.photo_url : null,
        confidence_overall: body.confidence_overall ?? null,
        observer_team: body.observer_team ?? null,
        risk_mgmt_notes: body.risk_mgmt_notes ?? null,
        related_attractor_id: body.related_attractor_id ?? null,
        actions_taken: body.actions_taken ?? null,
        reported_by_user_id: body.reported_by_user_id ?? null,
        reporter_name: body.reporter_name ?? null,
        reporter_contact: body.reporter_contact ?? null,
        notes: body.notes ?? null
      };

      const placeholders = colunas.map((_, idx) => `$${idx + 1}`).join(',');
      const valores = colunas.map((coluna) => valoresMapa[coluna]);
      const insercao = await client.query(
        `INSERT INTO wildlife.fact_sighting (${colunas.join(', ')})
         VALUES (${placeholders})
         RETURNING sighting_id AS id`,
        valores
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

  app.put('/api/avistamentos/:id', { preHandler: [app.authenticate, requireUpdate] }, async (request, reply) => {
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

  app.delete('/api/avistamentos/:id', { preHandler: [app.authenticate, requireDelete] }, async (request, reply) => {
    const { id } = paramsId.parse(request.params);
    await db.query('DELETE FROM wildlife.fact_sighting WHERE sighting_id=$1', [id]);
    return reply.code(204).send();
  });
}
