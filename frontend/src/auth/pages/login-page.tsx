import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import {
  EyeOpenIcon,
  EyeClosedIcon,
  ArrowLeftIcon,
} from '@radix-ui/react-icons';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Brand } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingState, ErrorState } from '@/components/feedback';
import { replaceSession } from '@/services/query-client';
import { errorMessage } from '@/services/api';
import { useOnline } from '@/hooks/use-online';
import { useSession } from '../session';
import { login } from '../api';
import { safeReturnTo } from '../navigation';
import type { LoginInput } from '../types';
export function LoginPage() {
  const session = useSession();
  const [params] = useSearchParams();
  const online = useOnline();
  const [visible, setVisible] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ defaultValues: { identity: '', password: '' } });
  const mutation = useMutation({
    mutationFn: login,
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
  const busy = mutation.isPending || isSubmitting;
  return (
    <main id="main-content" className="auth-layout">
      <section className="auth-intro">
        <Brand />
        <div className="auth-copy">
          <p className="eyebrow">iPhone & aksesori</p>
          <h1>
            Siap untuk
            <br />
            rencana berikutnya.
          </h1>
          <p>Sewa perangkat untuk kebutuhanmu di Semarang.</p>
        </div>
        <Link className="back-link" to="/">
          <ArrowLeftIcon aria-hidden="true" /> Kembali ke beranda
        </Link>
      </section>
      <section className="auth-form-area" aria-labelledby="login-title">
        <div className="auth-form">
          <p className="eyebrow">Akun iRent</p>
          <h2 id="login-title">Masuk</h2>
          <p className="intro-note">
            Gunakan email atau nomor HP yang terdaftar.
          </p>
          <form
            noValidate
            onSubmit={handleSubmit(async (values) => {
              mutation.reset();
              await mutation
                .mutateAsync({ ...values, identity: values.identity.trim() })
                .catch(() => undefined);
            })}
          >
            <div className="field">
              <label htmlFor="identity">Email atau nomor HP</label>
              <Input
                id="identity"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={254}
                aria-invalid={!!errors.identity}
                aria-describedby={
                  errors.identity ? 'identity-error' : undefined
                }
                {...register('identity', {
                  validate: (value) =>
                    !!value.trim() || 'Isi email atau nomor HP.',
                })}
              />
              {errors.identity && (
                <p id="identity-error" className="field-error">
                  {errors.identity.message}
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="password-field">
                <Input
                  id="password"
                  type={visible ? 'text' : 'password'}
                  autoComplete="current-password"
                  maxLength={128}
                  className="pr-14"
                  aria-invalid={!!errors.password}
                  aria-describedby={
                    errors.password ? 'password-error' : undefined
                  }
                  {...register('password', { required: 'Isi password.' })}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setVisible(!visible)}
                  aria-label={
                    visible ? 'Sembunyikan password' : 'Tampilkan password'
                  }
                  aria-pressed={visible}
                >
                  {visible ? <EyeClosedIcon /> : <EyeOpenIcon />}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="field-error">
                  {errors.password.message}
                </p>
              )}
            </div>
            {mutation.isError && (
              <p role="alert" className="form-error">
                {errorMessage(mutation.error)}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={busy || !online}>
              {busy ? 'Sedang masuk...' : 'Masuk'}
            </Button>
            {!online && (
              <p className="field-error">Sambungkan internet untuk masuk.</p>
            )}
          </form>
          <p className="login-help">
            Belum punya akun?{' '}
            <Link
              className="text-link"
              to={
                '/register' +
                (params.get('returnTo')
                  ? '?returnTo=' + encodeURIComponent(params.get('returnTo')!)
                  : '')
              }
            >
              Buat akun
            </Link>
          </p>
          <p className="login-help">
            Lupa password? Hubungi admin iRent untuk bantuan reset.
          </p>
        </div>
      </section>
    </main>
  );
}
