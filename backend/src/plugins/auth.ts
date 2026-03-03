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

declare module '@fastify/jwt' {
  interface JWT {
    refresh: {
      sign: (payload: object, options?: object) => string;
      verify: <T = { userId: string; role: string }>(token: string) => T;
    };
  }
}

declare module 'fastify' {
  interface FastifyInstance {}
}

async function authPlugin(fastify: FastifyInstance) {
  await fastify.register(cookie);

  // Access token JWT (default namespace)
  await fastify.register(jwt, {
    secret: fastify.config.JWT_SECRET,
    sign: { expiresIn: '15m' },
  });

  // Refresh token JWT (separate secret, separate namespace)
  await fastify.register(jwt, {
    secret: fastify.config.JWT_REFRESH_SECRET,
    sign: { expiresIn: '7d' },
    namespace: 'refresh',
  });
}

export default fp(authPlugin, { name: 'auth' });
