import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { MultipartFile } from '@fastify/multipart';
import sharp from 'sharp';
import { db } from '../services/db';
import { requireRead, requireCreate, requireUpdate, requireDelete } from '../utils/auth';

const skyConditionValues = ['claro', 'poucas_nuvens', 'encoberto'] as const;
const precipConditionValues = ['nenhuma', 'nevoeiro', 'chuva', 'chuva_recente'] as const;

const corpo = z.object({
  airport_id: z.coerce.number(),
  date_utc: z.string(),
  time_local: z.string(),
  time_period_id: z.coerce.number().optional(),
  event_type: z.enum(['colisao_ave','colisao_outro_animal','quase_colisao']).optional(),
  location_id: z.coerce.number(),
  aerodrome_location_id: z.coerce.number().optional(),
  occurrence_phase_id: z.coerce.number().optional(),
  latitude_dec: z.number().nullable().optional(),
  longitude_dec: z.number().nullable().optional(),
  sky_condition: z.enum(skyConditionValues).optional(),
  precip_condition: z.enum(precipConditionValues).optional(),
  phase_id: z.coerce.number().optional(),
  species_id: z.coerce.number().optional(),
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
  aircraft_model_id: z.preprocess(
    (val) => (val === '' || val === undefined ? undefined : val),
    z.union([z.coerce.number().int().positive(), z.null()])
  ).optional(),
  engine_type_id: z.coerce.number().optional(),
  near_miss: z.boolean().optional(),
  pilot_alerted: z.boolean().optional(),
  est_mass_id: z.coerce.number().optional(),
  est_mass_grams: z.coerce.number().optional(),
  reported_by_user_id: z.coerce.number().optional(),
  reporter_name: z.string().optional(),
  reporter_contact: z.string().optional(),
  quadrant: z.string().optional(),
  operational_consequence: z.string().optional(),
  visible_damage_notes: z.string().optional(),
  investigated_by: z.string().optional(),
  carcass_found: z.boolean().optional(),
  actions_taken: z.string().optional(),
  inside_aerodrome: z.boolean().optional(),
  risk_mgmt_notes: z.string().optional(),
  related_attractor_id: z.coerce.number().optional(),
  photo_url: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().url().optional()),
  flight_delay: z.boolean().optional(),
  delay_minutes: z.coerce.number().min(0).optional(),
  custos: z
    .object({
      direto: z.coerce.number().min(0).nullable().optional(),
      indireto: z.coerce.number().min(0).nullable().optional(),
      outros: z.coerce.number().min(0).nullable().optional()
    })
    .optional(),
  source_ref: z.string().optional(),
  notes: z.string().optional()
});

const paramsId = z.object({ id: z.coerce.number() });

type FotoUpload = {
  buffer: Buffer;
  filename?: string;
  mimetype?: string;
};

type CustosPayload = {
  direto?: number | null;
  indireto?: number | null;
  outros?: number | null;
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
        basePayload = JSON.parse(part.value as string);
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

type CustoEntrada = { tipo: 'direto' | 'indireto' | 'outros'; valor: number };

function montarEntradasCustos(custos?: CustosPayload | null): CustoEntrada[] {
  if (!custos) return [];
  const entradas: CustoEntrada[] = [];
  const map: Array<['direto' | 'indireto' | 'outros', keyof CustosPayload]> = [
    ['direto', 'direto'],
    ['indireto', 'indireto'],
    ['outros', 'outros']
  ];
  for (const [tipo, chave] of map) {
    const bruto = custos[chave];
    if (bruto === null || bruto === undefined) continue;
    const valor = Number(bruto);
    if (!Number.isNaN(valor) && valor >= 0) {
      entradas.push({ tipo, valor });
    }
  }
  return entradas;
}

async function salvarCustos(client: any, strikeId: number, custos?: CustosPayload | null) {
  if (custos === undefined) {
    return;
  }
  await client.query('DELETE FROM wildlife.fact_strike_cost WHERE strike_id=$1', [strikeId]);
  if (!custos) {
    return;
  }
  const entradas = montarEntradasCustos(custos);
  for (const entrada of entradas) {
    await client.query(
      `INSERT INTO wildlife.fact_strike_cost (strike_id, cost_type, amount_brl) VALUES ($1,$2,$3)`,
      [strikeId, entrada.tipo, entrada.valor]
    );
  }
}

async function obterModeloAeronave(
  executor: { query: (sql: string, valores: any[]) => Promise<{ rows: any[] }> },
  id: number
) {
  const { rows } = await executor.query(
    `SELECT aircraft_model_id, manufacturer, model, engine_type_id
       FROM wildlife.lu_aircraft_model
      WHERE aircraft_model_id=$1`,
    [id]
  );
  return rows[0] ?? null;
}

function nomeModeloAeronave(modelo: { manufacturer: string; model: string }) {
  return `${modelo.manufacturer} ${modelo.model}`.trim();
}

function aplicarCampo(pares: Array<[string, any]>, campo: string, valor: any) {
  const idx = pares.findIndex(([c]) => c === campo);
  if (idx >= 0) {
    pares.splice(idx, 1);
  }
  pares.push([campo, valor]);
}

async function salvarFotos(client: any, strikeId: number, fotos: FotoUpload[], options?: { normalizadas?: boolean }) {
  if (!fotos.length) {
    await client.query('DELETE FROM wildlife.fact_strike_foto WHERE strike_id=$1', [strikeId]);
    return;
  }
  await client.query('DELETE FROM wildlife.fact_strike_foto WHERE strike_id=$1', [strikeId]);
  let processadas = fotos;
  if (!options?.normalizadas) {
    processadas = [];
    for (const foto of fotos) {
      processadas.push(await normalizarFoto(foto));
    }
  }
  const buffers = processadas.map((f) => f.buffer);
  const nomes = processadas.map((f) => f.filename ?? null);
  const mimes = processadas.map((f) => f.mimetype ?? null);
  await client.query(
    `INSERT INTO wildlife.fact_strike_foto (strike_id, foto_idx, photo_blob, photo_filename, photo_mime)
     SELECT $1, ord::int, foto, nome, mime
     FROM UNNEST($2::bytea[], $3::text[], $4::text[]) WITH ORDINALITY AS u(foto, nome, mime, ord)`,
    [strikeId, buffers, nomes, mimes]
  );
}

async function normalizarFoto(foto: FotoUpload): Promise<FotoUpload> {
  const mime = (foto.mimetype ?? '').toLowerCase();
  const targetWidth = 1920;
  try {
    const instance = sharp(foto.buffer);
    const metadata = await instance.metadata();
    if (metadata.width && metadata.width <= targetWidth) {
      return foto;
    }
    const buffer = await instance.resize({ width: targetWidth, withoutEnlargement: true }).png().toBuffer();
    return {
      buffer,
      filename: foto.filename,
      mimetype: 'image/png'
    };
  } catch {
    return foto;
  }
}

export async function strikesRoutes(app: FastifyInstance) {
  app.get('/api/colisoes', { preHandler: [app.authenticate, requireRead] }, async (request) => {
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
              s.aerodrome_location_id,
              s.occurrence_phase_id,
              s.latitude_dec, s.longitude_dec, s.sky_condition, s.precip_condition, s.phase_id, s.species_id,
              s.quantity, s.damage_id, s.ingestion, s.effect_id, s.part_id, s.time_out_hours,
              s.cost_brl, s.sample_collected, s.severity_weight,
              s.aircraft_registration, s.aircraft_type, s.aircraft_model_id, s.engine_type_id, s.near_miss, s.pilot_alerted,
              s.flight_delay, s.delay_minutes,
              s.est_mass_id, s.est_mass_grams,
              s.reported_by_user_id, s.reporter_name, s.reporter_contact,
              s.related_attractor_id, fa.description AS related_attractor_desc,
              s.quadrant, s.operational_consequence, s.visible_damage_notes,
              s.investigated_by, s.carcass_found, s.actions_taken, s.inside_aerodrome, s.risk_mgmt_notes, s.related_attractor_id,
              s.photo_url, s.photo_filename, s.photo_mime,
              (s.photo_blob IS NOT NULL OR fotos_extra.tem_foto) AS photo_upload_disponivel,
              cost.custo_direto, cost.custo_indireto, cost.custo_outros,
              am.manufacturer AS aircraft_model_manufacturer,
              am.model AS aircraft_model_model,
              am.category AS aircraft_model_category,
              am.engine_type_id AS aircraft_model_engine_type_id,
              am.wingspan_m AS aircraft_model_wingspan_m,
              am.length_m AS aircraft_model_length_m,
              am.height_m AS aircraft_model_height_m,
              am.seating_capacity AS aircraft_model_seating_capacity,
              am.mtow_kg AS aircraft_model_mtow_kg,
              s.source_ref, s.notes
       FROM wildlife.fact_strike s
       LEFT JOIN wildlife.dim_location l ON l.location_id = s.location_id
       LEFT JOIN wildlife.fact_attractor fa ON fa.attractor_id = s.related_attractor_id
       LEFT JOIN wildlife.lu_aircraft_model am ON am.aircraft_model_id = s.aircraft_model_id
       LEFT JOIN LATERAL (
         SELECT
           SUM(CASE WHEN cost_type = 'direto' THEN amount_brl ELSE 0 END)::numeric(14,2) AS custo_direto,
           SUM(CASE WHEN cost_type = 'indireto' THEN amount_brl ELSE 0 END)::numeric(14,2) AS custo_indireto,
           SUM(CASE WHEN cost_type NOT IN ('direto','indireto') THEN amount_brl ELSE 0 END)::numeric(14,2) AS custo_outros
         FROM wildlife.fact_strike_cost c
         WHERE c.strike_id = s.strike_id
       ) cost ON true
       LEFT JOIN LATERAL (
         SELECT TRUE AS tem_foto
         FROM wildlife.fact_strike_foto f
         WHERE f.strike_id = s.strike_id
         LIMIT 1
       ) fotos_extra ON true
       ${where}
       ORDER BY s.date_utc DESC, s.time_local DESC
       LIMIT $${valores.length - 1} OFFSET $${valores.length}`,
      valores
    );
    return rows;
  });

  app.post('/api/colisoes', { preHandler: [app.authenticate, requireCreate] }, async (request, reply) => {
    const { body, fotos } = await parseStrikePayload(request, corpo);
    const created = await db.transaction(async (client) => {
      const fotosNormalizadas = await Promise.all(fotos.map(normalizarFoto));
      const fotoPrincipal = fotosNormalizadas[0];
      const entradasCustos = montarEntradasCustos(body.custos);
      const somaCustos = entradasCustos.reduce((acc, entrada) => acc + entrada.valor, 0);
      const delayMinutes = body.flight_delay ? body.delay_minutes ?? null : null;

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
        'sky_condition',
        'precip_condition',
        'phase_id',
        'species_id',
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
        'aircraft_model_id',
        'engine_type_id',
        'near_miss',
        'pilot_alerted',
        'flight_delay',
        'delay_minutes',
        'est_mass_id',
        'est_mass_grams',
        'reported_by_user_id',
        'reporter_name',
        'reporter_contact',
        'quadrant',
        'operational_consequence',
        'visible_damage_notes',
        'investigated_by',
        'carcass_found',
        'actions_taken',
        'inside_aerodrome',
        'risk_mgmt_notes',
        'related_attractor_id',
        'photo_url',
        'photo_filename',
        'photo_mime',
        'photo_blob',
        'source_ref',
        'notes'
      ] as const;

      const photoUrlNormalizada = typeof body.photo_url === 'string' ? body.photo_url.trim() : '';
      let aircraftModelId = body.aircraft_model_id ?? null;
      let aircraftTypeNome = body.aircraft_type ?? null;
      let engineTypeIdFinal = body.engine_type_id ?? null;

      if (aircraftModelId) {
        const modelo = await obterModeloAeronave(client, aircraftModelId);
        if (!modelo) {
          throw request.server.httpErrors.badRequest('Aeronave selecionada nao encontrada');
        }
        aircraftModelId = Number(modelo.aircraft_model_id);
        aircraftTypeNome = nomeModeloAeronave(modelo);
        if (!engineTypeIdFinal && modelo.engine_type_id) {
          engineTypeIdFinal = modelo.engine_type_id;
        }
      }

      const valoresMapa: Record<(typeof colunas)[number], any> = {
        airport_id: body.airport_id,
        date_utc: body.date_utc,
        time_local: body.time_local,
        time_period_id: body.time_period_id ?? null,
        event_type: body.event_type ?? 'colisao_ave',
        location_id: body.location_id,
        aerodrome_location_id: body.aerodrome_location_id ?? null,
        occurrence_phase_id: body.occurrence_phase_id ?? null,
        latitude_dec: body.latitude_dec ?? null,
        longitude_dec: body.longitude_dec ?? null,
        sky_condition: body.sky_condition ?? null,
        precip_condition: body.precip_condition ?? null,
        phase_id: body.phase_id ?? null,
        species_id: body.species_id ?? null,
        quantity: body.quantity ?? null,
        damage_id: body.damage_id ?? null,
        ingestion: body.ingestion ?? null,
        effect_id: body.effect_id ?? null,
        part_id: body.part_id ?? null,
        time_out_hours: body.time_out_hours ?? null,
        cost_brl: somaCustos > 0 ? somaCustos : body.cost_brl ?? null,
        sample_collected: body.sample_collected ?? null,
        severity_weight: body.severity_weight ?? null,
        aircraft_registration: body.aircraft_registration ?? null,
        aircraft_type: aircraftTypeNome,
        aircraft_model_id: aircraftModelId,
        engine_type_id: engineTypeIdFinal ?? null,
        near_miss: body.near_miss ?? null,
        pilot_alerted: body.pilot_alerted ?? null,
        flight_delay: body.flight_delay ?? null,
        delay_minutes: delayMinutes,
        est_mass_id: body.est_mass_id ?? null,
        est_mass_grams: body.est_mass_grams ?? null,
        reported_by_user_id: body.reported_by_user_id ?? null,
        reporter_name: body.reporter_name ?? null,
        reporter_contact: body.reporter_contact ?? null,
        quadrant: body.quadrant ?? null,
        operational_consequence: body.operational_consequence ?? null,
        visible_damage_notes: body.visible_damage_notes ?? null,
        investigated_by: body.investigated_by ?? null,
        carcass_found: body.carcass_found ?? null,
        actions_taken: body.actions_taken ?? null,
        inside_aerodrome: body.inside_aerodrome ?? null,
        risk_mgmt_notes: body.risk_mgmt_notes ?? null,
        related_attractor_id: body.related_attractor_id ?? null,
        photo_url: fotoPrincipal ? null : photoUrlNormalizada || null,
        photo_filename: fotoPrincipal?.filename ?? null,
        photo_mime: fotoPrincipal?.mimetype ?? null,
        photo_blob: fotoPrincipal?.buffer ?? null,
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
      if (fotosNormalizadas.length) {
        await salvarFotos(client, id, fotosNormalizadas, { normalizadas: true });
      }
      await salvarCustos(client, id, body.custos ?? undefined);
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

  app.put('/api/colisoes/:id', { preHandler: [app.authenticate, requireUpdate] }, async (request, reply) => {
    const { id } = paramsId.parse(request.params);
    const { body, fotos } = await parseStrikePayload(request, corpo.partial(), { allowEmpty: true });
    const pares = Object.entries(body)
      .filter(([chave, valor]) => chave !== 'parts' && valor !== undefined && chave !== 'custos')
      .map(([campo, valor]) => {
        if (campo === 'photo_url' && typeof valor === 'string') {
          return [campo, valor.trim() || null];
        }
        return [campo, valor];
      }) as Array<[string, any]>;
    const fotosNormalizadas = await Promise.all(fotos.map(normalizarFoto));
    const fotoPrincipal = fotosNormalizadas[0];

    if (fotoPrincipal) {
      pares.push(['photo_url', null]);
      pares.push(['photo_filename', fotoPrincipal.filename ?? null]);
      pares.push(['photo_mime', fotoPrincipal.mimetype ?? null]);
      pares.push(['photo_blob', fotoPrincipal.buffer]);
    }

    if (body.custos !== undefined) {
      const entradas = montarEntradasCustos(body.custos);
      const soma = entradas.reduce((acc, entrada) => acc + entrada.valor, 0);
      pares.push(['cost_brl', soma > 0 ? soma : null]);
    }

    if (
      !pares.length &&
      !body.parts &&
      !fotosNormalizadas.length &&
      body.custos === undefined &&
      body.aircraft_model_id === undefined
    ) {
      return reply.code(400).send({ mensagem: 'Informe dados para atualizar' });
    }

    const atualizado = await db.transaction(async (client) => {
      const existente = await client.query('SELECT 1 FROM wildlife.fact_strike WHERE strike_id=$1 FOR UPDATE', [id]);
      if (!existente.rowCount) {
        return false;
      }

      if (body.aircraft_model_id !== undefined) {
        if (body.aircraft_model_id === null) {
          aplicarCampo(pares, 'aircraft_model_id', null);
        } else {
          const modelo = await obterModeloAeronave(client, body.aircraft_model_id);
          if (!modelo) {
            throw request.server.httpErrors.badRequest('Aeronave selecionada nao encontrada');
          }
          aplicarCampo(pares, 'aircraft_model_id', modelo.aircraft_model_id);
          aplicarCampo(pares, 'aircraft_type', nomeModeloAeronave(modelo));
          if (!pares.some(([campo]) => campo === 'engine_type_id') && modelo.engine_type_id) {
            aplicarCampo(pares, 'engine_type_id', modelo.engine_type_id);
          }
        }
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

      if (fotosNormalizadas.length) {
        await salvarFotos(client, id, fotosNormalizadas, { normalizadas: true });
        await client.query(`UPDATE wildlife.fact_strike SET photo_url=NULL, updated_at=now() WHERE strike_id=$1`, [id]);
      }

      if (body.custos !== undefined) {
        await salvarCustos(client, id, body.custos);
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

  app.delete('/api/colisoes/:id', { preHandler: [app.authenticate, requireDelete] }, async (request, reply) => {
    const { id } = paramsId.parse(request.params);
    await db.query('DELETE FROM wildlife.fact_strike WHERE strike_id=$1', [id]);
    return reply.code(204).send();
  });
}
