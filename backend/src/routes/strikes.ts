import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { MultipartFile } from '@fastify/multipart';
import { db } from '../services/db';

const fotoObjetoSchema = z.object({
  foto_id: z.coerce.number(),
  photo_url: z.string().url().nullable().optional()
});

const corpo = z.object({
  airport_id: z.coerce.number(),
  date_utc: z.string(),
  time_local: z.string(),
  time_period_id: z.coerce.number().optional(),
  event_type: z.enum(['colisao_ave','colisao_outro_animal','quase_colisao']).optional(),
  location_id: z.coerce.number(),
  latitude_dec: z.number().nullable().optional(),
  longitude_dec: z.number().nullable().optional(),
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
  fotos: z.array(fotoObjetoSchema).optional(),
  source_ref: z.string().optional(),
  notes: z.string().optional()
});

const paramsId = z.object({ id: z.coerce.number() });

type FotoUpload = {
  buffer: Buffer;
  filename?: string;
  mimetype?: string;
};

async function bufferFromPart(part: MultipartFile) {
  const chunks: Buffer[] = [];
  for await (const chunk of part.file) {
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
    } else {
      chunks.push(Buffer.from(chunk));
    }
  }
  return Buffer.concat(chunks);
}

async function parseStrikePayload<T extends z.ZodTypeAny>(
  request: FastifyRequest,
  schema: T,
  options?: { allowEmpty?: boolean }
): Promise<{ body: z.infer<T>; fotos: FotoUpload[] }> {
  if (!request.isMultipart()) {
    return { body: schema.parse(request.body ?? {}), fotos: [] };
  }
  const parts = request.parts();
  let basePayload: any = {};
  const fotos: FotoUpload[] = [];

  for await (const part of parts) {
    if (part.type === 'file') {
      if (part.fieldname === 'foto' || part.fieldname === 'fotos') {
        const buffer = await bufferFromPart(part);
        fotos.push({
          buffer,
          filename: part.filename ?? undefined,
          mimetype: part.mimetype ?? undefined
        });
      }
      continue;
    }
    if (part.fieldname === 'dados' || part.fieldname === 'payload') {
      try {
        basePayload = JSON.parse(part.value);
      } catch {
        throw request.server.httpErrors.badRequest('Campo "dados" deve conter JSON valido');
      }
    } else {
      basePayload[part.fieldname] = part.value;
    }
  }

  if (!Object.keys(basePayload).length && !options?.allowEmpty) {
    throw request.server.httpErrors.badRequest('Nenhum dado informado');
  }

  return { body: schema.parse(basePayload), fotos };
}

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
              s.photo_url, s.photo_filename, s.photo_mime, (s.photo_blob IS NOT NULL) AS photo_upload_disponivel,
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
    const { body, fotos } = await parseStrikePayload(request, corpo);
    const created = await db.transaction(async (client) => {
      const colunas = [
        'airport_id',
        'date_utc',
        'time_local',
        'time_period_id',
        'event_type',
        'location_id',
        'latitude_dec',
        'longitude_dec',
        'precip_id',
        'wind_id',
        'vis_id',
        'phase_id',
        'species_id',
        'id_confidence',
        'quantity',
        'damage_id',
        'ingestion',
        'effect_id',
        'part_id',
        'time_out_hours',
        'cost_brl',
        'sample_collected',
        'severity_weight',
        'aircraft_registration',
        'aircraft_type',
        'engine_type_id',
        'near_miss',
        'pilot_alerted',
        'est_mass_id',
        'est_mass_grams',
        'reported_by_user_id',
        'reporter_name',
        'reporter_contact',
        'quadrant',
        'impact_height_agl_m',
        'aircraft_speed_kt',
        'operational_consequence',
        'visible_damage_notes',
        'investigated_by',
        'carcass_found',
        'actions_taken',
        'inside_aerodrome',
        'risk_mgmt_notes',
        'related_attractor_id',
        'photo_url',
        'source_ref',
        'notes'
      ] as const;

      const photoUrlNormalizada = typeof body.photo_url === 'string' ? body.photo_url.trim() : '';

      const valoresMapa: Record<(typeof colunas)[number], any> = {
        airport_id: body.airport_id,
        date_utc: body.date_utc,
        time_local: body.time_local,
        time_period_id: body.time_period_id ?? null,
        event_type: body.event_type ?? 'colisao_ave',
        location_id: body.location_id,
        latitude_dec: body.latitude_dec ?? null,
        longitude_dec: body.longitude_dec ?? null,
        precip_id: body.precip_id ?? null,
        wind_id: body.wind_id ?? null,
        vis_id: body.vis_id ?? null,
        phase_id: body.phase_id ?? null,
        species_id: body.species_id ?? null,
        id_confidence: body.id_confidence ?? null,
        quantity: body.quantity ?? null,
        damage_id: body.damage_id ?? null,
        ingestion: body.ingestion ?? null,
        effect_id: body.effect_id ?? null,
        part_id: body.part_id ?? null,
        time_out_hours: body.time_out_hours ?? null,
        cost_brl: body.cost_brl ?? null,
        sample_collected: body.sample_collected ?? null,
        severity_weight: body.severity_weight ?? null,
        aircraft_registration: body.aircraft_registration ?? null,
        aircraft_type: body.aircraft_type ?? null,
        engine_type_id: body.engine_type_id ?? null,
        near_miss: body.near_miss ?? null,
        pilot_alerted: body.pilot_alerted ?? null,
        est_mass_id: body.est_mass_id ?? null,
        est_mass_grams: body.est_mass_grams ?? null,
        reported_by_user_id: body.reported_by_user_id ?? null,
        reporter_name: body.reporter_name ?? null,
        reporter_contact: body.reporter_contact ?? null,
        quadrant: body.quadrant ?? null,
        impact_height_agl_m: body.impact_height_agl_m ?? null,
        aircraft_speed_kt: body.aircraft_speed_kt ?? null,
        operational_consequence: body.operational_consequence ?? null,
        visible_damage_notes: body.visible_damage_notes ?? null,
        investigated_by: body.investigated_by ?? null,
        carcass_found: body.carcass_found ?? null,
        actions_taken: body.actions_taken ?? null,
        inside_aerodrome: body.inside_aerodrome ?? null,
        risk_mgmt_notes: body.risk_mgmt_notes ?? null,
        related_attractor_id: body.related_attractor_id ?? null,
        photo_url: foto ? null : photoUrlNormalizada || null,
        source_ref: body.source_ref ?? null,
        notes: body.notes ?? null
      };

      const placeholders = colunas.map((_, idx) => `$${idx + 1}`).join(',');
      const valores = colunas.map((coluna) => valoresMapa[coluna]);

      const { rows } = await client.query(
        `INSERT INTO wildlife.fact_strike (${colunas.join(', ')})
         VALUES (${placeholders})
         RETURNING strike_id AS id`,
        valores
      );
      const id = rows[0].id as number;
      if (fotos.length) {
        await client.query(
          `INSERT INTO wildlife.fact_strike_foto (strike_id, foto_idx, photo_blob, photo_filename, photo_mime)
           SELECT $1, idx, foto, nome, mime
           FROM UNNEST($2::bytea[], $3::text[], $4::text[]) AS t(foto, nome, mime) WITH ORDINALITY AS u(foto, nome, mime, idx)`,
          [
            id,
            fotos.map((f) => f.buffer),
            fotos.map((f) => f.filename ?? null),
            fotos.map((f) => f.mimetype ?? null)
          ]
        );
      }
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
    const { body, fotos } = await parseStrikePayload(request, corpo.partial(), { allowEmpty: true });
    const pares = Object.entries(body)
      .filter(([chave, valor]) => chave !== 'parts' && valor !== undefined)
      .map(([campo, valor]) => {
        if (campo === 'photo_url' && typeof valor === 'string') {
          return [campo, valor.trim() || null];
        }
        return [campo, valor];
      }) as Array<[string, any]>;

    if (!pares.length && !body.parts && !foto) {
      return reply.code(400).send({ mensagem: 'Informe dados para atualizar' });
    }

    const atualizado = await db.transaction(async (client) => {
      const existente = await client.query('SELECT 1 FROM wildlife.fact_strike WHERE strike_id=$1 FOR UPDATE', [id]);
      if (!existente.rowCount) {
        return false;
      }

      if (pares.length) {
        const sets = pares.map(([campo], idx) => `${campo}=$${idx + 1}`);
        const valores = pares.map(([, valor]) => valor);
        valores.push(id);
        await client.query(
          `UPDATE wildlife.fact_strike SET ${sets.join(', ')}, updated_at=now() WHERE strike_id=$${pares.length + 1}`,
          valores
        );
      }

      if (fotos.length) {
        await client.query('DELETE FROM wildlife.fact_strike_foto WHERE strike_id=$1', [id]);
        await client.query(
          `INSERT INTO wildlife.fact_strike_foto (strike_id, foto_idx, photo_blob, photo_filename, photo_mime)
           SELECT $1, idx, foto, nome, mime
           FROM UNNEST($2::bytea[], $3::text[], $4::text[]) AS t(foto, nome, mime) WITH ORDINALITY AS u(foto, nome, mime, idx)`,
          [
            id,
            fotos.map((f) => f.buffer),
            fotos.map((f) => f.filename ?? null),
            fotos.map((f) => f.mimetype ?? null)
          ]
        );
        await client.query(`UPDATE wildlife.fact_strike SET photo_url=NULL, updated_at=now() WHERE strike_id=$1`, [id]);
      }

      if (body.parts) {
        await client.query('DELETE FROM wildlife.fact_strike_part WHERE strike_id=$1', [id]);
        for (const p of body.parts) {
          await client.query(
            `INSERT INTO wildlife.fact_strike_part (strike_id, part_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [id, p]
          );
        }
      }

      return true;
    });

    if (!atualizado) {
      return reply.code(404).send({ mensagem: 'Colisao nao encontrada' });
    }
    return { id };
  });

  app.delete('/api/colisoes/:id', async (request, reply) => {
    const { id } = paramsId.parse(request.params);
    await db.query('DELETE FROM wildlife.fact_strike WHERE strike_id=$1', [id]);
    return reply.code(204).send();
  });
}
