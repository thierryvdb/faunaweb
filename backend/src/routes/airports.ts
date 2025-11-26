import { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../services/db';

const aeroportoSchema = z.object({
  icao_code: z.string().length(4).transform((v) => v.toUpperCase()),
  iata_code: z.string().length(3).optional().transform((v) => v?.toUpperCase()),
  name: z.string().min(3),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default('Brasil'),
  latitude_dec: z.number().min(-90).max(90).optional(),
  longitude_dec: z.number().min(-180).max(180).optional(),
  elevation_ft: z.number().optional()
});

const paramsSchema = z.object({ id: z.coerce.number() });

export async function airportsRoutes(app: FastifyInstance) {
  app.get('/aeroportos', async (request) => {
    const userAirportId = (request as any).user.airport_id as number;
    const { rows } = await db.query(
      `SELECT airport_id AS id, icao_code, iata_code, name, city, state, country, latitude_dec, longitude_dec, elevation_ft
       FROM wildlife.airport WHERE airport_id=$1
       ORDER BY name`,
      [userAirportId]
    );
    return rows;
  });

  app.get('/aeroportos/:id', async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const userAirportId = (request as any).user.airport_id as number;
    if (id !== userAirportId) {
      return reply.code(403).send({ mensagem: 'Acesso negado a este aeroporto' });
    }
    const { rows } = await db.query(
      'SELECT airport_id AS id, icao_code, iata_code, name, city, state, country, latitude_dec, longitude_dec, elevation_ft FROM wildlife.airport WHERE airport_id=$1',
      [id]
    );
    return ensureEncontrado(rows[0], reply);
  });

  app.post('/aeroportos', async (request, reply) => {
    const body = aeroportoSchema.parse(request.body);
    const { rows } = await db.query(
      `INSERT INTO wildlife.airport (icao_code, iata_code, name, city, state, country, latitude_dec, longitude_dec, elevation_ft)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING airport_id AS id, icao_code, iata_code, name, city, state, country, latitude_dec, longitude_dec, elevation_ft`,
      [
        body.icao_code,
        body.iata_code ?? null,
        body.name,
        body.city ?? null,
        body.state ?? null,
        body.country,
        body.latitude_dec ?? null,
        body.longitude_dec ?? null,
        body.elevation_ft ?? null
      ]
    );
    return reply.code(201).send(rows[0]);
  });

  app.put('/aeroportos/:id', async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const body = aeroportoSchema.partial().parse(request.body ?? {});
    const pares = Object.entries(body).filter(([, valor]) => valor !== undefined);
    if (pares.length === 0) {
      return reply.code(400).send({ mensagem: 'Informe ao menos um campo para atualizar' });
    }
    const sets = pares.map(([campo], idx) => `${campo}=$${idx + 1}`);
    const valores = pares.map(([, valor]) => valor);
    valores.push(id);
    const { rows } = await db.query(
      `UPDATE wildlife.airport SET ${sets.join(', ')}, updated_at=now() WHERE airport_id=$${pares.length + 1}
       RETURNING airport_id AS id, icao_code, iata_code, name, city, state, country, latitude_dec, longitude_dec, elevation_ft`,
      valores
    );
    return ensureEncontrado(rows[0], reply);
  });

  app.delete('/aeroportos/:id', async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    await db.query('DELETE FROM wildlife.airport WHERE airport_id=$1', [id]);
    return reply.code(204).send();
  });
}

function ensureEncontrado<T>(registro: T | undefined, reply: FastifyReply) {
  if (!registro) {
    return reply.code(404).send({ mensagem: 'Registro nao encontrado' });
  }
  return registro;
}
