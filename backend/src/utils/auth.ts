import { FastifyRequest, FastifyReply } from 'fastify';

export function userAirportId(request: FastifyRequest): number {
  const airportId = (request.user as { airport_id?: number })?.airport_id;
  if (!airportId) {
    throw new Error('Usuario sem aeroporto associado');
  }
  return airportId;
}

// Tipos para as permissões do usuário
export interface UserPermissions {
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_access_reports: boolean;
}

export interface AuthenticatedUser {
  sub: number;
  name: string;
  airport_id: number;
  role_id: number;
  role_name: string;
  permissions: UserPermissions;
}

// Obtém as permissões do usuário autenticado
export function getUserPermissions(request: FastifyRequest): UserPermissions {
  const user = request.user as AuthenticatedUser;
  if (!user || !user.permissions) {
    throw new Error('Usuário não autenticado ou sem permissões');
  }
  return user.permissions;
}

// Verifica se o usuário tem uma permissão específica
export function hasPermission(request: FastifyRequest, permission: keyof UserPermissions): boolean {
  try {
    const permissions = getUserPermissions(request);
    return permissions[permission] === true;
  } catch {
    return false;
  }
}

// Middleware para verificar permissão de criação
export async function requireCreate(request: FastifyRequest, reply: FastifyReply) {
  if (!hasPermission(request, 'can_create')) {
    return reply.code(403).send({
      mensagem: 'Acesso negado: você não tem permissão para criar registros'
    });
  }
}

// Middleware para verificar permissão de atualização
export async function requireUpdate(request: FastifyRequest, reply: FastifyReply) {
  if (!hasPermission(request, 'can_update')) {
    return reply.code(403).send({
      mensagem: 'Acesso negado: você não tem permissão para atualizar registros'
    });
  }
}

// Middleware para verificar permissão de exclusão
export async function requireDelete(request: FastifyRequest, reply: FastifyReply) {
  if (!hasPermission(request, 'can_delete')) {
    return reply.code(403).send({
      mensagem: 'Acesso negado: você não tem permissão para excluir registros'
    });
  }
}

// Middleware para verificar permissão de leitura
export async function requireRead(request: FastifyRequest, reply: FastifyReply) {
  if (!hasPermission(request, 'can_read')) {
    return reply.code(403).send({
      mensagem: 'Acesso negado: você não tem permissão para visualizar registros'
    });
  }
}

// Middleware para verificar acesso a relatórios
export async function requireReportAccess(request: FastifyRequest, reply: FastifyReply) {
  if (!hasPermission(request, 'can_access_reports')) {
    return reply.code(403).send({
      mensagem: 'Acesso negado: você não tem permissão para acessar relatórios'
    });
  }
}
