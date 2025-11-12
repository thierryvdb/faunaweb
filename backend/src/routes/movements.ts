import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../services/db';

const corpo = z.object({
  airport_id: z.coerce.number(),
  date_utc: z.string(),
  time_local: z.string().optional(),
  movement_type: z.enum(['Pouso', 'Decolagem']).optional(),
  runway: z.string().optional(),
  aircraft_type: z.string().optional(),
  engine_type_id: z.coerce.number().optional(),
  movements_in_day: z.coerce.number().min(0).optional()
});

const paramsId = z.object({ id: z.coerce.number() });

export async function movementsRoutes(app: FastifyInstance) {
  app.get('/api/movimentos', async (request) => {
    const querySchema = z.object({
      airportId: z.coerce.number().optional(),
      inicio: z.string().optional(),
      fim: z.string().optional(),
      pagina: z.coerce.number().optional().default(1),
      limite: z.coerce.number().optional().default(50)
    });
    const filtros = querySchema.parse(request.query ?? {});
    const condicoes: string[] = [];
    const valores: any[] = [];
    if (filtros.airportId) {
      condicoes.push(`airport_id=$${condicoes.length + 1}`);
      valores.push(filtros.airportId);
    }
    if (filtros.inicio) {
      condicoes.push(`date_utc >= $${condicoes.length + 1}`);
      valores.push(filtros.inicio);
    }
    if (filtros.fim) {
      condicoes.push(`date_utc <= $${condicoes.length + 1}`);
      valores.push(filtros.fim);
    }
    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    const offset = (filtros.pagina - 1) * filtros.limite;
    valores.push(filtros.limite, offset);
    const { rows } = await db.query(
      `SELECT movement_id AS id, airport_id, date_utc, time_local, movement_type, runway, aircraft_type, engine_type_id, movements_in_day
       FROM wildlife.fact_movement
       ${where}
       ORDER BY date_utc DESC, time_local DESC NULLS LAST
       LIMIT $${valores.length - 1} OFFSET $${valores.length}`,
      valores
    );
    return rows;
  });

  app.post('/api/movimentos', async (request, reply) => {
    const body = corpo.parse(request.body);
    const { rows } = await db.query(
      `INSERT INTO wildlife.fact_movement (airport_id, date_utc, time_local, movement_type, runway, aircraft_type, engine_type_id, movements_in_day)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING movement_id AS id, airport_id, date_utc, time_local, movement_type, runway, aircraft_type, engine_type_id, movements_in_day`,
      [
        body.airport_id,
        body.date_utc,
        body.time_local ?? null,
        body.movement_type ?? null,
        body.runway ?? null,
        body.aircraft_type ?? null,
        body.engine_type_id ?? null,
        body.movements_in_day ?? null
      ]
    );
    return reply.code(201).send(rows[0]);
  });

  app.put('/api/movimentos/:id', async (request, reply) => {
    const { id } = paramsId.parse(request.params);
    const body = corpo.partial().parse(request.body ?? {});
    const pares = Object.entries(body).filter(([, valor]) => valor !== undefined);
    if (!pares.length) {
      return reply.code(400).send({ mensagem: 'Informe dados para atualizar' });
    }
    const sets = pares.map(([campo], idx) => `${campo}=$${idx + 1}`);
    const valores = pares.map(([, valor]) => valor);
    valores.push(id);
    const { rows } = await db.query(
      `UPDATE wildlife.fact_movement SET ${sets.join(', ')}, updated_at=now() WHERE movement_id=$${pares.length + 1}
       RETURNING movement_id AS id, airport_id, date_utc, time_local, movement_type, runway, aircraft_type, engine_type_id, movements_in_day`,
      valores
    );
    if (!rows[0]) {
      return reply.code(404).send({ mensagem: 'Movimento nao encontrado' });
    }
    return rows[0];
  });

  app.delete('/api/movimentos/:id', async (request, reply) => {
    const { id } = paramsId.parse(request.params);
    await db.query('DELETE FROM wildlife.fact_movement WHERE movement_id=$1', [id]);
    return reply.code(204).send();
  });
}
