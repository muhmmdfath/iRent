import { useEffect, type ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/services/api';
import { useOnline } from '@/hooks/use-online';
import { refreshAdminPayments } from '../hooks';
export function InventoryConfirm<T>({
  save,
  onSaved,
  onCancel,
  children,
  createsRecords = false,
  onBusy,
}: {
  save: () => Promise<T>;
  onSaved: (result: T) => void;
  onCancel: () => void;
  children: ReactNode;
  createsRecords?: boolean;
  onBusy?: (busy: boolean) => void;
}) {
  const online = useOnline();
  const mutation = useMutation({
    mutationFn: save,
    onSuccess: async (result) => {
      await refreshAdminPayments();
      onSaved(result);
    },
  });
  useEffect(() => {
    onBusy?.(mutation.isPending);
    return () => onBusy?.(false);
  }, [mutation.isPending, onBusy]);
  const uncertain =
    createsRecords &&
    mutation.isError &&
    isAxiosError(mutation.error) &&
    (!mutation.error.response || mutation.error.response.status >= 500);
  return (
    <section
      className="inventory-review"
      aria-label="Periksa perubahan inventaris"
    >
      <p className="eyebrow">Periksa sebelum menyimpan</p>
      {children}
      {mutation.isError && (
        <p role="alert" className="field-error">
          {uncertain
            ? 'Hasil pencatatan belum dapat dipastikan. Tutup formulir dan perbarui inventaris sebelum membuat ulang.'
            : errorMessage(mutation.error)}
        </p>
      )}
      <div className="form-actions">
        <Button
          disabled={!online || mutation.isPending || uncertain}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? 'Menyimpan...' : 'Konfirmasi perubahan'}
        </Button>
        <Button
          variant="outline"
          disabled={mutation.isPending}
          onClick={onCancel}
        >
          Batal perubahan
        </Button>
      </div>
    </section>
  );
}
