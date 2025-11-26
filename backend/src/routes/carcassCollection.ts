import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../services/db';
import sharp from 'sharp';

// Schema de validação para coleta de carcaça
const carcassCollectionSchema = z.object({
  airport_id: z.coerce.number().int().positive(),
  collection_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  filled_by: z.string().optional(),
  delivered_by: z.string().optional(),
  runway_ref: z.string().optional(),
  quadrant_id: z.coerce.number().int().positive().optional(),
  found_during_inspection: z.boolean().optional(),
  destination_text: z.string().optional(),
  common_name: z.string().optional(),
  scientific_name: z.string().optional(),
  individual_count: z.coerce.number().int().optional(),
  has_photos: z.boolean().optional(),
  observations: z.string().optional(),
});

export async function carcassCollectionRoutes(app: FastifyInstance) {
  // GET /api/coletas-carcaca - Listar coletas
  app.get('/coletas-carcaca', async (request, reply) => {
    const qs = request.query as any;
    const airportId = qs.airportId ? parseInt(qs.airportId) : undefined;
    const inicio = qs.inicio;
    const fim = qs.fim;
    const pagina = qs.pagina ? parseInt(qs.pagina) : 1;
    const limite = qs.limite ? parseInt(qs.limite) : 50;
    const offset = (pagina - 1) * limite;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (airportId) {
      whereClause += ` AND c.airport_id = $${paramCount}`;
      params.push(airportId);
      paramCount++;
    }

    if (inicio) {
      whereClause += ` AND c.collection_date >= $${paramCount}`;
      params.push(inicio);
      paramCount++;
    }

    if (fim) {
      whereClause += ` AND c.collection_date <= $${paramCount}`;
      params.push(fim);
      paramCount++;
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM wildlife.fact_carcass_collection c
      ${whereClause}
    `;

    const dataQuery = `
      SELECT c.*,
             a.icao_code,
             a.name AS airport_name,
             q.code AS quadrant_code,
             (SELECT COUNT(*) FROM wildlife.fact_carcass_collection_photo p WHERE p.collection_id = c.collection_id) as photo_count
      FROM wildlife.fact_carcass_collection c
      LEFT JOIN wildlife.airport a ON a.airport_id = c.airport_id
      LEFT JOIN wildlife.lu_quadrant q ON q.quadrant_id = c.quadrant_id
      ${whereClause}
      ORDER BY c.collection_date DESC, c.collection_id DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const [countResult, dataResult] = await Promise.all([
      db.query(countQuery, params),
      db.query(dataQuery, [...params, limite, offset])
    ]);

    const total = parseInt(countResult.rows[0]?.total || '0');

    return {
      coletas: dataResult.rows,
      paginacao: {
        pagina,
        limite,
        total,
        totalPaginas: Math.ceil(total / limite)
      }
    };
  });

  // GET /api/coletas-carcaca/:id - Buscar uma coleta específica
  app.get('/coletas-carcaca/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const collectionId = parseInt(id);

    const query = `
      SELECT c.*,
             a.icao_code,
             a.name AS airport_name,
             q.code AS quadrant_code,
             (SELECT COUNT(*) FROM wildlife.fact_carcass_collection_photo p WHERE p.collection_id = c.collection_id) as photo_count
      FROM wildlife.fact_carcass_collection c
      LEFT JOIN wildlife.airport a ON a.airport_id = c.airport_id
      LEFT JOIN wildlife.lu_quadrant q ON q.quadrant_id = c.quadrant_id
      WHERE c.collection_id = $1
    `;

    const result = await db.query(query, [collectionId]);

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Coleta não encontrada' });
    }

    return result.rows[0];
  });

  // POST /api/coletas-carcaca - Criar nova coleta (com fotos)
  app.post('/coletas-carcaca', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'Nenhum dado recebido' });
    }

    const payloadField = data.fields.payload as any;
    const payload = JSON.parse(payloadField?.value || '{}');
    const validated = carcassCollectionSchema.parse(payload);

    // Coletar fotos do multipart
    const photos: Buffer[] = [];
    for (const field of Object.keys(data.fields)) {
      if (field.startsWith('photo_')) {
        const photoField = data.fields[field] as any;
        if (photoField?.value && Buffer.isBuffer(photoField.value)) {
          try {
            const normalized = await sharp(photoField.value)
              .resize(1920, null, { withoutEnlargement: true })
              .png()
              .toBuffer();
            photos.push(normalized);
          } catch (err) {
            console.error('Erro ao processar foto:', err);
          }
        }
      }
    }

    const result = await db.transaction(async (client) => {
      // Inserir coleta principal
      const insertResult = await client.query(`
        INSERT INTO wildlife.fact_carcass_collection (
          airport_id, collection_date, filled_by, delivered_by, runway_ref, quadrant_id,
          found_during_inspection, destination_text, common_name, scientific_name,
          individual_count, has_photos, observations
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING collection_id
      `, [
        validated.airport_id,
        validated.collection_date,
        validated.filled_by || null,
        validated.delivered_by || null,
        validated.runway_ref || null,
        validated.quadrant_id || null,
        validated.found_during_inspection || false,
        validated.destination_text || null,
        validated.common_name || null,
        validated.scientific_name || null,
        validated.individual_count || null,
        photos.length > 0,
        validated.observations || null
      ]);

      const collectionId = insertResult.rows[0].collection_id;

      // Inserir fotos
      for (let i = 0; i < photos.length; i++) {
        await client.query(`
          INSERT INTO wildlife.fact_carcass_collection_photo (collection_id, photo_idx, photo_data)
          VALUES ($1, $2, $3)
        `, [collectionId, i, photos[i]]);
      }

      return collectionId;
    });

    return reply.status(201).send({ collection_id: result });
  });

  // DELETE /api/coletas-carcaca/:id - Remover coleta
  app.delete('/coletas-carcaca/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const collectionId = parseInt(id);

    await db.query('DELETE FROM wildlife.fact_carcass_collection WHERE collection_id = $1', [collectionId]);

    return { message: 'Coleta removida com sucesso' };
  });
}
