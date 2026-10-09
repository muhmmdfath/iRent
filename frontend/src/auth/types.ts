export type Role = 'customer' | 'admin';
export interface User {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  profile: { completedAt: string | null } | null;
}
export interface Session {
  user: User;
  csrfToken: string;
}
export interface LoginInput {
  identity: string;
  password: string;
}
