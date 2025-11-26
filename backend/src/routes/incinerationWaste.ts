import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../services/db';

const incinerationWasteSchema = z.object({
  airport_id: z.coerce.number().int().positive(),
  company_name: z.string().min(1),
  record_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  international_flights: z.boolean().optional(),
  waste_type: z.string().optional(),
  physical_state_id: z.coerce.number().int().positive().optional(),
  origin: z.string().optional(),
  codification: z.string().optional(),
  generation_frequency: z.string().optional(),
  weight_kg: z.coerce.number().optional(),
  unit_quantity: z.coerce.number().int().optional(),
  volume_value: z.coerce.number().optional(),
  volume_unit: z.string().optional(),
  treatment_id: z.coerce.number().int().positive().optional(),
  treatment_other: z.string().optional(),
  filled_by: z.string().optional(),
});

export async function incinerationWasteRoutes(app: FastifyInstance) {
  // GET /api/residuos-incineracao - Listar resíduos
  app.get('/residuos-incineracao', async (request, reply) => {
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
      whereClause += ` AND w.airport_id = $${paramCount}`;
      params.push(airportId);
      paramCount++;
    }

    if (inicio) {
      whereClause += ` AND w.record_date >= $${paramCount}`;
      params.push(inicio);
      paramCount++;
    }

    if (fim) {
      whereClause += ` AND w.record_date <= $${paramCount}`;
      params.push(fim);
      paramCount++;
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM wildlife.fact_incineration_waste w
      ${whereClause}
    `;

    const dataQuery = `
      SELECT w.*,
             a.icao_code,
             a.name AS airport_name,
             ps.name AS physical_state_name,
             tr.name AS treatment_name
      FROM wildlife.fact_incineration_waste w
      LEFT JOIN wildlife.airport a ON a.airport_id = w.airport_id
      LEFT JOIN wildlife.lu_waste_physical_state ps ON ps.state_id = w.physical_state_id
      LEFT JOIN wildlife.lu_waste_treatment_type tr ON tr.treatment_id = w.treatment_id
      ${whereClause}
      ORDER BY w.record_date DESC, w.waste_id DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const [countResult, dataResult] = await Promise.all([
      db.query(countQuery, params),
      db.query(dataQuery, [...params, limite, offset])
    ]);

    const total = parseInt(countResult.rows[0]?.total || '0');

    return {
      residuos: dataResult.rows,
      paginacao: {
        pagina,
        limite,
        total,
        totalPaginas: Math.ceil(total / limite)
      }
    };
  });

  // GET /api/residuos-incineracao/:id - Buscar um resíduo específico
  app.get('/residuos-incineracao/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const wasteId = parseInt(id);

    const query = `
      SELECT w.*,
             a.icao_code,
             a.name AS airport_name,
             ps.name AS physical_state_name,
             tr.name AS treatment_name
      FROM wildlife.fact_incineration_waste w
      LEFT JOIN wildlife.airport a ON a.airport_id = w.airport_id
      LEFT JOIN wildlife.lu_waste_physical_state ps ON ps.state_id = w.physical_state_id
      LEFT JOIN wildlife.lu_waste_treatment_type tr ON tr.treatment_id = w.treatment_id
      WHERE w.waste_id = $1
    `;

    const result = await db.query(query, [wasteId]);

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Resíduo não encontrado' });
    }

    return result.rows[0];
  });

  // POST /api/residuos-incineracao - Criar novo registro
  app.post('/residuos-incineracao', async (request, reply) => {
    const validated = incinerationWasteSchema.parse(request.body);

    const result = await db.query(`
      INSERT INTO wildlife.fact_incineration_waste (
        airport_id, company_name, record_date, international_flights, waste_type,
        physical_state_id, origin, codification, generation_frequency,
        weight_kg, unit_quantity, volume_value, volume_unit,
        treatment_id, treatment_other, filled_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING waste_id
    `, [
      validated.airport_id,
      validated.company_name,
      validated.record_date,
      validated.international_flights || false,
      validated.waste_type || null,
      validated.physical_state_id || null,
      validated.origin || null,
      validated.codification || null,
      validated.generation_frequency || null,
      validated.weight_kg || null,
      validated.unit_quantity || null,
      validated.volume_value || null,
      validated.volume_unit || null,
      validated.treatment_id || null,
      validated.treatment_other || null,
      validated.filled_by || null
    ]);

    return reply.status(201).send({ waste_id: result.rows[0].waste_id });
  });

  // PUT /api/residuos-incineracao/:id - Atualizar registro
  app.put('/residuos-incineracao/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const wasteId = parseInt(id);
    const validated = incinerationWasteSchema.parse(request.body);

    await db.query(`
      UPDATE wildlife.fact_incineration_waste
      SET company_name = $1, record_date = $2, international_flights = $3, waste_type = $4,
          physical_state_id = $5, origin = $6, codification = $7, generation_frequency = $8,
          weight_kg = $9, unit_quantity = $10, volume_value = $11, volume_unit = $12,
          treatment_id = $13, treatment_other = $14, filled_by = $15
      WHERE waste_id = $16
    `, [
      validated.company_name,
      validated.record_date,
      validated.international_flights || false,
      validated.waste_type || null,
      validated.physical_state_id || null,
      validated.origin || null,
      validated.codification || null,
      validated.generation_frequency || null,
      validated.weight_kg || null,
      validated.unit_quantity || null,
      validated.volume_value || null,
      validated.volume_unit || null,
      validated.treatment_id || null,
      validated.treatment_other || null,
      validated.filled_by || null,
      wasteId
    ]);

    return { message: 'Resíduo atualizado com sucesso' };
  });

  // DELETE /api/residuos-incineracao/:id - Remover registro
  app.delete('/residuos-incineracao/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const wasteId = parseInt(id);

    await db.query('DELETE FROM wildlife.fact_incineration_waste WHERE waste_id = $1', [wasteId]);

    return { message: 'Resíduo removido com sucesso' };
  });
}
