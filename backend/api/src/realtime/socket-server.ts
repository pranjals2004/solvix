import type { Server as HttpServer } from 'node:http';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import { Server } from 'socket.io';
import type { AppConfig } from '../config/env';
import type { RedisService } from '../infra/redis';

export function attachSocketServer(server: HttpServer, config: AppConfig, redisService: RedisService): Server {
  const io = new Server(server, {
    cors: { origin: config.corsOrigins, methods: ['GET', 'POST'] },
    path: '/socket.io',
  });
  const pubClient = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  const subClient = pubClient.duplicate();
  pubClient.on('error', () => {
    // Realtime delivery is best effort; doubt status remains available by polling.
  });
  subClient.on('error', () => {
    // Realtime delivery is best effort; doubt status remains available by polling.
  });
  io.adapter(createAdapter(pubClient, subClient));
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.accessToken;
      if (typeof token !== 'string') return next(new Error('Unauthorized'));
      const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'], issuer: config.jwtIssuer });
      if (typeof decoded === 'string' || !decoded.sub || !decoded.jti || !decoded.exp) return next(new Error('Unauthorized'));
      if (await redisService.get(`auth:blocklist:${decoded.jti}`)) return next(new Error('Unauthorized'));
      socket.data.userId = decoded.sub;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });
  io.on('connection', (socket) => {
    const userId = socket.data.userId as string | undefined;
    if (userId) void socket.join(`user:${userId}`);
  });
  return io;
}

export function socketUserRoom(userId: string): string {
  return `user:${userId}`;
}
