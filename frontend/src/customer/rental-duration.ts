export function rentalDurations(maximum = 168) {
  return Array.from(
    { length: Math.floor(Math.min(168, maximum) / 6) },
    (_, i) => (i + 1) * 6,
  ).filter((hours) => [0, 6, 12].includes(hours % 24));
}
export function durationLabel(hours: number) {
  const days = Math.floor(hours / 24);
  const extra = hours % 24;
  return days
    ? `${days} hari${extra ? ` + ${extra} jam` : ''}`
    : `${extra} jam`;
}
export function durationPrice(
  item: { price6h: string; price12h: string; price24h: string },
  hours: number,
) {
  if (!rentalDurations().includes(hours))
    throw new Error('Durasi sewa tidak valid.');
  const extra = hours % 24;
  return String(
    BigInt(item.price24h) * BigInt(Math.floor(hours / 24)) +
      (extra === 6
        ? BigInt(item.price6h)
        : extra === 12
          ? BigInt(item.price12h)
          : 0n),
  );
}
