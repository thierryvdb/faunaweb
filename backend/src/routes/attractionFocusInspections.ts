import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../services/db';

// Schemas para as subseções do formulário F3
const secondaryFocusSchema = z.object({
  type: z.string(), // cupinzeiro, pequenos_animais, ninhos, ovos, formigueiros, outros
  other_type: z.string().optional(),
  removal_performed: z.boolean().optional(),
  action_date: z.string().optional(),
  location: z.string().optional(),
  individuals_present: z.boolean().optional(),
  species_present: z.string().optional(),
});

const greenAreaFocusSchema = z.object({
  type: z.string(), // gramado, areas_verdes, arvore, arbustos, trepadeiras, vegetacao_rasteira, outros
  other_type: z.string().optional(),
  action_date: z.string().optional(),
  action_performed: z.string().optional(), // ceifagem, poda, extracao
  location: z.string().optional(),
  animal_presence: z.boolean().optional(),
  species_present: z.string().optional(),
  nests_eggs_present: z.boolean().optional(),
});

// 4.1 Caixa de Drenagem
const drainageBoxSchema = z.object({
  missing_grid: z.boolean().optional(),
  damaged_cover: z.boolean().optional(),
  missing_cover: z.boolean().optional(),
  hole_around: z.boolean().optional(),
  repair_performed: z.boolean().optional(),
  location: z.string().optional(),
  animal_presence: z.boolean().optional(),
  species_present: z.string().optional(),
  nests_eggs_present: z.boolean().optional(),
});

// 4.2 Boca de Lobo
const manholeSchema = z.object({
  missing_grid: z.boolean().optional(),
  damaged_cover: z.boolean().optional(),
  missing_cover: z.boolean().optional(),
  hole_around: z.boolean().optional(),
  repair_performed: z.boolean().optional(),
  repair_date: z.string().optional(),
  location: z.string().optional(),
  animal_presence: z.boolean().optional(),
  species_present: z.string().optional(),
  nests_eggs_present: z.boolean().optional(),
});

// 4.3 Vala de Drenagem
const drainageDitchSchema = z.object({
  condition_type: z.string().optional(), // concreto ou grama
  obstruction_vegetation: z.boolean().optional(),
  obstruction_debris: z.boolean().optional(),
  obstruction_mud: z.boolean().optional(),
  clearance_performed: z.boolean().optional(),
  location: z.string().optional(),
  animal_presence: z.boolean().optional(),
  species_present: z.string().optional(),
  nests_eggs_present: z.boolean().optional(),
});

// 4.4 Bacia de Acumulação
const accumulationBasinSchema = z.object({
  water_accumulation: z.boolean().optional(),
  vegetation_accumulation: z.boolean().optional(),
  location: z.string().optional(),
  animal_presence: z.boolean().optional(),
  species_present: z.string().optional(),
  nests_eggs_present: z.boolean().optional(),
});

// 4.5 Demais Acúmulos de Água
const otherWaterAccumulationsSchema = z.object({
  location: z.string().optional(),
  animal_presence: z.boolean().optional(),
  species_present: z.string().optional(),
});

const drainageSystemFocusSchema = z.object({
  drainage_boxes: z.array(drainageBoxSchema).optional(),
  manholes: z.array(manholeSchema).optional(),
  drainage_ditches: z.array(drainageDitchSchema).optional(),
  accumulation_basins: z.array(accumulationBasinSchema).optional(),
  other_water_accumulations: z.array(otherWaterAccumulationsSchema).optional(),
});

// 5. Descarte Irregular de Resíduos Sólidos
const wasteDisposalFocusSchema = z.object({
  waste_type: z.string(), // organico, inorganico, construcao_civil
  location: z.string().optional(),
  removal_performed: z.boolean().optional(),
  observed_species: z.string().optional(),
  animal_presence: z.boolean().optional(),
});

// Schema principal para a inspeção F3
const attractionFocusInspectionSchema = z.object({
  airport_id: z.coerce.number().int().positive(),
  inspection_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  season_id: z.coerce.number().int().positive(),
  rained_last_24h: z.boolean(),
  secondary_focuses: z.array(secondaryFocusSchema).optional(),
  green_area_focuses: z.array(greenAreaFocusSchema).optional(),
  drainage_system_focuses: drainageSystemFocusSchema.optional(),
  waste_disposal_focuses: z.array(wasteDisposalFocusSchema).optional(),
  general_observations: z.string().optional(),
});

export async function attractionFocusInspectionsRoutes(app: FastifyInstance) {
  // Listar inspeções F3
  app.get('/api/inspecoes-focos-atracao', async (request) => {
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
      SELECT i.*, a.icao_code, s.name as season_name
      FROM wildlife.fact_attraction_focus_inspection i
      LEFT JOIN wildlife.airport a ON a.airport_id = i.airport_id
      LEFT JOIN wildlife.lu_year_season s ON s.season_id = i.season_id
      ${whereClause}
      ORDER BY i.inspection_date DESC, i.focus_inspection_id DESC
    `;

    const result = await db.query(query, params);
    return result.rows;
  });

  // Criar nova inspeção F3
  app.post('/api/inspecoes-focos-atracao', async (request, reply) => {
    const validated = attractionFocusInspectionSchema.parse(request.body);

    const result = await db.query(`
      INSERT INTO wildlife.fact_attraction_focus_inspection (
        airport_id, inspection_date, season_id, rained_last_24h,
        secondary_focuses, green_area_focuses, drainage_system_focuses, waste_disposal_focuses,
        general_observations
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING focus_inspection_id
    `, [
      validated.airport_id, validated.inspection_date, validated.season_id, validated.rained_last_24h,
      JSON.stringify(validated.secondary_focuses || []),
      JSON.stringify(validated.green_area_focuses || []),
      JSON.stringify(validated.drainage_system_focuses || {}),
      JSON.stringify(validated.waste_disposal_focuses || []),
      validated.general_observations || null,
    ]);

    return reply.status(201).send({ focus_inspection_id: result.rows[0].focus_inspection_id });
  });

  // Atualizar inspeção F3
  app.put('/api/inspecoes-focos-atracao/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const validated = attractionFocusInspectionSchema.parse(request.body);

    await db.query(`
      UPDATE wildlife.fact_attraction_focus_inspection
      SET inspection_date = $1, season_id = $2, rained_last_24h = $3, secondary_focuses = $4,
          green_area_focuses = $5, drainage_system_focuses = $6, waste_disposal_focuses = $7,
          general_observations = $8, airport_id = $9
      WHERE focus_inspection_id = $10
    `, [
      validated.inspection_date, validated.season_id, validated.rained_last_24h,
      JSON.stringify(validated.secondary_focuses || []), JSON.stringify(validated.green_area_focuses || []),
      JSON.stringify(validated.drainage_system_focuses || {}), JSON.stringify(validated.waste_disposal_focuses || []),
      validated.general_observations || null, validated.airport_id, parseInt(id),
    ]);

    return { message: 'Registro atualizado com sucesso' };
  });

  // Remover inspeção F3
  app.delete('/api/inspecoes-focos-atracao/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await db.query('DELETE FROM wildlife.fact_attraction_focus_inspection WHERE focus_inspection_id = $1', [parseInt(id)]);
    return { message: 'Registro removido com sucesso' };
  });
}