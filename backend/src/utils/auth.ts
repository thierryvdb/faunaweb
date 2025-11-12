import { FastifyRequest } from 'fastify';

export function userAirportId(request: FastifyRequest): number {
  const airportId = (request.user as { airport_id?: number })?.airport_id;
  if (!airportId) {
    throw new Error('Usuario sem aeroporto associado');
  }
  return airportId;
}
