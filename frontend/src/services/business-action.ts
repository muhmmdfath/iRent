import { useRef } from 'react';
import { queryClient } from './query-client';
export function useActionKey() {
  const action = useRef<{ payload: string; key: string } | null>(null);
  return (input: unknown) => {
    const payload = JSON.stringify(input);
    if (action.current?.payload !== payload)
      action.current = { payload, key: crypto.randomUUID() };
    return action.current!.key;
  };
}
export async function refreshBookingQueries() {
  await Promise.all(
    [
      'admin',
      'customer',
      'catalog',
      'item',
      'availability',
      'rental-policy',
      'delivery-zones',
      'payment-options',
    ].map((name) => queryClient.invalidateQueries({ queryKey: [name] })),
  );
}
