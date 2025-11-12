import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../services/db';

const schema = z.object({ username: z.string(), password: z.string() });

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/login', async (request, reply) => {
    const { username, password } = schema.parse(request.body);
    const { rows } = await db.query(
      `SELECT u.user_id, u.name, u.username, u.airport_id, a.name AS airport_nome
       FROM wildlife.app_user u
       JOIN wildlife.airport a ON a.airport_id = u.airport_id
       WHERE u.username=$1 AND u.password_hash = crypt($2, u.password_hash)`,
      [username, password]
    );
    const user = rows[0];
    if (!user) {
      return reply.code(401).send({ mensagem: 'Credenciais invalidas' });
    }
    const token = app.jwt.sign({ sub: user.user_id, name: user.name, airport_id: user.airport_id });

    const permit = await db.query(
      `SELECT a.airport_id AS id, a.icao_code, a.name
       FROM wildlife.app_user_airport ua
       JOIN wildlife.airport a ON a.airport_id = ua.airport_id
       WHERE ua.user_id=$1
       ORDER BY a.name`,
      [user.user_id]
    );
    return {
      token,
      usuario: {
        id: user.user_id,
        nome: user.name,
        username: user.username,
        aeroporto_id: user.airport_id,
        aeroporto: user.airport_nome
      },
      aeroportos_permitidos: permit.rows
    };
  });

  app.post('/api/auth/switch-airport', async (request, reply) => {
    const body = (request.body ?? {}) as { airport_id?: number };
    const airport_id = Number(body.airport_id);
    if (!airport_id) {
      return reply.code(400).send({ mensagem: 'airport_id obrigatorio' });
    }
    const userId = (request as any).user.sub as number;
    const ok = await db.query(`SELECT 1 FROM wildlife.app_user_airport WHERE user_id=$1 AND airport_id=$2`, [userId, airport_id]);
    if (!ok.rows[0]) {
      return reply.code(403).send({ mensagem: 'Acesso negado a este aeroporto' });
    }
    const u = await db.query(`SELECT name FROM wildlife.app_user WHERE user_id=$1`, [userId]);
    const token = app.jwt.sign({ sub: userId, name: u.rows[0].name, airport_id });
    const ai = await db.query(`SELECT airport_id AS id, icao_code, name FROM wildlife.airport WHERE airport_id=$1`, [airport_id]);
    return { token, aeroporto: ai.rows[0] };
  });
}
