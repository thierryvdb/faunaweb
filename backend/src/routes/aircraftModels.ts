import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../services/db';

const baseSchema = z.object({
  manufacturer: z.string().min(1),
  model: z.string().min(1),
  nickname: z.string().optional(),
  category: z.string().optional(),
  engine_type_id: z.preprocess(
    (val) => (val === '' || val === undefined ? undefined : val),
    z.coerce.number().int().positive().optional()
  ),
  wingspan_m: z.preprocess(
    (val) => (val === '' || val === undefined ? undefined : val),
    z.coerce.number().nonnegative().optional()
  ),
  length_m: z.preprocess(
    (val) => (val === '' || val === undefined ? undefined : val),
    z.coerce.number().nonnegative().optional()
  ),
  height_m: z.preprocess(
    (val) => (val === '' || val === undefined ? undefined : val),
    z.coerce.number().nonnegative().optional()
  ),
  seating_capacity: z.preprocess(
    (val) => (val === '' || val === undefined ? undefined : val),
    z.coerce.number().int().nonnegative().optional()
  ),
  mtow_kg: z.preprocess(
    (val) => (val === '' || val === undefined ? undefined : val),
    z.coerce.number().nonnegative().optional()
  ),
  notes: z.string().optional()
});

const paramsId = z.object({ id: z.coerce.number().int().positive() });

function serialize(row: any) {
  return {
    id: Number(row.aircraft_model_id),
    manufacturer: row.manufacturer,
    model: row.model,
    nickname: row.nickname,
    category: row.category,
    engine_type_id: row.engine_type_id ? Number(row.engine_type_id) : null,
    wingspan_m: row.wingspan_m ? Number(row.wingspan_m) : null,
    length_m: row.length_m ? Number(row.length_m) : null,
    height_m: row.height_m ? Number(row.height_m) : null,
    seating_capacity: row.seating_capacity ? Number(row.seating_capacity) : null,
    mtow_kg: row.mtow_kg ? Number(row.mtow_kg) : null,
    notes: row.notes
  };
}

export async function aircraftModelsRoutes(app: FastifyInstance) {
  app.get('/aeronaves', async () => {
    const { rows } = await db.query(
      `SELECT aircraft_model_id, manufacturer, model, nickname, category, engine_type_id,
              wingspan_m, length_m, height_m, seating_capacity, mtow_kg, notes
         FROM wildlife.lu_aircraft_model
        ORDER BY manufacturer, model`
    );
    return rows.map(serialize);
  });

  app.post('/aeronaves', async (request, reply) => {
    const body = baseSchema.parse(request.body ?? {});
    const { rows } = await db.query(
      `INSERT INTO wildlife.lu_aircraft_model
         (manufacturer, model, nickname, category, engine_type_id, wingspan_m, length_m, height_m, seating_capacity, mtow_kg, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING aircraft_model_id, manufacturer, model, nickname, category, engine_type_id,
                 wingspan_m, length_m, height_m, seating_capacity, mtow_kg, notes`,
      [
        body.manufacturer,
        body.model,
        body.nickname ?? null,
        body.category ?? null,
        body.engine_type_id ?? null,
        body.wingspan_m ?? null,
        body.length_m ?? null,
        body.height_m ?? null,
        body.seating_capacity ?? null,
        body.mtow_kg ?? null,
        body.notes ?? null
      ]
    );
    return reply.code(201).send(serialize(rows[0]));
  });

  app.put('/aeronaves/:id', async (request, reply) => {
    const { id } = paramsId.parse(request.params);
    const body = baseSchema.partial().refine((dados) => Object.keys(dados).length > 0, {
      message: 'Informe campos para atualizar'
    }).parse(request.body ?? {});

    const campos = Object.entries(body);
    if (!campos.length) {
      return reply.code(400).send({ mensagem: 'Informe campos para atualizar' });
    }
    const sets = campos.map(([chave], idx) => `${chave}=$${idx + 1}`);
    const valores = campos.map(([, valor]) => (valor ?? null));
    valores.push(id);
    const { rowCount, rows } = await db.query(
      `UPDATE wildlife.lu_aircraft_model SET ${sets.join(', ')}, updated_at=now()
        WHERE aircraft_model_id=$${campos.length + 1}
        RETURNING aircraft_model_id, manufacturer, model, nickname, category, engine_type_id,
                  wingspan_m, length_m, height_m, seating_capacity, mtow_kg, notes`,
      valores
    );
    if (!rowCount) {
      return reply.code(404).send({ mensagem: 'Aeronave nao encontrada' });
    }
    return serialize(rows[0]);
  });

  app.delete('/aeronaves/:id', async (request, reply) => {
    const { id } = paramsId.parse(request.params);
    await db.query('DELETE FROM wildlife.lu_aircraft_model WHERE aircraft_model_id=$1', [id]);
    return reply.code(204).send();
  });
}
