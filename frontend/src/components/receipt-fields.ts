import type { ActionField, ActionInput } from './business-form';
export function receiptFields(amount = '', simple = false): ActionField[] {
  const fields: ActionField[] = [
    {
      name: 'amount',
      label: 'Nominal uang diterima (rupiah)',
      type: 'money',
      value: amount,
    },
    {
      name: 'occurredAt',
      label: 'Waktu uang diterima (WIB)',
      type: 'datetime',
      value: new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 19),
    },
    {
      name: 'method',
      label: 'Metode pembayaran',
      type: 'select',
      value: 'transfer',
      options: [
        { value: 'transfer', label: 'Transfer' },
        { value: 'qris', label: 'QRIS' },
        { value: 'cash', label: 'Tunai' },
      ],
    },
    {
      name: 'receivingAccountReference',
      label: 'Rekening penerima toko',
      max: 150,
      optional: true,
    },
    {
      name: 'transactionReference',
      label: 'Referensi transaksi',
      max: 150,
      optional: true,
    },
    {
      name: 'note',
      label: 'Catatan pemeriksaan',
      type: 'textarea',
      min: 5,
      max: 1000,
    },
  ];
  return simple ? fields.slice(0, 3) : fields;
}
export function validateReceipt(input: ActionInput) {
  if (BigInt(input.amount) <= 0n)
    throw new Error('Nominal uang harus lebih dari nol.');
  if (new Date(input.occurredAt).getTime() > Date.now())
    throw new Error('Waktu uang diterima tidak boleh di masa depan.');
  if (!!input.transactionReference !== !!input.receivingAccountReference)
    throw new Error(
      'Isi rekening dan referensi secara berpasangan jika digunakan.',
    );
}

export function validateSimpleReceipt(input: ActionInput) {
  validateReceipt(input);
  input.note = 'Uang masuk diperiksa dan dikonfirmasi admin.';
}
