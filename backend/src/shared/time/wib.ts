const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Database Timestamp(3) represents WIB wall time in the Date's UTC fields. */
export function wibNow(instant = new Date()): Date {
  if (!Number.isFinite(instant.getTime()))
    throw new Error('Waktu tidak valid.');
  return new Date(instant.getTime() + WIB_OFFSET_MS);
}

/** Only accept explicit WIB timestamps; reject ambiguous/unzoned date strings. */
export function parseWibDateTime(value: string): Date {
  const match =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?\+07:00$/.exec(
      value,
    );
  if (!match) throw new Error('Waktu harus ISO 8601 dengan offset WIB +07:00.');
  const canonical = `${match[1]}.${(match[2] ?? '').padEnd(3, '0')}Z`;
  const wallTime = new Date(canonical);
  if (
    !Number.isFinite(wallTime.getTime()) ||
    wallTime.toISOString() !== canonical
  ) {
    throw new Error('Tanggal atau jam tidak valid.');
  }
  return wallTime;
}

export function formatWibDateTime(wallTime: Date): string {
  if (!Number.isFinite(wallTime.getTime()))
    throw new Error('Waktu tidak valid.');
  return wallTime.toISOString().replace('Z', '+07:00');
}
