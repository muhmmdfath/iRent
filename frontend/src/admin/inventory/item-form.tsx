import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useOnline } from '@/hooks/use-online';
import { rupiah } from '@/customer/format';
import { inventoryApi } from './api';
import { InventoryConfirm } from './confirm';
import type { InventoryItem, ItemInput } from './types';
const validateMoney = (value: string) =>
  (/^(0|[1-9][0-9]{0,18})$/.test(value) &&
    BigInt(value) <= 9223372036854775807n) ||
  'Isi rupiah bulat nonnegatif dalam batas yang valid.';
interface Fields {
  category: ItemInput['category'];
  name: string;
  includes: string;
  price6h: string;
  price12h: string;
  price24h: string;
}
export function ItemForm({
  item,
  onSaved,
  onCancel,
  onBusy,
}: {
  item?: InventoryItem;
  onSaved: (item: InventoryItem) => void;
  onCancel: () => void;
  onBusy?: (busy: boolean) => void;
}) {
  const online = useOnline();
  const [review, setReview] = useState<ItemInput | null>(null);
  const [error, setError] = useState('');
  const form = useForm<Fields>({
    defaultValues: {
      category: item?.category || 'iphone',
      name: item?.name || '',
      includes: item?.includes.join('\n') || '',
      price6h: item?.price6h || '',
      price12h: item?.price12h || '',
      price24h: item?.price24h || '',
    },
  });
  function prepare(values: Fields) {
    const includes = values.includes
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean);
    if (includes.length > 50 || includes.some((value) => value.length > 200)) {
      setError('Isi paket maksimal 50 baris, masing-masing 200 karakter.');
      return;
    }
    setError('');
    setReview({ ...values, name: values.name.trim(), includes });
  }
  if (review)
    return (
      <InventoryConfirm
        createsRecords={!item}
        onBusy={onBusy}
        save={() =>
          item
            ? inventoryApi.update(item.id, {
                name: review.name,
                includes: review.includes,
                price6h: review.price6h,
                price12h: review.price12h,
                price24h: review.price24h,
              })
            : inventoryApi.create(review)
        }
        onSaved={onSaved}
        onCancel={() => setReview(null)}
      >
        <h2>
          {item ? 'Perbarui model' : 'Model baru'} · {review.name}
        </h2>
        <p>{review.category === 'iphone' ? 'iPhone' : 'Aksesori'}</p>
        <dl className="price-breakdown">
          {(['6', '12', '24'] as const).map((hours) => (
            <div key={hours}>
              <dt>Tarif {hours} jam</dt>
              <dd>{rupiah(review[`price${hours}h`])}</dd>
            </div>
          ))}
        </dl>
        <p>Isi paket: {review.includes.join(', ') || 'Tidak ada tambahan.'}</p>
        <p className="muted text-sm">
          Perubahan tarif dan isi paket berlaku untuk booking baru. Snapshot
          transaksi lama tetap tersimpan.
        </p>
      </InventoryConfirm>
    );
  return (
    <form
      className="form-stack inventory-edit"
      onSubmit={form.handleSubmit(prepare)}
      aria-label={item ? 'Edit model' : 'Tambah model'}
    >
      <h2>{item ? 'Edit model' : 'Informasi model'}</h2>
      <div className="inv-form-identity">
        <label>
          Kategori
          <select
            aria-label="Kategori"
            disabled={!!item}
            {...form.register('category')}
          >
            <option value="iphone">iPhone</option>
            <option value="accessory">Aksesori</option>
          </select>
        </label>
        <label>
          Nama model
          <Input
            maxLength={150}
            placeholder="Contoh: iPhone 15 Pro"
            {...form.register('name', {
              required: 'Nama wajib diisi.',
              validate: (value) => !!value.trim() || 'Nama wajib diisi.',
            })}
          />
        </label>
      </div>
      <fieldset className="inv-form-prices">
        <legend>Tarif sewa</legend>
        <p>Masukkan nominal rupiah untuk setiap durasi.</p>
        <div>
          {(['6', '12', '24'] as const).map((hours) => (
            <label key={hours}>
              Tarif {hours} jam (rupiah)
              <Input
                inputMode="numeric"
                placeholder="0"
                {...form.register(`price${hours}h`, {
                  validate: validateMoney,
                })}
              />
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        Isi paket (satu per baris)
        <textarea
          rows={3}
          placeholder={'Contoh: kabel pengisi daya'}
          {...form.register('includes')}
        />
      </label>
      {(error || Object.keys(form.formState.errors).length > 0) && (
        <p role="alert" className="field-error">
          {error ||
            Object.values(form.formState.errors)
              .map((value) => value.message)
              .join(' ')}
        </p>
      )}
      <div className="form-actions">
        <Button type="submit" disabled={!online}>
          Periksa model
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {item ? 'Batal edit' : 'Batal'}
        </Button>
      </div>
    </form>
  );
}
