import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../services/db';

// Schema de validação para a inspeção F2
const greenAreaInspectionSchema = z.object({
  airport_id: z.coerce.number().int().positive(),
  record_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  record_type: z.enum(['corte', 'poda', 'extracao', 'limpeza']),
  season_id: z.coerce.number().int().positive(),
  general_observations: z.string().optional(),

  // Corte de Grama
  grass_cutting: z.object({
    activity_period: z.enum(['diurno', 'noturno']).optional(),
    equipment: z.enum(['manual', 'rocadeira', 'trator']).optional(),
    cuttings_collected: z.boolean().optional(),
    cuttings_destination: z.string().optional(),
    cut_areas: z.string().optional(),
    animal_attraction: z.boolean().optional(),
    attracted_species: z.string().optional(),
    gutter_cleaned: z.boolean().optional(),
  }).optional(),

  // Poda ou Extração
  pruning_extraction: z.object({
    vegetation_type: z.enum(['arvores', 'arbustos', 'trepadeiras', 'rasteira']).optional(),
    has_environmental_authorization: z.boolean().optional(),
    managed_species: z.string().optional(),
    cuttings_collected: z.boolean().optional(),
    cuttings_destination: z.string().optional(),
    vegetation_location: z.string().optional(),
    animal_attraction: z.boolean().optional(),
    observed_species: z.string().optional(),
  }).optional(),
});

export async function greenAreaInspectionsRoutes(app: FastifyInstance) {
  // Listar inspeções F2
  app.get('/inspecoes-areas-verdes', async (request) => {
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
      whereClause += ` AND i.record_date >= $${paramCount++}`;
      params.push(inicio);
    }
    if (fim) {
      whereClause += ` AND i.record_date <= $${paramCount++}`;
      params.push(fim);
    }

    const query = `
      SELECT i.*, a.icao_code, s.name as season_name
      FROM wildlife.fact_green_area_maintenance i
      LEFT JOIN wildlife.airport a ON a.airport_id = i.airport_id
      LEFT JOIN wildlife.lu_year_season s ON s.season_id = i.season_id
      ${whereClause}
      ORDER BY i.record_date DESC, i.maintenance_id DESC
    `;

    const result = await db.query(query, params);
    return result.rows;
  });

  // Criar nova inspeção F2
  app.post('/inspecoes-areas-verdes', async (request, reply) => {
    const validated = greenAreaInspectionSchema.parse(request.body);

    const result = await db.query(`
      INSERT INTO wildlife.fact_green_area_maintenance (
        airport_id, record_date, record_type, season_id, general_observations,
        grass_cutting, pruning_extraction
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING maintenance_id
    `, [
      validated.airport_id,
      validated.record_date,
      validated.record_type,
      validated.season_id,
      validated.general_observations || null,
      validated.grass_cutting ? JSON.stringify(validated.grass_cutting) : null,
      validated.pruning_extraction ? JSON.stringify(validated.pruning_extraction) : null,
    ]);

    return reply.status(201).send({ maintenance_id: result.rows[0].maintenance_id });
  });

  // Atualizar inspeção F2
  app.put('/inspecoes-areas-verdes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const maintenanceId = parseInt(id);
    const validated = greenAreaInspectionSchema.parse(request.body);

    const result = await db.query(`
      UPDATE wildlife.fact_green_area_maintenance
      SET
        airport_id = $1,
        record_date = $2,
        record_type = $3,
        season_id = $4,
        general_observations = $5,
        grass_cutting = $6,
        pruning_extraction = $7,
        updated_at = now()
      WHERE maintenance_id = $8
    `, [
      validated.airport_id,
      validated.record_date,
      validated.record_type,
      validated.season_id,
      validated.general_observations || null,
      validated.grass_cutting ? JSON.stringify(validated.grass_cutting) : null,
      validated.pruning_extraction ? JSON.stringify(validated.pruning_extraction) : null,
      maintenanceId,
    ]);

    if (result.rowCount === 0) {
      return reply.status(404).send({ error: 'Registro não encontrado' });
    }

    return { message: 'Registro atualizado com sucesso' };
  });

  // Remover inspeção F2
  app.delete('/inspecoes-areas-verdes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const maintenanceId = parseInt(id);

    const result = await db.query('DELETE FROM wildlife.fact_green_area_maintenance WHERE maintenance_id = $1', [maintenanceId]);

    if (result.rowCount === 0) {
      return reply.status(404).send({ error: 'Registro não encontrado' });
    }

    return { message: 'Registro removido com sucesso' };
  });
}