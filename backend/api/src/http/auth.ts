import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { Router, type Request, type RequestHandler } from 'express';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import type { AppConfig } from '../config/env';
import type { AuthRepository, ExperimentArm, UserRecord, UserRole } from '../domain/user';
import type { RedisService } from '../infra/redis';
import { HttpError, isUniqueViolation } from './errors';

const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(10).max(72),
  consent: z.literal(true),
}).strict();

const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(72),
}).strict();

type AuthDependencies = {
  repository: AuthRepository;
  redis: RedisService;
  config: AppConfig;
};

function publicUser(user: UserRecord) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    arm: user.arm,
    createdAt: user.createdAt,
    isFlagged: user.isFlagged,
  };
}

function issueToken(user: UserRecord, config: AppConfig): string {
  return jwt.sign(
    { role: user.role, arm: user.arm },
    config.jwtSecret,
    {
      algorithm: 'HS256',
      subject: user.id,
      jwtid: randomUUID(),
      issuer: config.jwtIssuer,
      expiresIn: config.jwtAccessTtl as SignOptions['expiresIn'],
    },
  );
}

export function createAuthRouter({ repository, redis, config }: AuthDependencies): Router {
  const router = Router();

  router.post('/register', asyncRoute(async (request, response) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, 'INVALID_REQUEST', 'Provide a name, valid email, password, and consent.');
    }
    if (Buffer.byteLength(parsed.data.password, 'utf8') > 72) {
      throw new HttpError(400, 'INVALID_REQUEST', 'Password must be at most 72 bytes when encoded.');
    }

    try {
      const passwordHash = await bcrypt.hash(parsed.data.password, config.bcryptRounds);
      const user = await repository.createStudent({
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
      });
      response.status(201).json({ token: issueToken(user, config), user: publicUser(user) });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new HttpError(409, 'EMAIL_IN_USE', 'An account already exists for this email.');
      }
      throw error;
    }
  }));

  router.post('/login', asyncRoute(async (request, response) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, 'INVALID_REQUEST', 'Provide a valid email and password.');
    }
    if (Buffer.byteLength(parsed.data.password, 'utf8') > 72) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }

    const account = await repository.findByEmail(parsed.data.email);
    const passwordMatches = account
      ? await bcrypt.compare(parsed.data.password, account.passwordHash)
      : false;
    if (!account || !passwordMatches) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }
    response.json({ token: issueToken(account, config), user: publicUser(account) });
  }));

  const requireAuth = createRequireAuth(redis, config);

  router.post('/logout', requireAuth, asyncRoute(async (request, response) => {
    const principal = authenticatedPrincipal(request);
    const secondsRemaining = principal.expiresAt - Math.floor(Date.now() / 1000);
    if (secondsRemaining > 0) {
      await redis.set(`auth:blocklist:${principal.tokenId}`, '1', secondsRemaining);
    }
    response.status(204).end();
  }));

  router.get('/me', requireAuth, asyncRoute(async (request, response) => {
    const user = await repository.findById(authenticatedPrincipal(request).userId);
    if (!user) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'This account is no longer available.');
    }
    response.json({ user: publicUser(user) });
  }));

  return router;
}

function authenticatedPrincipal(request: Request) {
  if (!request.auth) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'A valid access token is required.');
  }
  return request.auth;
}

export function createRequireAuth(redis: RedisService, config: AppConfig): RequestHandler {
  return asyncRoute(async (request, _response, next) => {
    const authorization = request.header('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'A valid access token is required.');
    }

    let decoded: JwtPayload;
    try {
      const result = jwt.verify(authorization.slice('Bearer '.length), config.jwtSecret, {
        algorithms: ['HS256'],
        issuer: config.jwtIssuer,
      });
      if (typeof result === 'string') {
        throw new Error('Unexpected token payload.');
      }
      decoded = result;
    } catch {
      throw new HttpError(401, 'UNAUTHENTICATED', 'A valid access token is required.');
    }

    if (
      !decoded.sub || !decoded.jti || !decoded.exp ||
      !isRole(decoded.role) || !isArm(decoded.arm)
    ) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'A valid access token is required.');
    }
    if (await redis.get(`auth:blocklist:${decoded.jti}`)) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'This access token has been revoked.');
    }

    request.auth = {
      userId: decoded.sub,
      tokenId: decoded.jti,
      expiresAt: decoded.exp,
      role: decoded.role,
      arm: decoded.arm,
    };
    next();
  });
}

function isRole(value: unknown): value is UserRole {
  return value === 'student' || value === 'admin';
}

function isArm(value: unknown): value is ExperimentArm {
  return value === 'random' || value === 'standard_elo' || value === 'conf_elo';
}

function asyncRoute(handler: RequestHandler): RequestHandler {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}
