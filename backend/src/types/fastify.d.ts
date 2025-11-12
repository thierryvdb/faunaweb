import 'fastify';
import '@fastify/jwt';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: import('fastify').HookHandlerDoneFunction;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: number; name: string; airport_id: number };
    user: { sub: number; name: string; airport_id: number };
  }
}
