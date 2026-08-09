export interface AuthenticatedUser {
  id: number;
  email: string;
}

export interface AuthenticatedRequest {
  user: AuthenticatedUser;
  authToken: string;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}
