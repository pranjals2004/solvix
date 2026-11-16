import type { RequestHandler } from 'express';
import type { UserRole } from '../domain/user';
import { HttpError } from './errors';

export function requireRole(role: UserRole): RequestHandler {
  return (request, _response, next) => {
    if (!request.auth) {
      next(new HttpError(401, 'UNAUTHENTICATED', 'A valid access token is required.'));
      return;
    }
    if (request.auth.role !== role) {
      next(new HttpError(403, 'FORBIDDEN', 'This action requires an administrator account.'));
      return;
    }
    next();
  };
}
