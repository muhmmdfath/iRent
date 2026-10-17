import { useQueries } from '@tanstack/react-query';
import { ReloadIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { useSession } from '@/auth/session';
import { errorMessage } from '@/services/api';
import { customerApi } from '../api';
import type { Item } from '../types';
import type { RentalWindow } from './rental-date-filter';
import { HomeDeviceCard } from './home-device-card';
export function HomeDeviceGrid({
  items,
  window,
}: {
  items: Item[];
  window: RentalWindow | null;
}) {
  const userId = useSession().data?.user.id;
  const checks = useQueries({
    queries: items.map((item) => ({
      queryKey: ['customer', userId, 'home-availability', item.id, window],
      queryFn: () =>
        customerApi.availability({
          ...window!,
          items: [{ itemId: item.id, quantity: 1 }],
          deliveryType: 'pickup' as const,
          payOption: 'full' as const,
        }),
      enabled: !!window,
      retry: false,
      refetchInterval: window ? 30000 : false,
    })),
  });
  const error = checks.find((check) => check.isError)?.error;
  return (
    <>
      {window && error && (
        <div className="home-availability-notice" role="alert">
          <InfoCircledIcon aria-hidden="true" />
          <div>
            <strong>Ketersediaan belum bisa diperiksa</strong>
            <p>
              {errorMessage(error)} Pilih tanggal lain melalui kalender, atau
              coba lagi.
            </p>
          </div>
          <Button
            variant="ghost"
            aria-label="Coba lagi ketersediaan"
            title="Coba lagi"
            disabled={checks.some((check) => check.isFetching)}
            onClick={() => {
              for (const check of checks)
                if (check.isError) void check.refetch();
            }}
          >
            <ReloadIcon />
          </Button>
        </div>
      )}
      <div className="customer-device-grid">
        {items.map((item, index) => (
          <HomeDeviceCard
            key={item.id}
            item={item}
            window={window}
            pending={checks[index].isPending}
            failed={checks[index].isError}
            count={
              checks[index].data?.items.find((row) => row.itemId === item.id)
                ?.availableQuantity
            }
          />
        ))}
      </div>
    </>
  );
}
