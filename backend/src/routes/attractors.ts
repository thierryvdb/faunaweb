import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../services/db';

const corpo = z.object({
  airport_id: z.coerce.number(),
  date_utc: z.string(),
  latitude_dec: z.number().optional(),
  longitude_dec: z.number().optional(),
  attractor_type_id: z.coerce.number().optional(),
  description: z.string().optional(),
  distance_m_runway: z.number().min(0).optional(),
  status: z.enum(['ativo', 'mitigando', 'resolvido']).optional(),
  responsible_org: z.string().optional()
});

const paramsId = z.object({ id: z.coerce.number() });

export async function attractorsRoutes(app: FastifyInstance) {
  app.get('/api/atrativos', async (request) => {
    const querySchema = z.object({ airportId: z.coerce.number().optional(), status: z.string().optional() });
    const filtros = querySchema.parse(request.query ?? {});
    const condicoes: string[] = [];
    const valores: any[] = [];
    if (filtros.airportId) {
      condicoes.push(`airport_id=$${condicoes.length + 1}`);
      valores.push(filtros.airportId);
    }
    if (filtros.status) {
      condicoes.push(`status=$${condicoes.length + 1}`);
      valores.push(filtros.status);
    }
    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT attractor_id AS id, airport_id, date_utc, latitude_dec, longitude_dec, attractor_type_id,
              description, distance_m_runway, status, responsible_org
       FROM wildlife.fact_attractor
       ${where}
       ORDER BY date_utc DESC`,
      valores
    );
    return rows;
  });

  app.post('/api/atrativos', async (request, reply) => {
    const body = corpo.parse(request.body);
    const { rows } = await db.query(
      `INSERT INTO wildlife.fact_attractor (airport_id, date_utc, latitude_dec, longitude_dec, attractor_type_id,
        description, distance_m_runway, status, responsible_org)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING attractor_id AS id`,
      [
        body.airport_id,
        body.date_utc,
        body.latitude_dec ?? null,
        body.longitude_dec ?? null,
        body.attractor_type_id ?? null,
        body.description ?? null,
        body.distance_m_runway ?? null,
        body.status ?? null,
        body.responsible_org ?? null
      ]
    );
    return reply.code(201).send(rows[0]);
  });

  app.put('/api/atrativos/:id', async (request, reply) => {
    const { id } = paramsId.parse(request.params);
    const body = corpo.partial().parse(request.body ?? {});
    const pares = Object.entries(body).filter(([, valor]) => valor !== undefined);
    if (!pares.length) {
      return reply.code(400).send({ mensagem: 'Informe dados para atualizar' });
    }
    const sets = pares.map(([campo], idx) => `${campo}=$${idx + 1}`);
    const valores = pares.map(([, valor]) => valor);
    valores.push(id);
    const { rowCount } = await db.query(
      `UPDATE wildlife.fact_attractor SET ${sets.join(', ')}, updated_at=now() WHERE attractor_id=$${pares.length + 1}`,
      valores
    );
    if (!rowCount) {
      return reply.code(404).send({ mensagem: 'Atrativo nao encontrado' });
    }
    return { id };
  });

  app.delete('/api/atrativos/:id', async (request, reply) => {
    const { id } = paramsId.parse(request.params);
    await db.query('DELETE FROM wildlife.fact_attractor WHERE attractor_id=$1', [id]);
    return reply.code(204).send();
  });
}
