import { PAGE_SIZE } from '@/lib/pagination';
import { api } from '@/services/api';
import type { Financial } from '@/customer/types';
import type {
  AdminBooking,
  BookingFilters,
  PaymentTasks,
  ReceiptInput,
  HandoverInput,
  ReturnInput,
} from './types';
export const adminApi = {
  handover: async (id: string, input: HandoverInput, key: string) =>
    (
      await api.post<Financial>(`/admin/bookings/${id}/handover`, input, {
        headers: { 'Idempotency-Key': key },
      })
    ).data,
  verifyReturn: async (
    id: string,
    itemId: string,
    input: ReturnInput,
    key: string,
  ) =>
    (
      await api.post<Financial>(
        `/admin/bookings/${id}/items/${itemId}/return/verify`,
        input,
        { headers: { 'Idempotency-Key': key } },
      )
    ).data,
  rejectReturn: async (
    id: string,
    itemId: string,
    reason: string,
    key: string,
  ) =>
    (
      await api.post<Financial>(
        `/admin/bookings/${id}/items/${itemId}/return-report/reject`,
        { reason },
        { headers: { 'Idempotency-Key': key } },
      )
    ).data,
  bookings: async (filters: BookingFilters, signal?: AbortSignal) =>
    (
      await api.get<AdminBooking[]>('/admin/bookings', {
        signal,
        params: {
          ...filters,
          search: filters.search || undefined,
          status: filters.status || undefined,
          limit: PAGE_SIZE,
        },
      })
    ).data,
  booking: async (id: string, signal?: AbortSignal) =>
    (await api.get<AdminBooking>('/bookings/' + id, { signal })).data,
  financial: async (id: string, signal?: AbortSignal) =>
    (await api.get<Financial>('/bookings/' + id + '/payments', { signal }))
      .data,
  tasks: async (signal?: AbortSignal) =>
    (
      await api.get<PaymentTasks>('/admin/tasks', {
        signal,
        params: { kind: 'payment', limit: 5 },
      })
    ).data,
  verify: async (
    id: string,
    proofId: string,
    input: ReceiptInput,
    key: string,
  ) =>
    (
      await api.post<Financial>(
        `/admin/bookings/${id}/payments/verify`,
        { ...input, proofId },
        { headers: { 'Idempotency-Key': key } },
      )
    ).data,
  reject: async (id: string, proofId: string, reason: string, key: string) =>
    (
      await api.post<Financial>(
        `/admin/bookings/${id}/proofs/${proofId}/reject`,
        { reason },
        { headers: { 'Idempotency-Key': key } },
      )
    ).data,
  settle: async (id: string, input: ReceiptInput, key: string) =>
    (
      await api.post<Financial>(`/admin/bookings/${id}/settlement`, input, {
        headers: { 'Idempotency-Key': key },
      })
    ).data,
  download: async (id: string, signal?: AbortSignal) =>
    (
      await api.get<Blob>(`/payment-proofs/${id}/file`, {
        responseType: 'blob',
        signal,
      })
    ).data,
};
