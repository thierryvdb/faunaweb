import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../services/db';

const schema = z.object({ username: z.string(), password: z.string() });
const changePasswordSchema = z.object({
  current_password: z.string().min(4),
  new_password: z.string().min(6)
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/login', async (request, reply) => {
    const { username, password } = schema.parse(request.body);
    const { rows } = await db.query(
      `SELECT u.user_id, u.name, u.username, u.airport_id, u.must_reset_password, u.active, a.name AS airport_nome,
              r.role_id, r.role_name, r.can_create, r.can_read, r.can_update, r.can_delete, r.can_access_reports
       FROM wildlife.app_user u
       JOIN wildlife.airport a ON a.airport_id = u.airport_id
       JOIN wildlife.lu_user_role r ON r.role_id = u.role_id
       WHERE u.username=$1 AND u.password_hash = crypt($2, u.password_hash)`,
      [username, password]
    );
    const user = rows[0];
    if (!user) {
      return reply.code(401).send({ mensagem: 'Credenciais invalidas' });
    }
    if (!user.active) {
      return reply.code(403).send({ mensagem: 'Usuário inativo' });
    }
    const token = app.jwt.sign({
      sub: user.user_id,
      name: user.name,
      airport_id: user.airport_id,
      role_id: user.role_id,
      role_name: user.role_name,
      permissions: {
        can_create: user.can_create,
        can_read: user.can_read,
        can_update: user.can_update,
        can_delete: user.can_delete,
        can_access_reports: user.can_access_reports
      }
    });

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
        aeroporto: user.airport_nome,
        must_reset_password: user.must_reset_password,
        role_id: user.role_id,
        role_name: user.role_name,
        permissions: {
          can_create: user.can_create,
          can_read: user.can_read,
          can_update: user.can_update,
          can_delete: user.can_delete,
          can_access_reports: user.can_access_reports
        }
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
    const u = await db.query(
      `SELECT u.name, r.role_id, r.role_name, r.can_create, r.can_read, r.can_update, r.can_delete, r.can_access_reports
       FROM wildlife.app_user u
       JOIN wildlife.lu_user_role r ON r.role_id = u.role_id
       WHERE u.user_id=$1`,
      [userId]
    );
    const userRole = u.rows[0];
    const token = app.jwt.sign({
      sub: userId,
      name: userRole.name,
      airport_id,
      role_id: userRole.role_id,
      role_name: userRole.role_name,
      permissions: {
        can_create: userRole.can_create,
        can_read: userRole.can_read,
        can_update: userRole.can_update,
        can_delete: userRole.can_delete,
        can_access_reports: userRole.can_access_reports
      }
    });
    const ai = await db.query(`SELECT airport_id AS id, icao_code, name FROM wildlife.airport WHERE airport_id=$1`, [airport_id]);
    return { token, aeroporto: ai.rows[0] };
  });

  app.post(
    '/api/auth/change-password',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const { current_password, new_password } = changePasswordSchema.parse(request.body);
      const userId = (request as any).user.sub as number;
      const valid = await db.query(
        `SELECT user_id FROM wildlife.app_user WHERE user_id=$1 AND password_hash = crypt($2, password_hash)`,
        [userId, current_password]
      );
      if (!valid.rows[0]) {
        return reply.code(400).send({ mensagem: 'Senha atual incorreta' });
      }
      await db.query(
        `UPDATE wildlife.app_user
           SET password_hash = crypt($2, gen_salt('bf')),
               must_reset_password = FALSE,
               password_changed_at = now()
         WHERE user_id=$1`,
        [userId, new_password]
      );
      const { rows } = await db.query(
        `SELECT u.name, u.airport_id, r.role_id, r.role_name, r.can_create, r.can_read, r.can_update, r.can_delete, r.can_access_reports
         FROM wildlife.app_user u
         JOIN wildlife.lu_user_role r ON r.role_id = u.role_id
         WHERE u.user_id=$1`,
        [userId]
      );
      const userRole = rows[0];
      const token = app.jwt.sign({
        sub: userId,
        name: userRole.name,
        airport_id: userRole.airport_id,
        role_id: userRole.role_id,
        role_name: userRole.role_name,
        permissions: {
          can_create: userRole.can_create,
          can_read: userRole.can_read,
          can_update: userRole.can_update,
          can_delete: userRole.can_delete,
          can_access_reports: userRole.can_access_reports
        }
      });
      return { token };
    }
  );
}
