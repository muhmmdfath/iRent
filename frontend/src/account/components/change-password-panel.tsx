import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  EyeClosedIcon,
  EyeOpenIcon,
  LockClosedIcon,
} from '@radix-ui/react-icons';
import { ActionDialog } from '@/components/action-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, errorMessage } from '@/services/api';
import { clearSessionData } from '@/services/query-client';
import { notify } from '@/stores/notifications';
import { useOnline } from '@/hooks/use-online';
import './change-password-panel.css';

interface PasswordFields {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

function ChangePasswordForm({
  onClose,
  admin,
}: {
  onClose: () => void;
  admin: boolean;
}) {
  const navigate = useNavigate();
  const online = useOnline();
  const [shown, setShown] = useState<
    Partial<Record<keyof PasswordFields, boolean>>
  >({});
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFields>();
  const mutation = useMutation({
    mutationFn: async ({ currentPassword, newPassword }: PasswordFields) => {
      await api.post('/auth/password', { currentPassword, newPassword });
    },
    onSuccess: async () => {
      reset();
      await clearSessionData();
      notify({
        kind: 'success',
        title: 'Password berhasil diganti',
        message: 'Masuk kembali dengan password baru.',
      });
      navigate('/login', { replace: true });
    },
  });
  const busy = mutation.isPending || isSubmitting;
  const fields = [
    {
      name: 'currentPassword' as const,
      label: 'Password lama',
      autoComplete: 'current-password',
      registration: register('currentPassword', {
        required: 'Isi password lama.',
        maxLength: 128,
      }),
    },
    {
      name: 'newPassword' as const,
      label: 'Password baru',
      autoComplete: 'new-password',
      registration: register('newPassword', {
        required: 'Isi password baru.',
        minLength: { value: 8, message: 'Gunakan minimal 8 karakter.' },
        maxLength: 128,
        validate: (value) =>
          value !== getValues('currentPassword') ||
          'Password baru harus berbeda dari password lama.',
      }),
    },
    {
      name: 'confirmPassword' as const,
      label: 'Konfirmasi password baru',
      autoComplete: 'new-password',
      registration: register('confirmPassword', {
        required: 'Ulangi password baru.',
        validate: (value) =>
          value === getValues('newPassword') ||
          'Konfirmasi password belum cocok.',
      }),
    },
  ];
  return (
    <ActionDialog title="Ganti password" busy={busy} onClose={onClose}>
      <form
        className="change-password-form"
        onSubmit={handleSubmit(async (values) => {
          await mutation.mutateAsync(values).catch(() => undefined);
        })}
      >
        <p className="change-password-intro">
          Gunakan minimal 8 karakter. Setelah berhasil, semua perangkat perlu
          masuk kembali.
          {admin ? ' Notifikasi PWA perlu diaktifkan kembali.' : ''}
        </p>
        <fieldset disabled={busy}>
          {fields.map((field) => (
            <div className="field" key={field.name}>
              <label htmlFor={'change-' + field.name}>{field.label}</label>
              <div className="change-password-input">
                <Input
                  id={'change-' + field.name}
                  type={shown[field.name] ? 'text' : 'password'}
                  autoComplete={field.autoComplete}
                  maxLength={128}
                  aria-invalid={!!errors[field.name]}
                  aria-describedby={
                    errors[field.name] ? field.name + '-error' : undefined
                  }
                  {...field.registration}
                />
                <button
                  type="button"
                  aria-label={
                    (shown[field.name] ? 'Sembunyikan ' : 'Tampilkan ') +
                    field.label.toLowerCase()
                  }
                  aria-pressed={!!shown[field.name]}
                  onClick={() =>
                    setShown((previous) => ({
                      ...previous,
                      [field.name]: !previous[field.name],
                    }))
                  }
                >
                  {shown[field.name] ? (
                    <EyeClosedIcon aria-hidden="true" />
                  ) : (
                    <EyeOpenIcon aria-hidden="true" />
                  )}
                </button>
              </div>
              {errors[field.name] && (
                <p id={field.name + '-error'} className="field-error">
                  {errors[field.name]?.message}
                </p>
              )}
            </div>
          ))}
        </fieldset>
        {mutation.isError && (
          <p className="field-error" role="alert">
            {errorMessage(mutation.error)}
          </p>
        )}
        {!online && (
          <p role="status" className="field-error">
            Sambungkan internet untuk mengganti password.
          </p>
        )}
        <div className="change-password-actions">
          <Button
            type="submit"
            className="rental-action"
            disabled={busy || !online}
          >
            {busy ? 'Menyimpan...' : 'Simpan password'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onClose}
          >
            Batal
          </Button>
        </div>
      </form>
    </ActionDialog>
  );
}

export function ChangePasswordPanel({ admin = false }: { admin?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <section
      className="account-panel account-password-panel"
      aria-labelledby="account-security-title"
    >
      <header className="account-panel-heading">
        <span className="account-panel-icon">
          <LockClosedIcon aria-hidden="true" />
        </span>
        <div>
          <h2 id="account-security-title">Keamanan akun</h2>
          <p>Kelola password untuk masuk ke iRent.</p>
        </div>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Ganti password
        </Button>
      </header>
      {open && (
        <ChangePasswordForm admin={admin} onClose={() => setOpen(false)} />
      )}
    </section>
  );
}
