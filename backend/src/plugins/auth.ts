import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { userId: string; role: string };
    user: { userId: string; role: string };
  }
}

async function authPlugin(fastify: FastifyInstance) {
  await fastify.register(cookie);

  await fastify.register(jwt, {
    secret: fastify.config.JWT_SECRET,
    sign: { expiresIn: '15m' },
  });
}

export default fp(authPlugin, { name: 'auth' });
