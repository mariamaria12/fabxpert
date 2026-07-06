import { request } from './client';

export interface MeResponse {
  id: string;
  email: string;
  role: 'ADMIN' | 'EMPLOYEE';
  isActive: boolean;
  person: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

export async function login(
  email: string,
  password: string,
  rememberMe: boolean,
): Promise<void> {
  await request<{ success: boolean }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, rememberMe }),
  });
}

export async function logout(): Promise<void> {
  await request<{ success: boolean }>('/auth/logout', { method: 'POST' });
}

export function getMe(): Promise<MeResponse> {
  return request<MeResponse>('/auth/me');
}
