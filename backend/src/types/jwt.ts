export interface UserPermissions {
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_access_reports: boolean;
}

export interface JWTPayload {
  sub: number;
  name: string;
  airport_id: number;
  role_id?: number;
  role_name?: string;
  permissions?: UserPermissions;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JWTPayload;
    user: JWTPayload;
  }
}
