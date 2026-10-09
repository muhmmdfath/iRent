import axios from 'axios';
import type { Session } from '@/auth/types';
import { queryClient, sessionKey, discardPrivateData } from './query-client';
const configuredBase = import.meta.env.VITE_API_BASE_URL || '/api';
export const api = axios.create({
  baseURL: configuredBase.replace(/\/$/, ''),
  withCredentials: true,
  timeout: 15_000,
});
const publicMutations = new Set(['/auth/login', '/auth/register']);
api.interceptors.request.use((config) => {
  const method = config.method?.toUpperCase() || 'GET';
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    // The backend requires JSON even for actions with no business payload.
    // Keep FormData untouched so the browser supplies its multipart boundary.
    if (config.data instanceof FormData) config.headers.delete('Content-Type');
    else {
      config.headers.set('Content-Type', 'application/json');
      if (config.data === undefined) config.data = {};
    }
    if (!navigator.onLine)
      throw new Error(
        'Koneksi terputus. Sambungkan internet sebelum melanjutkan.',
      );
    if (!publicMutations.has(config.url || '')) {
      const session = queryClient.getQueryData<Session | null>(sessionKey);
      if (!session?.csrfToken)
        throw new Error('Sesi belum tersedia. Silakan masuk kembali.');
      config.headers.set('X-CSRF-Token', session.csrfToken);
    }
  }
  return config;
});
api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      !publicMutations.has(error.config?.url || '')
    ) {
      await discardPrivateData();
      queryClient.setQueryData(sessionKey, null);
    }
    return Promise.reject(error);
  },
);
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string | string[] }>(error)) {
    if (!error.response)
      return 'Tidak dapat terhubung. Periksa koneksi lalu coba lagi.';
    if (error.response.status === 429)
      return 'Terlalu banyak percobaan. Coba lagi nanti.';
    if (error.response.status >= 500)
      return 'Layanan sedang bermasalah. Coba lagi sebentar.';
    const message = error.response.data?.message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return 'Periksa kembali isian formulir.';
    return 'Permintaan belum berhasil. Coba lagi.';
  }
  return error instanceof Error
    ? error.message
    : 'Permintaan belum berhasil. Coba lagi.';
}
// Retain this object for retry of the same action; create a new one for changed input.
export function businessActionHeaders() {
  return { 'Idempotency-Key': crypto.randomUUID() };
}
