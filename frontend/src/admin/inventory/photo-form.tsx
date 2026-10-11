import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { inventoryApi } from './api';
import { InventoryConfirm } from './confirm';
import { api } from '@/services/api';
export function PhotoForm({
  id,
  qris = false,
  onDone,
  onCancel,
}: {
  id: string;
  qris?: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState<string | null>(null),
    [error, setError] = useState('');
  const previewUrl = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );
  function select(value: File | undefined) {
    setError('');
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
    setPreview(null);
    setFile(null);
    if (!value) return;
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(value.type) ||
      value.size > 5 * 1024 * 1024 ||
      value.size === 0
    ) {
      setError('Pilih JPG, PNG atau WebP berukuran maksimal 5 MB.');
      return;
    }
    previewUrl.current = URL.createObjectURL(value);
    setPreview(previewUrl.current);
    setFile(value);
  }
  return (
    <section className="inventory-edit">
      <h2>{qris ? 'Ganti gambar QRIS' : 'Ganti foto model'}</h2>
      <p className="muted text-sm">
        Foto akan tampil di katalog publik. Maksimal 5 MB dan 16 megapiksel.
      </p>
      {!file && (
        <label>
          Pilih foto
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => select(event.target.files?.[0])}
          />
        </label>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {file ? (
        <InventoryConfirm
          save={async () => {
            if (!qris) {
              await inventoryApi.photo(id, file);
              return;
            }
            const body = new FormData();
            body.append('file', file, file.name);
            await api.post('/admin/settings/qris-image', body);
          }}
          onSaved={onDone}
          onCancel={() => select(undefined)}
        >
          <p>{file.name}</p>
          {preview && (
            <img
              className="inventory-photo-preview"
              src={preview}
              alt="Preview foto model"
            />
          )}
        </InventoryConfirm>
      ) : (
        <Button variant="outline" onClick={onCancel}>
          Batal foto
        </Button>
      )}
    </section>
  );
}
