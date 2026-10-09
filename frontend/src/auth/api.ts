import axios from 'axios';
import { api } from '@/services/api';
import {
  queryClient,
  sessionKey,
  discardPrivateData,
} from '@/services/query-client';
import type { LoginInput, Session } from './types';
export async function getSession(
  signal?: AbortSignal,
): Promise<Session | null> {
  try {
    const session = (await api.get<Session>('/auth/session', { signal })).data;
    const previous = queryClient.getQueryData<Session | null>(sessionKey);
    if (
      previous?.user.id !== session.user.id ||
      previous.user.role !== session.user.role
    )
      await discardPrivateData();
    return session;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401)
      return null;
    throw error;
  }
}
export async function login(input: LoginInput) {
  return (await api.post<Session>('/auth/login', input)).data;
}
export async function logout() {
  await api.post('/auth/logout');
}

export async function registerAccount(input: {
  name: string;
  email?: string;
  phone?: string;
  password: string;
}) {
  return (await api.post<Session>('/auth/register', input)).data;
}
