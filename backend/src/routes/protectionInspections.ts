import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../services/db';
import sharp from 'sharp';

// Schema de validação para inspeção de proteção (F4)
const protectionInspectionSchema = z.object({
  airport_id: z.coerce.number().int().positive(),
  inspection_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  season_id: z.coerce.number().int().positive().optional(),
  rained_last_24h: z.boolean().optional(),
  general_notes: z.string().optional(),
  reported_by_user_id: z.coerce.number().int().positive().optional(),
  reporter_name: z.string().optional(),

  // Fence occurrences
  fence_occurrences: z.array(z.object({
    location_text: z.string(),
    occurrence_types: z.array(z.coerce.number().int().positive()).optional(),
    repair_performed: z.boolean().optional(),
    repair_date: z.string().optional(),
    irregular_waste_present: z.boolean().optional(),
    waste_removed: z.boolean().optional(),
    notes: z.string().optional(),
  })).optional(),

  // Gate occurrences
  gate_occurrences: z.array(z.object({
    location_text: z.string(),
    occurrence_types: z.array(z.coerce.number().int().positive()).optional(),
    other_occurrence: z.string().optional(),
    repair_performed: z.boolean().optional(),
    repair_date: z.string().optional(),
    irregular_waste_present: z.boolean().optional(),
    waste_removed: z.boolean().optional(),
    notes: z.string().optional(),
  })).optional(),
});

export async function protectionInspectionsRoutes(app: FastifyInstance) {

  // GET /api/inspecoes-protecao - Listar inspeções de proteção (F4)
  app.get('/inspecoes-protecao', async (request, reply) => {
    const qs = request.query as any;
    const airportId = qs.airportId ? parseInt(qs.airportId) : undefined;
    const inicio = qs.inicio;
    const fim = qs.fim;
    const pagina = qs.pagina ? parseInt(qs.pagina) : 1;
    const limite = qs.limite ? parseInt(qs.limite) : 50;
    const offset = (pagina - 1) * limite;

    let whereClause = '';
    const params: any[] = [];
    let paramCount = 1;

    if (airportId) {
      whereClause += ` AND i.airport_id = $${paramCount}`;
      params.push(airportId);
      paramCount++;
    }
    if (inicio) {
      whereClause += ` AND i.inspection_date >= $${paramCount}`;
      params.push(inicio);
      paramCount++;
    }
    if (fim) {
      whereClause += ` AND i.inspection_date <= $${paramCount}`;
      params.push(fim);
      paramCount++;
    }

    params.push(limite, offset);

    const query = `
      SELECT i.*,
             a.icao_code,
             a.name AS airport_name,
             s.name AS season_name,
             u.name AS user_name,
             (SELECT COUNT(*) FROM wildlife.fact_protection_fence_occurrence WHERE inspection_id = i.inspection_id) AS fence_count,
             (SELECT COUNT(*) FROM wildlife.fact_protection_gate_occurrence WHERE inspection_id = i.inspection_id) AS gate_count,
             (SELECT COUNT(*) FROM wildlife.fact_protection_general_photo WHERE inspection_id = i.inspection_id) AS general_photo_count

      FROM wildlife.fact_protection_inspection i
      LEFT JOIN wildlife.airport a ON a.airport_id = i.airport_id
      LEFT JOIN wildlife.lu_year_season s ON s.season_id = i.season_id
      LEFT JOIN wildlife.app_user u ON u.user_id = i.reported_by_user_id
      WHERE 1=1 ${whereClause}
      ORDER BY i.inspection_date DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const result = await db.query(query, params);

    // Count total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM wildlife.fact_protection_inspection i
      WHERE 1=1 ${whereClause}
    `;
    const countResult = await db.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    return {
      data: result.rows,
      pagination: {
        pagina,
        limite,
        total,
        totalPaginas: Math.ceil(total / limite)
      }
    };
  });

  // GET /api/inspecoes-protecao/:id - Buscar uma inspeção específica
  app.get('/inspecoes-protecao/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const inspectionId = parseInt(id);

    const query = `
      SELECT i.*,
             a.icao_code,
             a.name AS airport_name,
             s.name AS season_name,
             u.name AS user_name,

             (SELECT json_agg(json_build_object(
               'occurrence_id', fo.occurrence_id,
               'location_text', fo.location_text,
               'repair_performed', fo.repair_performed,
               'repair_date', fo.repair_date,
               'irregular_waste_present', fo.irregular_waste_present,
               'waste_removed', fo.waste_removed,
               'notes', fo.notes,
               'photo_count', fo.photo_count,
               'occurrence_types', (
                 SELECT json_agg(json_build_object(
                   'occurrence_type_id', fot.occurrence_type_id,
                   'occurrence_type_name', ft.name
                 ))
                 FROM wildlife.fact_protection_fence_occurrence_type fot
                 JOIN wildlife.lu_fence_occurrence_type ft ON ft.occurrence_type_id = fot.occurrence_type_id
                 WHERE fot.occurrence_id = fo.occurrence_id
               )
             ))
             FROM wildlife.fact_protection_fence_occurrence fo
             WHERE fo.inspection_id = i.inspection_id) AS fence_occurrences,

             (SELECT json_agg(json_build_object(
               'occurrence_id', go.occurrence_id,
               'location_text', go.location_text,
               'other_occurrence', go.other_occurrence,
               'repair_performed', go.repair_performed,
               'repair_date', go.repair_date,
               'irregular_waste_present', go.irregular_waste_present,
               'waste_removed', go.waste_removed,
               'notes', go.notes,
               'photo_count', go.photo_count,
               'occurrence_types', (
                 SELECT json_agg(json_build_object(
                   'occurrence_type_id', got.occurrence_type_id,
                   'occurrence_type_name', gt.name
                 ))
                 FROM wildlife.fact_protection_gate_occurrence_type got
                 JOIN wildlife.lu_gate_occurrence_type gt ON gt.occurrence_type_id = got.occurrence_type_id
                 WHERE got.occurrence_id = go.occurrence_id
               )
             ))
             FROM wildlife.fact_protection_gate_occurrence go
             WHERE go.inspection_id = i.inspection_id) AS gate_occurrences,

             (SELECT COUNT(*) FROM wildlife.fact_protection_general_photo WHERE inspection_id = i.inspection_id) AS general_photo_count

      FROM wildlife.fact_protection_inspection i
      LEFT JOIN wildlife.airport a ON a.airport_id = i.airport_id
      LEFT JOIN wildlife.lu_year_season s ON s.season_id = i.season_id
      LEFT JOIN wildlife.app_user u ON u.user_id = i.reported_by_user_id
      WHERE i.inspection_id = $1
    `;

    const result = await db.query(query, [inspectionId]);

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Inspeção não encontrada' });
    }

    return result.rows[0];
  });

  // POST /api/inspecoes-protecao - Criar nova inspeção (multipart for photos)
  app.post('/inspecoes-protecao', async (request, reply) => {
    const data = await request.file();

    if (!data) {
      return reply.status(400).send({ error: 'Multipart data required' });
    }

    // Parse JSON payload from multipart field
    const payloadField = data.fields.payload as any;
    const payloadStr = payloadField?.value || '{}';
    const payload = JSON.parse(payloadStr);

    const validated = protectionInspectionSchema.parse(payload);

    // Collect uploaded photos
    const generalPhotos: Buffer[] = [];
    const fencePhotos: Record<number, Buffer[]> = {}; // key: fence index
    const gatePhotos: Record<number, Buffer[]> = {}; // key: gate index

    // Process multipart files
    for (const [fieldName, field] of Object.entries(data.fields)) {
      if (fieldName.startsWith('general_photo_')) {
        const file = field as any;
        if (file.file) {
          const buffer = await file.toBuffer();
          const normalized = await sharp(buffer).resize(1920, null, { withoutEnlargement: true }).png().toBuffer();
          generalPhotos.push(normalized);
        }
      } else if (fieldName.startsWith('fence_photo_')) {
        const match = fieldName.match(/fence_photo_(\d+)_(\d+)/);
        if (match) {
          const fenceIdx = parseInt(match[1]);
          const file = field as any;
          if (file.file) {
            const buffer = await file.toBuffer();
            const normalized = await sharp(buffer).resize(1920, null, { withoutEnlargement: true }).png().toBuffer();
            if (!fencePhotos[fenceIdx]) fencePhotos[fenceIdx] = [];
            fencePhotos[fenceIdx].push(normalized);
          }
        }
      } else if (fieldName.startsWith('gate_photo_')) {
        const match = fieldName.match(/gate_photo_(\d+)_(\d+)/);
        if (match) {
          const gateIdx = parseInt(match[1]);
          const file = field as any;
          if (file.file) {
            const buffer = await file.toBuffer();
            const normalized = await sharp(buffer).resize(1920, null, { withoutEnlargement: true }).png().toBuffer();
            if (!gatePhotos[gateIdx]) gatePhotos[gateIdx] = [];
            gatePhotos[gateIdx].push(normalized);
          }
        }
      }
    }

    const result = await db.transaction(async (client) => {
      // Insert main inspection record
      const inspectionResult = await client.query(`
        INSERT INTO wildlife.fact_protection_inspection (
          airport_id, inspection_date, season_id, rained_last_24h,
          general_notes, reported_by_user_id, reporter_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING inspection_id
      `, [
        validated.airport_id,
        validated.inspection_date,
        validated.season_id ?? null,
        validated.rained_last_24h ?? false,
        validated.general_notes ?? null,
        validated.reported_by_user_id ?? null,
        validated.reporter_name ?? null,
      ]);

      const inspectionId = inspectionResult.rows[0].inspection_id;

      // Insert fence occurrences
      if (validated.fence_occurrences && validated.fence_occurrences.length > 0) {
        for (let idx = 0; idx < validated.fence_occurrences.length; idx++) {
          const fence = validated.fence_occurrences[idx];

          const occResult = await client.query(`
            INSERT INTO wildlife.fact_protection_fence_occurrence (
              inspection_id, location_text, repair_performed, repair_date,
              irregular_waste_present, waste_removed, notes, photo_count
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING occurrence_id
          `, [
            inspectionId,
            fence.location_text,
            fence.repair_performed ?? false,
            fence.repair_date ?? null,
            fence.irregular_waste_present ?? false,
            fence.waste_removed ?? false,
            fence.notes ?? null,
            fencePhotos[idx]?.length || 0,
          ]);

          const occurrenceId = occResult.rows[0].occurrence_id;

          // Insert occurrence types
          if (fence.occurrence_types && fence.occurrence_types.length > 0) {
            for (const typeId of fence.occurrence_types) {
              await client.query(`
                INSERT INTO wildlife.fact_protection_fence_occurrence_type (occurrence_id, occurrence_type_id)
                VALUES ($1, $2)
              `, [occurrenceId, typeId]);
            }
          }

          // Insert photos
          if (fencePhotos[idx]) {
            for (let photoIdx = 0; photoIdx < fencePhotos[idx].length; photoIdx++) {
              await client.query(`
                INSERT INTO wildlife.fact_protection_fence_photo (
                  occurrence_id, photo_idx, photo_blob, photo_mime
                ) VALUES ($1, $2, $3, $4)
              `, [occurrenceId, photoIdx, fencePhotos[idx][photoIdx], 'image/png']);
            }
          }
        }
      }

      // Insert gate occurrences
      if (validated.gate_occurrences && validated.gate_occurrences.length > 0) {
        for (let idx = 0; idx < validated.gate_occurrences.length; idx++) {
          const gate = validated.gate_occurrences[idx];

          const occResult = await client.query(`
            INSERT INTO wildlife.fact_protection_gate_occurrence (
              inspection_id, location_text, other_occurrence, repair_performed, repair_date,
              irregular_waste_present, waste_removed, notes, photo_count
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING occurrence_id
          `, [
            inspectionId,
            gate.location_text,
            gate.other_occurrence ?? null,
            gate.repair_performed ?? false,
            gate.repair_date ?? null,
            gate.irregular_waste_present ?? false,
            gate.waste_removed ?? false,
            gate.notes ?? null,
            gatePhotos[idx]?.length || 0,
          ]);

          const occurrenceId = occResult.rows[0].occurrence_id;

          // Insert occurrence types
          if (gate.occurrence_types && gate.occurrence_types.length > 0) {
            for (const typeId of gate.occurrence_types) {
              await client.query(`
                INSERT INTO wildlife.fact_protection_gate_occurrence_type (occurrence_id, occurrence_type_id)
                VALUES ($1, $2)
              `, [occurrenceId, typeId]);
            }
          }

          // Insert photos
          if (gatePhotos[idx]) {
            for (let photoIdx = 0; photoIdx < gatePhotos[idx].length; photoIdx++) {
              await client.query(`
                INSERT INTO wildlife.fact_protection_gate_photo (
                  occurrence_id, photo_idx, photo_blob, photo_mime
                ) VALUES ($1, $2, $3, $4)
              `, [occurrenceId, photoIdx, gatePhotos[idx][photoIdx], 'image/png']);
            }
          }
        }
      }

      // Insert general photos (limit to 5)
      if (generalPhotos.length > 0) {
        const limit = Math.min(generalPhotos.length, 5);
        for (let photoIdx = 0; photoIdx < limit; photoIdx++) {
          await client.query(`
            INSERT INTO wildlife.fact_protection_general_photo (
              inspection_id, photo_idx, photo_blob, photo_mime
            ) VALUES ($1, $2, $3, $4)
          `, [inspectionId, photoIdx, generalPhotos[photoIdx], 'image/png']);
        }
      }

      return inspectionId;
    });

    return reply.status(201).send({ inspection_id: result });
  });

  // DELETE /api/inspecoes-protecao/:id - Remover inspeção
  app.delete('/inspecoes-protecao/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const inspectionId = parseInt(id);

    await db.query('DELETE FROM wildlife.fact_protection_inspection WHERE inspection_id = $1', [inspectionId]);

    return { message: 'Inspeção removida com sucesso' };
  });
}
