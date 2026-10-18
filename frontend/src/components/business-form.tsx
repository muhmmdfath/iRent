import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { useMutation } from '@tanstack/react-query';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useOnline } from '@/hooks/use-online';
import { errorMessage } from '@/services/api';
import {
  useActionKey,
  refreshBookingQueries,
} from '@/services/business-action';
import { rupiah, wib } from '@/customer/format';
export interface ActionField {
  name: string;
  label: string;
  type?:
    | 'text'
    | 'password'
    | 'textarea'
    | 'money'
    | 'number'
    | 'time'
    | 'datetime'
    | 'date'
    | 'email'
    | 'select';
  value?: string;
  optional?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  options?: { value: string; label: string }[];
}
export type ActionInput = Record<string, string>;
export function BusinessForm({
  title,
  description,
  fields = [],
  execute,
  onDone,
  onCancel,
  file = false,
  idempotent = true,
  validate,
  onBusy,
}: {
  title: string;
  description?: string;
  fields?: ActionField[];
  execute: (
    input: ActionInput,
    key: string,
    file: File | null,
  ) => Promise<unknown>;
  onDone: () => void;
  onCancel: () => void;
  file?: boolean;
  idempotent?: boolean;
  validate?: (input: ActionInput) => void;
  onBusy?: (busy: boolean) => void;
}) {
  const online = useOnline();
  const actionKey = useActionKey();
  const token = useRef('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [review, setReview] = useState<ActionInput | null>(null);
  const [draft, setDraft] = useState<ActionInput>({});
  const [error, setError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const mutation = useMutation({
    mutationFn: (input: ActionInput) =>
      execute(input, actionKey({ input, file: token.current }), attachment),
    onSuccess: async () => {
      await refreshBookingQueries();
      onDone();
    },
    onError: (failure) => {
      if (
        !idempotent &&
        isAxiosError(failure) &&
        (!failure.response || failure.response.status >= 500)
      )
        setUncertain(true);
    },
  });
  useEffect(() => {
    onBusy?.(mutation.isPending);
    return () => onBusy?.(false);
  }, [mutation.isPending, onBusy]);
  function prepare(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const input: ActionInput = {};
    const form = new FormData(event.currentTarget);
    try {
      fields.forEach((field) => {
        let value = String(form.get(field.name) || '');
        if (field.type !== 'password') value = value.trim();
        if (!value && field.optional) return;
        if (
          field.type === 'money' &&
          (!/^(0|[1-9][0-9]{0,18})$/.test(value) ||
            BigInt(value) > 9223372036854775807n)
        )
          throw new Error(
            field.label + ' harus rupiah bulat dalam rentang yang valid.',
          );
        if (field.type === 'datetime') {
          const local = value.length === 16 ? value + ':00' : value;
          const date = new Date(local + '+07:00');
          if (
            !Number.isFinite(date.getTime()) ||
            new Date(date.getTime() + 7 * 3600000)
              .toISOString()
              .slice(0, 19) !== local
          )
            throw new Error(field.label + ' belum valid.');
          value = local + '+07:00';
        }
        input[field.name] = value;
      });
      if (
        file &&
        (!attachment ||
          !['image/jpeg', 'image/png', 'application/pdf'].includes(
            attachment.type,
          ) ||
          !attachment.size ||
          attachment.size > 2 * 1024 * 1024)
      )
        throw new Error('Pilih bukti JPG, PNG, atau PDF maksimal 2 MB.');
      validate?.(input);
      setDraft(input);
      setReview(input);
      mutation.reset();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }
  return (
    <section className="business-form form-section" aria-label={title}>
      <h3>{title}</h3>
      {description && <p className="info-note">{description}</p>}
      {review ? (
        <>
          <h4>Periksa sebelum menyimpan</h4>
          <dl className="price-breakdown">
            {fields
              .filter((field) => review[field.name] !== undefined)
              .map((field) => (
                <div key={field.name}>
                  <dt>{field.label}</dt>
                  <dd>
                    {field.type === 'password'
                      ? 'Sudah diisi'
                      : field.type === 'money'
                        ? rupiah(review[field.name])
                        : field.type === 'datetime'
                          ? wib(review[field.name])
                          : field.options?.find(
                              (option) => option.value === review[field.name],
                            )?.label || review[field.name]}
                  </dd>
                </div>
              ))}
          </dl>
          {attachment && <p>Bukti: {attachment.name}</p>}
          <div className="form-actions">
            <Button
              disabled={!online || mutation.isPending || uncertain}
              onClick={() => mutation.mutate(review)}
            >
              {mutation.isPending
                ? 'Menyimpan...'
                : 'Konfirmasi ' + title.toLowerCase()}
            </Button>
            <Button
              variant="outline"
              disabled={mutation.isPending || uncertain}
              onClick={() => {
                setReview(null);
                mutation.reset();
              }}
            >
              Ubah isian
            </Button>
          </div>
        </>
      ) : (
        <form onSubmit={prepare}>
          {fields.map((field) => {
            const value = draft[field.name] ?? field.value ?? '';
            const props = {
              name: field.name,
              required: !field.optional,
              defaultValue:
                field.type === 'datetime' ? value.slice(0, 19) : value,
            };
            return (
              <label className="field" key={field.name}>
                <span>
                  {field.label}
                  {field.optional ? ' (opsional)' : ''}
                </span>
                {field.type === 'textarea' ? (
                  <textarea
                    {...props}
                    className="text-area"
                    minLength={field.min ?? 5}
                    maxLength={field.max ?? 1000}
                  />
                ) : field.type === 'select' ? (
                  <select {...props} className="select-input">
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    {...props}
                    type={
                      field.type === 'money'
                        ? 'text'
                        : field.type === 'datetime'
                          ? 'datetime-local'
                          : field.type || 'text'
                    }
                    inputMode={field.type === 'money' ? 'numeric' : undefined}
                    step={
                      field.type === 'datetime'
                        ? 1
                        : field.type === 'number'
                          ? 1
                          : undefined
                    }
                    min={field.type === 'number' ? field.min : undefined}
                    max={field.type === 'number' ? field.max : undefined}
                    minLength={field.type !== 'number' ? field.min : undefined}
                    maxLength={field.type !== 'number' ? field.max : undefined}
                    pattern={field.pattern}
                    autoComplete={
                      field.type === 'password' ? 'new-password' : undefined
                    }
                  />
                )}
              </label>
            );
          })}
          {file && (
            <label className="field">
              Bukti privat
              <Input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={(event) => {
                  setAttachment(event.target.files?.[0] ?? null);
                  token.current = crypto.randomUUID();
                }}
              />
              {attachment && (
                <span className="muted">Dipilih: {attachment.name}</span>
              )}
            </label>
          )}
          <label className="check-label">
            <input type="checkbox" required />
            Saya sudah memeriksa data dan memahami tindakan ini.
          </label>
          <Button type="submit" disabled={!online || uncertain}>
            Periksa {title.toLowerCase()}
          </Button>
        </form>
      )}
      {(error || mutation.isError) && (
        <p className="form-error" role="alert">
          {error || errorMessage(mutation.error)}
        </p>
      )}
      {uncertain && (
        <p className="info-note">
          Periksa data terbaru sebelum mengulang tindakan ini agar tidak
          tercatat dua kali.
        </p>
      )}
      <Button variant="ghost" disabled={mutation.isPending} onClick={onCancel}>
        Tutup formulir
      </Button>
    </section>
  );
}
