import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../services/db';
import sharp from 'sharp';

// Schema de validação para a inspeção de lagos
const lakeInspectionSchema = z.object({
  airport_id: z.coerce.number().int().positive(),
  inspection_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  season_id: z.coerce.number().int().positive(),
  rained_last_24h: z.boolean(),
  runway_ref: z.string().optional(),
  quadrant_id: z.coerce.number().int().positive().optional(),
  fauna_present: z.boolean(),
  species_popular_name: z.string().optional(),
  species_scientific_name: z.string().optional(),
  individual_count: z.coerce.number().int().optional(),
  inspected_system: z.string().optional(),
  has_non_conformity: z.boolean().optional(),
  situation_description: z.string().optional(),
  mitigation_action: z.string().optional(),
  general_observations: z.string().optional(),
});

export async function lakeInspectionsRoutes(app: FastifyInstance) {
  // GET /api/inspecoes-lagos - Listar inspeções
  app.get('/api/inspecoes-lagos', async (request, reply) => {
    const qs = request.query as any;
    const airportId = qs.airportId ? parseInt(qs.airportId) : undefined;
    const inicio = qs.inicio;
    const fim = qs.fim;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (airportId) {
      whereClause += ` AND i.airport_id = $${paramCount++}`;
      params.push(airportId);
    }
    if (inicio) {
      whereClause += ` AND i.inspection_date >= $${paramCount++}`;
      params.push(inicio);
    }
    if (fim) {
      whereClause += ` AND i.inspection_date <= $${paramCount++}`;
      params.push(fim);
    }

    const query = `
      SELECT i.*,
             a.icao_code,
             s.name as season_name,
             q.code as quadrant_code,
             (SELECT COUNT(*) FROM wildlife.fact_lake_inspection_photo p WHERE p.inspection_id = i.inspection_id) as photo_count
      FROM wildlife.fact_lake_inspection i
      LEFT JOIN wildlife.airport a ON a.airport_id = i.airport_id
      LEFT JOIN wildlife.lu_year_season s ON s.season_id = i.season_id
      LEFT JOIN wildlife.lu_quadrant q ON q.quadrant_id = i.quadrant_id
      ${whereClause}
      ORDER BY i.inspection_date DESC, i.inspection_id DESC
    `;

    const result = await db.query(query, params);
    return result.rows;
  });

  // POST /api/inspecoes-lagos - Criar nova inspeção
  app.post('/api/inspecoes-lagos', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'Nenhum dado recebido' });
    }

    const payload = JSON.parse((data.fields.payload as any)?.value || '{}');
    const validated = lakeInspectionSchema.parse(payload);

    const photos: Buffer[] = [];
    for (const field of Object.keys(data.fields)) {
      if (field.startsWith('photo_')) {
        const photoField = data.fields[field] as any;
        if (photoField?.value && Buffer.isBuffer(photoField.value)) {
          const normalized = await sharp(photoField.value)
            .resize(1920, null, { withoutEnlargement: true })
            .png().toBuffer();
          photos.push(normalized);
        }
      }
    }

    const inspectionId = await db.transaction(async (client) => {
      const result = await client.query(`
        INSERT INTO wildlife.fact_lake_inspection (
          airport_id, inspection_date, season_id, rained_last_24h, runway_ref, quadrant_id,
          fauna_present, species_popular_name, species_scientific_name, individual_count,
          inspected_system, has_non_conformity, situation_description, mitigation_action, general_observations
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING inspection_id
      `, [
        validated.airport_id, validated.inspection_date, validated.season_id, validated.rained_last_24h,
        validated.runway_ref || null, validated.quadrant_id || null, validated.fauna_present,
        validated.species_popular_name || null, validated.species_scientific_name || null,
        validated.individual_count || null, validated.inspected_system || null,
        validated.has_non_conformity || false, validated.situation_description || null,
        validated.mitigation_action || null, validated.general_observations || null
      ]);

      const newId = result.rows[0].inspection_id;

      for (let i = 0; i < photos.length; i++) {
        await client.query(`
          INSERT INTO wildlife.fact_lake_inspection_photo (inspection_id, photo_idx, photo_data)
          VALUES ($1, $2, $3)
        `, [newId, i, photos[i]]);
      }

      return newId;
    });

    return reply.status(201).send({ inspection_id: inspectionId });
  });

  // DELETE /api/inspecoes-lagos/:id - Remover inspeção
  app.delete('/api/inspecoes-lagos/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const inspectionId = parseInt(id);

    await db.query('DELETE FROM wildlife.fact_lake_inspection WHERE inspection_id = $1', [inspectionId]);

    return { message: 'Inspeção removida com sucesso' };
  });
}