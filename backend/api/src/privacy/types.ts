export interface PrivacyRepository {
  exportUserData(userId: string): Promise<Record<string, unknown> | null>;
  userExists(userId: string): Promise<boolean>;
  deleteUser(userId: string): Promise<boolean>;
}
