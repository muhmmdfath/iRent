import { api } from '@/services/api';
import type {
  Catalog,
  Item,
  Policy,
  Profile,
  ProfileInput,
  Zone,
  Quote,
  QuoteInput,
  Booking,
  BookingInput,
  Availability,
  Financial,
} from './types';
export const customerApi = {
  profile: async (signal?: AbortSignal) =>
    (await api.get<Profile | null>('/customer/profile', { signal })).data,
  saveProfile: async (input: ProfileInput) =>
    (await api.put<Profile>('/customer/profile', input)).data,
  catalog: async (page = 1, signal?: AbortSignal) =>
    (await api.get<Catalog>('/items', { params: { page, limit: 12 }, signal }))
      .data,
  item: async (id: string, signal?: AbortSignal) =>
    (await api.get<Item>('/items/' + id, { signal })).data,
  policy: async (signal?: AbortSignal) =>
    (await api.get<Policy>('/rental-policy', { signal })).data,
  zones: async (signal?: AbortSignal) =>
    (await api.get<Zone[]>('/delivery-zones', { signal })).data,
  quote: async (input: QuoteInput) =>
    (await api.post<Quote>('/pricing/quote', input)).data,
  availability: async (input: QuoteInput) =>
    (await api.post<Availability>('/bookings/availability', input)).data,
  create: async (input: BookingInput, key: string) =>
    (
      await api.post<Booking>('/bookings', input, {
        headers: { 'Idempotency-Key': key },
      })
    ).data,
  bookings: async (page = 1, signal?: AbortSignal) =>
    (
      await api.get<Booking[]>('/bookings', {
        params: { page, limit: 20, sort: 'newest' },
        signal,
      })
    ).data,
  nextPayment: async (signal?: AbortSignal) =>
    (
      await api.get<Booking[]>('/bookings', {
        params: {
          page: 1,
          limit: 1,
          status: 'menunggu_pembayaran',
          sort: 'deadline',
        },
        signal,
      })
    ).data,
  booking: async (id: string, signal?: AbortSignal) =>
    (await api.get<Booking>('/bookings/' + id, { signal })).data,
  financial: async (id: string, signal?: AbortSignal) =>
    (await api.get<Financial>('/bookings/' + id + '/payments', { signal }))
      .data,
  paymentOptions: async (signal?: AbortSignal) =>
    (
      await api.get<{ qrisImagePath: string | null }>('/payment-options', {
        signal,
      })
    ).data,
  upload: async (
    bookingId: string,
    obligationId: string,
    file: File,
    claimedAmount: string,
    key: string,
  ) => {
    const data = new FormData();
    data.append('file', file);
    data.append('claimedAmount', claimedAmount);
    return (
      await api.post<Financial>(
        '/bookings/' + bookingId + '/obligations/' + obligationId + '/proofs',
        data,
        { headers: { 'Idempotency-Key': key } },
      )
    ).data;
  },
  settlement: async (id: string, key: string) =>
    (
      await api.post<Financial>(
        '/bookings/' + id + '/settlement',
        {},
        { headers: { 'Idempotency-Key': key } },
      )
    ).data,
  downloadProof: async (id: string) =>
    (
      await api.get<Blob>('/payment-proofs/' + id + '/file', {
        responseType: 'blob',
      })
    ).data,
};
