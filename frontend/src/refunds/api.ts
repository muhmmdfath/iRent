import { api } from '@/services/api';
import type { Financial } from '@/customer/types';
export type Refund = NonNullable<Financial['booking']['refunds']>[number];
export type RefundAction =
  'cancel' | 'recipient' | 'approve' | 'reject' | 'transfer';
export const refundLabels: Record<string, string> = {
  diajukan: 'Menunggu keputusan',
  disetujui: 'Disetujui — menunggu transfer',
  ditolak: 'Ditolak',
  sudah_dikembalikan: 'Uang sudah dikembalikan',
};
export async function refundAction(
  admin: boolean,
  kind: RefundAction,
  id: string,
  input: Record<string, string>,
  file: File | null,
  key: string,
) {
  const prefix = admin ? '/admin' : '';
  const path =
    kind === 'cancel'
      ? `${prefix}/bookings/${id}/cancel`
      : `${prefix}/refunds/${id}/${kind}`;
  let body: Record<string, string> | FormData = input;
  if (kind === 'transfer') {
    const multipart = new FormData();
    Object.entries(input).forEach(([name, value]) =>
      multipart.append(name, value),
    );
    if (file) multipart.append('file', file, file.name);
    body = multipart;
  }
  return (
    await api.post<Financial>(path, body, {
      headers: { 'Idempotency-Key': key },
    })
  ).data;
}
