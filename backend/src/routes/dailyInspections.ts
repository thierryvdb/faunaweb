import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../services/db';

// Schema de validação para inspeção diária
const dailyInspectionSchema = z.object({
  airport_id: z.coerce.number().int().positive(),
  inspection_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  inspection_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  period_id: z.coerce.number().int().positive().optional(),
  period_text: z.string().optional(),
  collision_occurred: z.boolean().optional(),
  collision_species: z.string().optional(),
  weather_id: z.coerce.number().int().positive().optional(),
  mandatory_report: z.boolean().optional(),
  inspector_name: z.string().optional(),
  inspector_team: z.string().optional(),
  reported_by_user_id: z.coerce.number().int().positive().optional(),
  notes: z.string().optional(),

  // Nested arrays
  aerodrome_observations: z.array(z.object({
    location_type_id: z.coerce.number().int().positive(),
    species_id: z.coerce.number().int().positive().optional(),
    species_text: z.string().optional(),
    quantity: z.coerce.number().int().min(0).optional(),
    quadrant_id: z.coerce.number().int().positive().optional(),
    quadrant_text: z.string().optional(),
    notes: z.string().optional(),
  })).optional(),

  site_observations: z.array(z.object({
    location_type_id: z.coerce.number().int().positive(),
    species_id: z.coerce.number().int().positive().optional(),
    species_text: z.string().optional(),
    quantity: z.coerce.number().int().min(0).optional(),
    quadrant_id: z.coerce.number().int().positive().optional(),
    quadrant_text: z.string().optional(),
    notes: z.string().optional(),
  })).optional(),

  nests: z.array(z.object({
    area_type: z.enum(['aerodrome', 'site']),
    location_text: z.string(),
    quadrant_id: z.coerce.number().int().positive().optional(),
    quadrant_text: z.string().optional(),
    has_eggs: z.boolean().optional(),
    egg_count: z.coerce.number().int().min(0).optional(),
    notes: z.string().optional(),
  })).optional(),

  carcasses: z.array(z.object({
    location_text: z.string(),
    quadrant_id: z.coerce.number().int().positive().optional(),
    quadrant_text: z.string().optional(),
    photographed: z.boolean().optional(),
    species_id: z.coerce.number().int().positive().optional(),
    species_text: z.string().optional(),
    destination_id: z.coerce.number().int().positive().optional(),
    notes: z.string().optional(),
  })).optional(),

  management: z.object({
    dispersal_performed: z.boolean().optional(),
    capture_performed: z.boolean().optional(),
    species_involved: z.string().optional(),
    capture_destination: z.string().optional(),
    notes: z.string().optional(),
    techniques: z.array(z.coerce.number().int().positive()).optional(),
  }).optional(),
});

export async function dailyInspectionsRoutes(app: FastifyInstance) {

  // GET /api/inspecoes-diarias - Listar inspeções diárias
  app.get('/api/inspecoes-diarias', async (request, reply) => {
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
             p.name AS period_name,
             w.name AS weather_name,
             u.name AS user_name,
             (SELECT json_agg(json_build_object(
               'observation_id', obs.observation_id,
               'location_type_id', obs.location_type_id,
               'location_type_name', lt.name,
               'species_id', obs.species_id,
               'species_name', s.common_name,
               'species_text', obs.species_text,
               'quantity', obs.quantity,
               'quadrant_id', obs.quadrant_id,
               'quadrant_code', q.code,
               'quadrant_text', obs.quadrant_text,
               'notes', obs.notes
             ))
             FROM wildlife.fact_daily_inspection_aerodrome_area obs
             LEFT JOIN wildlife.lu_inspection_location_type lt ON lt.location_type_id = obs.location_type_id
             LEFT JOIN wildlife.dim_species s ON s.species_id = obs.species_id
             LEFT JOIN wildlife.lu_quadrant q ON q.quadrant_id = obs.quadrant_id
             WHERE obs.inspection_id = i.inspection_id) AS aerodrome_observations,

             (SELECT json_agg(json_build_object(
               'observation_id', obs.observation_id,
               'location_type_id', obs.location_type_id,
               'location_type_name', lt.name,
               'species_id', obs.species_id,
               'species_name', s.common_name,
               'species_text', obs.species_text,
               'quantity', obs.quantity,
               'quadrant_id', obs.quadrant_id,
               'quadrant_code', q.code,
               'quadrant_text', obs.quadrant_text,
               'notes', obs.notes
             ))
             FROM wildlife.fact_daily_inspection_site_area obs
             LEFT JOIN wildlife.lu_inspection_location_type lt ON lt.location_type_id = obs.location_type_id
             LEFT JOIN wildlife.dim_species s ON s.species_id = obs.species_id
             LEFT JOIN wildlife.lu_quadrant q ON q.quadrant_id = obs.quadrant_id
             WHERE obs.inspection_id = i.inspection_id) AS site_observations,

             (SELECT json_agg(json_build_object(
               'nest_id', n.nest_id,
               'area_type', n.area_type,
               'location_text', n.location_text,
               'quadrant_id', n.quadrant_id,
               'quadrant_code', q.code,
               'quadrant_text', n.quadrant_text,
               'has_eggs', n.has_eggs,
               'egg_count', n.egg_count,
               'notes', n.notes
             ))
             FROM wildlife.fact_daily_inspection_nest n
             LEFT JOIN wildlife.lu_quadrant q ON q.quadrant_id = n.quadrant_id
             WHERE n.inspection_id = i.inspection_id) AS nests,

             (SELECT json_agg(json_build_object(
               'carcass_id', c.carcass_id,
               'location_text', c.location_text,
               'quadrant_id', c.quadrant_id,
               'quadrant_code', q.code,
               'quadrant_text', c.quadrant_text,
               'photographed', c.photographed,
               'species_id', c.species_id,
               'species_name', s.common_name,
               'species_text', c.species_text,
               'destination_id', c.destination_id,
               'destination_name', d.name,
               'notes', c.notes
             ))
             FROM wildlife.fact_daily_inspection_carcass c
             LEFT JOIN wildlife.lu_quadrant q ON q.quadrant_id = c.quadrant_id
             LEFT JOIN wildlife.dim_species s ON s.species_id = c.species_id
             LEFT JOIN wildlife.lu_carcass_destination d ON d.destination_id = c.destination_id
             WHERE c.inspection_id = i.inspection_id) AS carcasses,

             (SELECT json_build_object(
               'management_id', m.management_id,
               'dispersal_performed', m.dispersal_performed,
               'capture_performed', m.capture_performed,
               'species_involved', m.species_involved,
               'capture_destination', m.capture_destination,
               'notes', m.notes,
               'techniques', (
                 SELECT json_agg(json_build_object(
                   'technique_id', mt.technique_id,
                   'technique_name', t.name
                 ))
                 FROM wildlife.fact_daily_inspection_management_technique mt
                 JOIN wildlife.lu_management_technique t ON t.technique_id = mt.technique_id
                 WHERE mt.management_id = m.management_id
               )
             )
             FROM wildlife.fact_daily_inspection_management m
             WHERE m.inspection_id = i.inspection_id) AS management

      FROM wildlife.fact_daily_inspection i
      LEFT JOIN wildlife.airport a ON a.airport_id = i.airport_id
      LEFT JOIN wildlife.lu_inspection_period p ON p.period_id = i.period_id
      LEFT JOIN wildlife.lu_weather_condition w ON w.weather_id = i.weather_id
      LEFT JOIN wildlife.app_user u ON u.user_id = i.reported_by_user_id
      WHERE 1=1 ${whereClause}
      ORDER BY i.inspection_date DESC, i.inspection_time DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const result = await db.query(query, params);

    // Count total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM wildlife.fact_daily_inspection i
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

  // GET /api/inspecoes-diarias/:id - Buscar uma inspeção específica
  app.get('/api/inspecoes-diarias/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const inspectionId = parseInt(id);

    const query = `
      SELECT i.*,
             a.icao_code,
             a.name AS airport_name,
             p.name AS period_name,
             w.name AS weather_name,
             u.name AS user_name,
             (SELECT json_agg(json_build_object(
               'observation_id', obs.observation_id,
               'location_type_id', obs.location_type_id,
               'location_type_name', lt.name,
               'species_id', obs.species_id,
               'species_name', s.common_name,
               'species_text', obs.species_text,
               'quantity', obs.quantity,
               'quadrant_id', obs.quadrant_id,
               'quadrant_code', q.code,
               'quadrant_text', obs.quadrant_text,
               'notes', obs.notes
             ))
             FROM wildlife.fact_daily_inspection_aerodrome_area obs
             LEFT JOIN wildlife.lu_inspection_location_type lt ON lt.location_type_id = obs.location_type_id
             LEFT JOIN wildlife.dim_species s ON s.species_id = obs.species_id
             LEFT JOIN wildlife.lu_quadrant q ON q.quadrant_id = obs.quadrant_id
             WHERE obs.inspection_id = i.inspection_id) AS aerodrome_observations,

             (SELECT json_agg(json_build_object(
               'observation_id', obs.observation_id,
               'location_type_id', obs.location_type_id,
               'location_type_name', lt.name,
               'species_id', obs.species_id,
               'species_name', s.common_name,
               'species_text', obs.species_text,
               'quantity', obs.quantity,
               'quadrant_id', obs.quadrant_id,
               'quadrant_code', q.code,
               'quadrant_text', obs.quadrant_text,
               'notes', obs.notes
             ))
             FROM wildlife.fact_daily_inspection_site_area obs
             LEFT JOIN wildlife.lu_inspection_location_type lt ON lt.location_type_id = obs.location_type_id
             LEFT JOIN wildlife.dim_species s ON s.species_id = obs.species_id
             LEFT JOIN wildlife.lu_quadrant q ON q.quadrant_id = obs.quadrant_id
             WHERE obs.inspection_id = i.inspection_id) AS site_observations,

             (SELECT json_agg(json_build_object(
               'nest_id', n.nest_id,
               'area_type', n.area_type,
               'location_text', n.location_text,
               'quadrant_id', n.quadrant_id,
               'quadrant_code', q.code,
               'quadrant_text', n.quadrant_text,
               'has_eggs', n.has_eggs,
               'egg_count', n.egg_count,
               'notes', n.notes
             ))
             FROM wildlife.fact_daily_inspection_nest n
             LEFT JOIN wildlife.lu_quadrant q ON q.quadrant_id = n.quadrant_id
             WHERE n.inspection_id = i.inspection_id) AS nests,

             (SELECT json_agg(json_build_object(
               'carcass_id', c.carcass_id,
               'location_text', c.location_text,
               'quadrant_id', c.quadrant_id,
               'quadrant_code', q.code,
               'quadrant_text', c.quadrant_text,
               'photographed', c.photographed,
               'species_id', c.species_id,
               'species_name', s.common_name,
               'species_text', c.species_text,
               'destination_id', c.destination_id,
               'destination_name', d.name,
               'notes', c.notes
             ))
             FROM wildlife.fact_daily_inspection_carcass c
             LEFT JOIN wildlife.lu_quadrant q ON q.quadrant_id = c.quadrant_id
             LEFT JOIN wildlife.dim_species s ON s.species_id = c.species_id
             LEFT JOIN wildlife.lu_carcass_destination d ON d.destination_id = c.destination_id
             WHERE c.inspection_id = i.inspection_id) AS carcasses,

             (SELECT json_build_object(
               'management_id', m.management_id,
               'dispersal_performed', m.dispersal_performed,
               'capture_performed', m.capture_performed,
               'species_involved', m.species_involved,
               'capture_destination', m.capture_destination,
               'notes', m.notes,
               'techniques', (
                 SELECT json_agg(json_build_object(
                   'technique_id', mt.technique_id,
                   'technique_name', t.name
                 ))
                 FROM wildlife.fact_daily_inspection_management_technique mt
                 JOIN wildlife.lu_management_technique t ON t.technique_id = mt.technique_id
                 WHERE mt.management_id = m.management_id
               )
             )
             FROM wildlife.fact_daily_inspection_management m
             WHERE m.inspection_id = i.inspection_id) AS management

      FROM wildlife.fact_daily_inspection i
      LEFT JOIN wildlife.airport a ON a.airport_id = i.airport_id
      LEFT JOIN wildlife.lu_inspection_period p ON p.period_id = i.period_id
      LEFT JOIN wildlife.lu_weather_condition w ON w.weather_id = i.weather_id
      LEFT JOIN wildlife.app_user u ON u.user_id = i.reported_by_user_id
      WHERE i.inspection_id = $1
    `;

    const result = await db.query(query, [inspectionId]);

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Inspeção não encontrada' });
    }

    return result.rows[0];
  });

  // POST /api/inspecoes-diarias - Criar nova inspeção
  app.post('/api/inspecoes-diarias', async (request, reply) => {
    const validated = dailyInspectionSchema.parse(request.body);

    const result = await db.transaction(async (client) => {
      // Insert main inspection record
      const inspectionResult = await client.query(`
        INSERT INTO wildlife.fact_daily_inspection (
          airport_id, inspection_date, inspection_time, period_id, period_text,
          collision_occurred, collision_species, weather_id, mandatory_report,
          inspector_name, inspector_team, reported_by_user_id, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING inspection_id
      `, [
        validated.airport_id,
        validated.inspection_date,
        validated.inspection_time,
        validated.period_id ?? null,
        validated.period_text ?? null,
        validated.collision_occurred ?? false,
        validated.collision_species ?? null,
        validated.weather_id ?? null,
        validated.mandatory_report ?? false,
        validated.inspector_name ?? null,
        validated.inspector_team ?? null,
        validated.reported_by_user_id ?? null,
        validated.notes ?? null,
      ]);

      const inspectionId = inspectionResult.rows[0].inspection_id;

      // Insert aerodrome observations
      if (validated.aerodrome_observations && validated.aerodrome_observations.length > 0) {
        for (const obs of validated.aerodrome_observations) {
          await client.query(`
            INSERT INTO wildlife.fact_daily_inspection_aerodrome_area (
              inspection_id, location_type_id, species_id, species_text,
              quantity, quadrant_id, quadrant_text, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            inspectionId,
            obs.location_type_id,
            obs.species_id ?? null,
            obs.species_text ?? null,
            obs.quantity ?? null,
            obs.quadrant_id ?? null,
            obs.quadrant_text ?? null,
            obs.notes ?? null,
          ]);
        }
      }

      // Insert site observations
      if (validated.site_observations && validated.site_observations.length > 0) {
        for (const obs of validated.site_observations) {
          await client.query(`
            INSERT INTO wildlife.fact_daily_inspection_site_area (
              inspection_id, location_type_id, species_id, species_text,
              quantity, quadrant_id, quadrant_text, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            inspectionId,
            obs.location_type_id,
            obs.species_id ?? null,
            obs.species_text ?? null,
            obs.quantity ?? null,
            obs.quadrant_id ?? null,
            obs.quadrant_text ?? null,
            obs.notes ?? null,
          ]);
        }
      }

      // Insert nests
      if (validated.nests && validated.nests.length > 0) {
        for (const nest of validated.nests) {
          await client.query(`
            INSERT INTO wildlife.fact_daily_inspection_nest (
              inspection_id, area_type, location_text, quadrant_id,
              quadrant_text, has_eggs, egg_count, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            inspectionId,
            nest.area_type,
            nest.location_text,
            nest.quadrant_id ?? null,
            nest.quadrant_text ?? null,
            nest.has_eggs ?? false,
            nest.egg_count ?? null,
            nest.notes ?? null,
          ]);
        }
      }

      // Insert carcasses
      if (validated.carcasses && validated.carcasses.length > 0) {
        for (const carcass of validated.carcasses) {
          await client.query(`
            INSERT INTO wildlife.fact_daily_inspection_carcass (
              inspection_id, location_text, quadrant_id, quadrant_text,
              photographed, species_id, species_text, destination_id, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            inspectionId,
            carcass.location_text,
            carcass.quadrant_id ?? null,
            carcass.quadrant_text ?? null,
            carcass.photographed ?? false,
            carcass.species_id ?? null,
            carcass.species_text ?? null,
            carcass.destination_id ?? null,
            carcass.notes ?? null,
          ]);
        }
      }

      // Insert management actions
      if (validated.management) {
        const mgmtResult = await client.query(`
          INSERT INTO wildlife.fact_daily_inspection_management (
            inspection_id, dispersal_performed, capture_performed,
            species_involved, capture_destination, notes
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING management_id
        `, [
          inspectionId,
          validated.management.dispersal_performed ?? false,
          validated.management.capture_performed ?? false,
          validated.management.species_involved ?? null,
          validated.management.capture_destination ?? null,
          validated.management.notes ?? null,
        ]);

        const managementId = mgmtResult.rows[0].management_id;

        // Insert management techniques
        if (validated.management.techniques && validated.management.techniques.length > 0) {
          for (const techniqueId of validated.management.techniques) {
            await client.query(`
              INSERT INTO wildlife.fact_daily_inspection_management_technique (
                management_id, technique_id
              ) VALUES ($1, $2)
            `, [managementId, techniqueId]);
          }
        }
      }

      return inspectionId;
    });

    return reply.status(201).send({ inspection_id: result });
  });

  // PUT /api/inspecoes-diarias/:id - Atualizar inspeção
  app.put('/api/inspecoes-diarias/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const inspectionId = parseInt(id);
    const validated = dailyInspectionSchema.parse(request.body);

    await db.transaction(async (client) => {
      // Update main inspection record
      await client.query(`
        UPDATE wildlife.fact_daily_inspection
        SET airport_id = $1, inspection_date = $2, inspection_time = $3,
            period_id = $4, period_text = $5, collision_occurred = $6,
            collision_species = $7, weather_id = $8, mandatory_report = $9,
            inspector_name = $10, inspector_team = $11, reported_by_user_id = $12,
            notes = $13, updated_at = now()
        WHERE inspection_id = $14
      `, [
        validated.airport_id,
        validated.inspection_date,
        validated.inspection_time,
        validated.period_id ?? null,
        validated.period_text ?? null,
        validated.collision_occurred ?? false,
        validated.collision_species ?? null,
        validated.weather_id ?? null,
        validated.mandatory_report ?? false,
        validated.inspector_name ?? null,
        validated.inspector_team ?? null,
        validated.reported_by_user_id ?? null,
        validated.notes ?? null,
        inspectionId,
      ]);

      // Delete existing nested records and re-insert
      await client.query('DELETE FROM wildlife.fact_daily_inspection_aerodrome_area WHERE inspection_id = $1', [inspectionId]);
      await client.query('DELETE FROM wildlife.fact_daily_inspection_site_area WHERE inspection_id = $1', [inspectionId]);
      await client.query('DELETE FROM wildlife.fact_daily_inspection_nest WHERE inspection_id = $1', [inspectionId]);
      await client.query('DELETE FROM wildlife.fact_daily_inspection_carcass WHERE inspection_id = $1', [inspectionId]);

      // Delete management (will cascade to techniques)
      await client.query('DELETE FROM wildlife.fact_daily_inspection_management WHERE inspection_id = $1', [inspectionId]);

      // Re-insert aerodrome observations
      if (validated.aerodrome_observations && validated.aerodrome_observations.length > 0) {
        for (const obs of validated.aerodrome_observations) {
          await client.query(`
            INSERT INTO wildlife.fact_daily_inspection_aerodrome_area (
              inspection_id, location_type_id, species_id, species_text,
              quantity, quadrant_id, quadrant_text, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            inspectionId,
            obs.location_type_id,
            obs.species_id ?? null,
            obs.species_text ?? null,
            obs.quantity ?? null,
            obs.quadrant_id ?? null,
            obs.quadrant_text ?? null,
            obs.notes ?? null,
          ]);
        }
      }

      // Re-insert site observations
      if (validated.site_observations && validated.site_observations.length > 0) {
        for (const obs of validated.site_observations) {
          await client.query(`
            INSERT INTO wildlife.fact_daily_inspection_site_area (
              inspection_id, location_type_id, species_id, species_text,
              quantity, quadrant_id, quadrant_text, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            inspectionId,
            obs.location_type_id,
            obs.species_id ?? null,
            obs.species_text ?? null,
            obs.quantity ?? null,
            obs.quadrant_id ?? null,
            obs.quadrant_text ?? null,
            obs.notes ?? null,
          ]);
        }
      }

      // Re-insert nests
      if (validated.nests && validated.nests.length > 0) {
        for (const nest of validated.nests) {
          await client.query(`
            INSERT INTO wildlife.fact_daily_inspection_nest (
              inspection_id, area_type, location_text, quadrant_id,
              quadrant_text, has_eggs, egg_count, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            inspectionId,
            nest.area_type,
            nest.location_text,
            nest.quadrant_id ?? null,
            nest.quadrant_text ?? null,
            nest.has_eggs ?? false,
            nest.egg_count ?? null,
            nest.notes ?? null,
          ]);
        }
      }

      // Re-insert carcasses
      if (validated.carcasses && validated.carcasses.length > 0) {
        for (const carcass of validated.carcasses) {
          await client.query(`
            INSERT INTO wildlife.fact_daily_inspection_carcass (
              inspection_id, location_text, quadrant_id, quadrant_text,
              photographed, species_id, species_text, destination_id, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            inspectionId,
            carcass.location_text,
            carcass.quadrant_id ?? null,
            carcass.quadrant_text ?? null,
            carcass.photographed ?? false,
            carcass.species_id ?? null,
            carcass.species_text ?? null,
            carcass.destination_id ?? null,
            carcass.notes ?? null,
          ]);
        }
      }

      // Re-insert management actions
      if (validated.management) {
        const mgmtResult = await client.query(`
          INSERT INTO wildlife.fact_daily_inspection_management (
            inspection_id, dispersal_performed, capture_performed,
            species_involved, capture_destination, notes
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING management_id
        `, [
          inspectionId,
          validated.management.dispersal_performed ?? false,
          validated.management.capture_performed ?? false,
          validated.management.species_involved ?? null,
          validated.management.capture_destination ?? null,
          validated.management.notes ?? null,
        ]);

        const managementId = mgmtResult.rows[0].management_id;

        // Re-insert management techniques
        if (validated.management.techniques && validated.management.techniques.length > 0) {
          for (const techniqueId of validated.management.techniques) {
            await client.query(`
              INSERT INTO wildlife.fact_daily_inspection_management_technique (
                management_id, technique_id
              ) VALUES ($1, $2)
            `, [managementId, techniqueId]);
          }
        }
      }
    });

    return { message: 'Inspeção atualizada com sucesso' };
  });

  // DELETE /api/inspecoes-diarias/:id - Remover inspeção
  app.delete('/api/inspecoes-diarias/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const inspectionId = parseInt(id);

    await db.query('DELETE FROM wildlife.fact_daily_inspection WHERE inspection_id = $1', [inspectionId]);

    return { message: 'Inspeção removida com sucesso' };
  });
}
