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
    return {
      token,
      usuario: {
        id: user.user_id,
        nome: user.name,
        username: user.username,
        aeroporto_id: user.airport_id,
        aeroporto: user.airport_nome
      }
    };
  });
}
