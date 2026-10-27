import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/auth/session';
import { ErrorState, LoadingState } from '@/components/feedback';
import { api, errorMessage } from '@/services/api';
import { useAdminRead } from './hooks';
import './delivery-fee-setting.css';

interface Settings {
  values: Record<string, unknown> & { delivery_fee_enabled?: boolean };
}

export function DeliveryFeeSetting({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const userId = useSession().data?.user.id;
  const queryClient = useQueryClient();
  const query = useAdminRead<Settings>('settings', '/admin/settings');
  const mutation = useMutation({
    mutationFn: (enabled: boolean) =>
      api.patch('/admin/settings', {
        values: { delivery_fee_enabled: enabled },
      }),
    onSuccess: async (_, enabled) => {
      // Keep the saved value visible while refreshing related policy data.
      queryClient.setQueriesData<Settings>(
        { queryKey: ['admin', userId, 'settings'] },
        (previous) =>
          previous
            ? {
                ...previous,
                values: { ...previous.values, delivery_fee_enabled: enabled },
              }
            : previous,
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['admin', userId, 'settings'],
        }),
        queryClient.invalidateQueries({ queryKey: ['rental-policy'] }),
      ]);
    },
  });
  if (query.isPending)
    return <LoadingState text="Memuat pengaturan ongkir..." />;
  if (query.isError)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const enabled = mutation.isPending
    ? mutation.variables
    : query.data.values.delivery_fee_enabled !== false;
  return (
    <section className="form-section am-delivery-fee-setting">
      <div className="am-panel-heading">
        <div>
          <h2>Ongkir dalam aplikasi</h2>
          <p>Aktifkan untuk menghitung tarif zona pada booking baru.</p>
        </div>
        <div className="am-delivery-fee-control">
          <button
            type="button"
            role="switch"
            aria-label="Ongkir dalam aplikasi"
            aria-checked={enabled}
            aria-busy={mutation.isPending}
            disabled={disabled || mutation.isPending}
            className="am-delivery-fee-switch"
            onClick={() => mutation.mutate(!enabled)}
          >
            <span aria-hidden="true" className="am-switch-track">
              <span />
            </span>
          </button>
          <span className="am-delivery-fee-status" aria-live="polite">
            {enabled ? 'Aktif' : 'Nonaktif'}
          </span>
        </div>
      </div>
      <p className="muted text-sm">
        {enabled
          ? 'Tarif zona masuk tagihan aplikasi. '
          : 'Antar-jemput tetap tersedia; ongkir diinformasikan lewat chat. '}
        Berlaku untuk booking baru. Saat nonaktif, ongkir dibayar dan dicatat di
        luar aplikasi; laporan dan refund aplikasi hanya mencakup tagihan di
        aplikasi.
      </p>
      <p className="am-delivery-fee-save" role="status">
        {mutation.isPending ? 'Menyimpan perubahan…' : ''}
      </p>
      {mutation.isError && (
        <p role="alert" className="form-error">
          {errorMessage(mutation.error)}
        </p>
      )}
    </section>
  );
}
