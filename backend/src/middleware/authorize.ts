import { FastifyRequest, FastifyReply } from 'fastify';

export function authorize(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user || !roles.includes(user.role)) {
      reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Brak uprawnień' });
    }
  };
}
