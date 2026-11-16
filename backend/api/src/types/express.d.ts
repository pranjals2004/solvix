import type { ExperimentArm, UserRole } from '../domain/user';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        tokenId: string;
        expiresAt: number;
        role: UserRole;
        arm: ExperimentArm;
      };
    }
  }
}
