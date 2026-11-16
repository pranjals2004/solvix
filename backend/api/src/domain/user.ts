export type UserRole = 'student' | 'admin';
export type ExperimentArm = 'random' | 'standard_elo' | 'conf_elo';

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  arm: ExperimentArm;
  createdAt: Date;
  isFlagged: boolean;
};

export interface AuthRepository {
  createStudent(input: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<UserRecord>;
  findByEmail(email: string): Promise<(UserRecord & { passwordHash: string }) | null>;
  findById(id: string): Promise<UserRecord | null>;
  ping(): Promise<void>;
}
