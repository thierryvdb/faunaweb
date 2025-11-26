import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../services/db';

const baseUserSchema = z.object({
  name: z.string().min(2),
  username: z.string().min(3),
  primary_airport_id: z.coerce.number(),
  airport_ids: z.array(z.coerce.number()).min(1),
  active: z.boolean().optional()
});

const updateUserSchema = baseUserSchema.partial({
  name: true,
  username: true,
  primary_airport_id: true,
  airport_ids: true,
  active: true
});

const DEFAULT_PASSWORD = 'fauna1';
const bulkResetSchema = z.object({
  user_ids: z.array(z.coerce.number()).min(1)
});

export async function usersRoutes(app: FastifyInstance) {
  const ensureAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
    await app.authenticate(request, reply);
  };

  app.get(
    '/usuarios',
    { preHandler: ensureAdmin },
    async () => {
      const { rows } = await db.query(
        `SELECT u.user_id,
                u.name,
                u.username,
                u.active,
                u.must_reset_password,
                u.airport_id AS primary_airport_id,
                COALESCE(json_agg(json_build_object('id', a.airport_id, 'icao', a.icao_code, 'name', a.name))
                         FILTER (WHERE a.airport_id IS NOT NULL), '[]'::json) AS aeroportos
         FROM wildlife.app_user u
         LEFT JOIN wildlife.app_user_airport ua ON ua.user_id = u.user_id
         LEFT JOIN wildlife.airport a ON a.airport_id = ua.airport_id
         GROUP BY u.user_id
         ORDER BY u.name`
      );
      return rows;
    }
  );

app.post(
  '/usuarios',
  { preHandler: ensureAdmin },
  async (request, reply) => {
      const body = baseUserSchema.parse(request.body);
      const airports = Array.from(new Set(body.airport_ids));
      if (!airports.includes(body.primary_airport_id)) {
        airports.unshift(body.primary_airport_id);
      }
      const userId = await db.transaction(async (client) => {
        const inserted = await client.query(
          `INSERT INTO wildlife.app_user (name, username, password_hash, airport_id, active, must_reset_password)
           VALUES ($1,$2,crypt($3, gen_salt('bf')),$4,$5,TRUE)
           RETURNING user_id`,
          [body.name, body.username, DEFAULT_PASSWORD, body.primary_airport_id, body.active ?? true]
        );
        const newId = inserted.rows[0].user_id;
        await client.query('DELETE FROM wildlife.app_user_airport WHERE user_id=$1', [newId]);
        await client.query(
          `INSERT INTO wildlife.app_user_airport (user_id, airport_id)
           SELECT $1, unnest($2::bigint[])`,
          [newId, airports]
        );
        return newId;
      });
      return reply.code(201).send({ id: userId });
    }
  );

app.put(
  '/usuarios/:id',
  { preHandler: ensureAdmin },
  async (request, reply) => {
    const id = Number((request.params as any).id);
      if (!id) {
        return reply.code(400).send({ mensagem: 'ID inválido' });
      }
      const body = updateUserSchema.parse(request.body ?? {});
      if (!Object.keys(body).length) {
        return reply.code(400).send({ mensagem: 'Nenhum campo informado' });
      }
      let airportsUpdate: number[] | null = null;
      if (body.airport_ids !== undefined) {
        airportsUpdate = Array.from(new Set(body.airport_ids));
        if (body.primary_airport_id && !airportsUpdate.includes(body.primary_airport_id)) {
          airportsUpdate.unshift(body.primary_airport_id);
        }
        if (!airportsUpdate.length) {
          return reply.code(400).send({ mensagem: 'Informe ao menos um aeroporto' });
        }
      }

      await db.transaction(async (client) => {
        const campos: string[] = [];
        const valores: any[] = [];
        if (body.name !== undefined) {
          campos.push(`name=$${campos.length + 1}`);
          valores.push(body.name);
        }
        if (body.username !== undefined) {
          campos.push(`username=$${campos.length + 1}`);
          valores.push(body.username);
        }
        if (body.primary_airport_id !== undefined) {
          campos.push(`airport_id=$${campos.length + 1}`);
          valores.push(body.primary_airport_id);
        }
        if (body.active !== undefined) {
          campos.push(`active=$${campos.length + 1}`);
          valores.push(body.active);
        }
        if (campos.length) {
          valores.push(id);
          await client.query(
            `UPDATE wildlife.app_user SET ${campos.join(', ')}, updated_at=now() WHERE user_id=$${campos.length + 1}`,
            valores
          );
        }
        if (airportsUpdate) {
          await client.query('DELETE FROM wildlife.app_user_airport WHERE user_id=$1', [id]);
          await client.query(
            `INSERT INTO wildlife.app_user_airport (user_id, airport_id)
             SELECT $1, unnest($2::bigint[])`,
            [id, airportsUpdate]
          );
        }
      });
      return reply.send({ id });
    }
  );

  app.delete(
    '/usuarios/:id',
    { preHandler: ensureAdmin },
    async (request, reply) => {
      const id = Number((request.params as any).id);
      await db.query('DELETE FROM wildlife.app_user WHERE user_id=$1', [id]);
      return reply.code(204).send();
    }
  );

  app.post(
    '/usuarios/:id/reset-senha',
    { preHandler: ensureAdmin },
    async (request, reply) => {
      const id = Number((request.params as any).id);
      await db.query(
        `UPDATE wildlife.app_user
           SET password_hash = crypt($2, gen_salt('bf')),
               must_reset_password = TRUE,
               password_changed_at = NULL
         WHERE user_id=$1`,
        [id, DEFAULT_PASSWORD]
      );
      return reply.send({ id });
    }
  );

  app.post(
    '/usuarios/reset-senha',
    { preHandler: ensureAdmin },
    async (request, reply) => {
      const { user_ids } = bulkResetSchema.parse(request.body ?? {});
      await db.query(
        `UPDATE wildlife.app_user
            SET password_hash = crypt($2, gen_salt('bf')),
                must_reset_password = TRUE,
                password_changed_at = NULL
          WHERE user_id = ANY($1::bigint[])`,
        [user_ids, DEFAULT_PASSWORD]
      );
      return reply.send({ total: user_ids.length });
    }
  );
}
