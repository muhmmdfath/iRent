import { useState } from 'react';
import { EyeOpenIcon, EyeClosedIcon } from '@radix-ui/react-icons';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DisclosureSummary } from '@/components/ui/disclosure-summary';
import { LoadingState, ErrorState } from '@/components/feedback';
import { useOnline } from '@/hooks/use-online';
import { useSession } from '@/auth/session';
import type { Session } from '@/auth/types';
import { safeReturnTo } from '@/auth/navigation';
import { queryClient, sessionKey } from '@/services/query-client';
import { errorMessage } from '@/services/api';
import { useProfile } from '../hooks';
import { customerApi } from '../api';
import type { Profile, ProfileInput } from '../types';
export function ProfilePage({ onboarding = false }: { onboarding?: boolean }) {
  const query = useProfile();
  if (query.isPending) return <LoadingState text="Memuat profil..." />;
  if (query.isError)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  return <ProfileForm profile={query.data} onboarding={onboarding} />;
}
function ProfileForm({
  profile,
  onboarding,
}: {
  profile: Profile | null;
  onboarding: boolean;
}) {
  const user = useSession().data!.user;
  const userId = user.id;
  const online = useOnline();
  const [params] = useSearchParams();
  const [saved, setSaved] = useState(false);
  const [nikVisible, setNikVisible] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInput>({
    defaultValues: {
      fullName: profile?.fullName || '',
      address: profile?.address || '',
      phoneActive: profile?.phoneActive || user.phone || '',
      nik: '',
      phoneAlt: profile?.phoneAlt || '',
      instagram: profile?.instagram || '',
      emailContact: profile?.emailContact || '',
    },
  });
  const mutation = useMutation({
    mutationFn: customerApi.saveProfile,
    gcTime: 0,
    onSuccess: async (result) => {
      reset({ ...result, nik: '' });
      setNikVisible(false);
      await queryClient.invalidateQueries({ queryKey: sessionKey });
      queryClient.setQueryData(['customer', userId, 'profile'], result);
      queryClient.setQueryData<Session>(sessionKey, (session) =>
        session?.user.id === userId
          ? {
              ...session,
              user: {
                ...session.user,
                profile: { completedAt: result.completedAt },
              },
            }
          : session,
      );
      setSaved(true);
      mutation.reset();
    },
  });
  const destination = safeReturnTo(params.get('returnTo'), 'customer');
  return (
    <>
      {!onboarding && (
        <header className="page-heading">
          <p className="eyebrow">Data penyewa</p>
          <h1>Profil pelanggan</h1>
          <p>Isi data untuk mulai sewa.</p>
        </header>
      )}
      <form
        className="profile-form"
        noValidate
        onSubmit={handleSubmit(async (values) => {
          setSaved(false);
          const input = {
            ...values,
            fullName: values.fullName.trim(),
            address: values.address.trim(),
            phoneActive: values.phoneActive.trim(),
            ...(values.nik?.trim() ? { nik: values.nik.trim() } : {}),
          };
          if (!input.nik) delete input.nik;
          await mutation.mutateAsync(input).catch(() => undefined);
        })}
      >
        <section className="form-section">
          <h2>Data wajib</h2>
          <div className="field">
            <label htmlFor="fullName">Nama lengkap</label>
            <Input
              id="fullName"
              autoComplete="name"
              maxLength={150}
              aria-invalid={!!errors.fullName}
              {...register('fullName', {
                validate: (value) => !!value.trim() || 'Isi nama lengkap.',
              })}
            />
            {errors.fullName && (
              <p className="field-error">{errors.fullName.message}</p>
            )}
          </div>
          <div className="field">
            <label htmlFor="address">Alamat</label>
            <textarea
              id="address"
              className="text-area"
              autoComplete="street-address"
              rows={3}
              maxLength={1000}
              aria-invalid={!!errors.address}
              {...register('address', {
                validate: (value) => !!value.trim() || 'Isi alamat.',
              })}
            />
            {errors.address && (
              <p className="field-error">{errors.address.message}</p>
            )}
          </div>
          <div className="field">
            <label htmlFor="phoneActive">Nomor HP aktif</label>
            <Input
              id="phoneActive"
              type="tel"
              autoComplete="tel"
              maxLength={40}
              aria-invalid={!!errors.phoneActive}
              {...register('phoneActive', {
                validate: (value) => !!value.trim() || 'Isi nomor HP aktif.',
              })}
            />
            {errors.phoneActive && (
              <p className="field-error">{errors.phoneActive.message}</p>
            )}
          </div>
          <div className="field">
            <label htmlFor="nik">
              {profile ? 'Ganti NIK (opsional)' : 'NIK'}
            </label>
            <div className="password-field">
              <Input
                id="nik"
                className="pr-14"
                placeholder={
                  profile
                    ? String.fromCharCode(8226).repeat(16)
                    : 'Masukkan 16 digit NIK'
                }
                inputMode="numeric"
                type={nikVisible ? 'text' : 'password'}
                autoComplete="off"
                maxLength={16}
                aria-invalid={!!errors.nik}
                aria-describedby="nik-help"
                {...register('nik', {
                  validate: (value) =>
                    (!value && !!profile) ||
                    /^\d{16}$/.test(value || '') ||
                    'NIK harus 16 digit.',
                })}
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={nikVisible ? 'Sembunyikan NIK' : 'Tampilkan NIK'}
                aria-controls="nik"
                aria-pressed={nikVisible}
                onClick={() => setNikVisible((value) => !value)}
              >
                {nikVisible ? (
                  <EyeClosedIcon aria-hidden="true" />
                ) : (
                  <EyeOpenIcon aria-hidden="true" />
                )}
              </button>
            </div>
            <p id="nik-help" className="muted text-sm mt-2">
              {profile
                ? 'NIK sudah tersimpan dan disamarkan. Isi hanya jika ingin mengganti NIK.'
                : 'NIK disimpan secara privat dan tidak ditampilkan kembali.'}
            </p>
            {errors.nik && <p className="field-error">{errors.nik.message}</p>}
          </div>
        </section>
        <details className="optional-fields">
          <DisclosureSummary>Kontak tambahan (opsional)</DisclosureSummary>
          <div className="field">
            <label htmlFor="phoneAlt">Nomor HP alternatif</label>
            <Input
              id="phoneAlt"
              type="tel"
              maxLength={40}
              {...register('phoneAlt')}
            />
          </div>
          <div className="field">
            <label htmlFor="instagram">Instagram</label>
            <Input id="instagram" maxLength={100} {...register('instagram')} />
          </div>
          <div className="field">
            <label htmlFor="emailContact">Email kontak</label>
            <Input
              id="emailContact"
              type="email"
              maxLength={254}
              {...register('emailContact')}
            />
          </div>
        </details>
        {mutation.isError && (
          <p className="form-error" role="alert">
            {errorMessage(mutation.error)}
          </p>
        )}
        {saved && (
          <p role="status" className="success-note">
            Profil tersimpan. Kamu bisa melanjutkan booking.
          </p>
        )}
        <div className="form-actions">
          <Button disabled={!online || mutation.isPending || isSubmitting}>
            {mutation.isPending ? 'Menyimpan...' : 'Simpan profil'}
          </Button>
          {!onboarding && (saved || profile) && (
            <Button asChild variant="outline">
              <Link to={params.get('returnTo') ? destination : '/catalog'}>
                Lanjutkan
              </Link>
            </Button>
          )}
        </div>
      </form>
    </>
  );
}
