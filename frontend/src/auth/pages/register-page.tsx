import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Brand } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingState, ErrorState } from '@/components/feedback';
import { replaceSession } from '@/services/query-client';
import { errorMessage } from '@/services/api';
import { useOnline } from '@/hooks/use-online';
import { useSession } from '../session';
import { registerAccount } from '../api';
import { safeReturnTo } from '../navigation';
interface Fields {
  name: string;
  email: string;
  phone: string;
  password: string;
}
export function RegisterPage() {
  const session = useSession();
  const [params] = useSearchParams();
  const online = useOnline();
  const [visible, setVisible] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({
    defaultValues: { name: '', email: '', phone: '', password: '' },
  });
  const mutation = useMutation({
    mutationFn: registerAccount,
    onSuccess: replaceSession,
  });
  if (session.isPending) return <LoadingState />;
  if (session.isError)
    return (
      <ErrorState error={session.error} retry={() => void session.refetch()} />
    );
  if (session.data)
    return (
      <Navigate
        to={safeReturnTo(params.get('returnTo'), session.data.user.role)}
        replace
      />
    );
  return (
    <main id="main-content" className="auth-layout">
      <section className="auth-intro">
        <Brand />
        <div className="auth-copy">
          <p className="eyebrow">iRent Semarang</p>
          <h1>
            Mulai dari
            <br />
            akunmu sendiri.
          </h1>
          <p>Simpan booking dan pantau pembayaran dalam satu tempat.</p>
        </div>
        <Link className="back-link" to="/catalog">
          Lihat katalog
        </Link>
      </section>
      <section className="auth-form-area">
        <div className="auth-form">
          <p className="eyebrow">Pelanggan baru</p>
          <h2>Buat akun</h2>
          <p className="intro-note">
            Isi email atau nomor HP untuk masuk nanti.
          </p>
          <form
            noValidate
            onSubmit={handleSubmit(async (values) => {
              await mutation
                .mutateAsync({
                  name: values.name.trim(),
                  password: values.password,
                  ...(values.email.trim()
                    ? { email: values.email.trim() }
                    : {}),
                  ...(values.phone.trim()
                    ? { phone: values.phone.trim() }
                    : {}),
                })
                .catch(() => undefined);
            })}
          >
            <div className="field">
              <label htmlFor="register-name">Nama</label>
              <Input
                id="register-name"
                autoComplete="name"
                maxLength={100}
                aria-invalid={!!errors.name}
                {...register('name', {
                  validate: (value) => !!value.trim() || 'Isi nama.',
                })}
              />
              {errors.name && (
                <p className="field-error">{errors.name.message}</p>
              )}
            </div>
            <div className="field">
              <label htmlFor="register-email">Email</label>
              <Input
                id="register-email"
                type="email"
                autoComplete="email"
                maxLength={254}
                aria-invalid={!!errors.email}
                {...register('email', {
                  validate: (value) =>
                    value.trim()
                      ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ||
                        'Email belum valid.'
                      : !!getValues('phone').trim() ||
                        'Isi email atau nomor HP.',
                })}
              />
              {errors.email && (
                <p className="field-error">{errors.email.message}</p>
              )}
            </div>
            <div className="field">
              <label htmlFor="register-phone">
                Nomor HP (opsional jika ada email)
              </label>
              <Input
                id="register-phone"
                type="tel"
                autoComplete="tel"
                maxLength={40}
                {...register('phone')}
              />
            </div>
            <div className="field">
              <label htmlFor="register-password">Password</label>
              <Input
                id="register-password"
                type={visible ? 'text' : 'password'}
                autoComplete="new-password"
                maxLength={128}
                aria-describedby="password-help"
                aria-invalid={!!errors.password}
                {...register('password', {
                  required: 'Isi password.',
                  minLength: {
                    value: 12,
                    message: 'Gunakan minimal 12 karakter.',
                  },
                  maxLength: 128,
                })}
              />
              <p id="password-help" className="muted text-sm mt-2">
                Minimal 12 karakter.
              </p>
              {errors.password && (
                <p className="field-error">{errors.password.message}</p>
              )}
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={(event) => setVisible(event.target.checked)}
                />
                Tampilkan password
              </label>
            </div>
            {mutation.isError && (
              <p role="alert" className="form-error">
                {errorMessage(mutation.error)}
              </p>
            )}
            <Button disabled={!online || mutation.isPending || isSubmitting}>
              Buat akun
            </Button>
          </form>
          <p className="login-help">
            Sudah punya akun?{' '}
            <Link
              className="text-link"
              to={
                '/login' +
                (params.get('returnTo')
                  ? '?returnTo=' + encodeURIComponent(params.get('returnTo')!)
                  : '')
              }
            >
              Masuk
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
