import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ItemPhoto } from '@/customer/components/item-photo';
import { wib } from '@/customer/format';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import './calendar-timeline.css';
import { AdminBadge, AdminEmpty, AdminModal } from './workspace';
import type { CalendarUnit } from './calendar';
const physical: Record<string, string> = {
  ready: 'Siap fisik',
  in_use: 'Sedang disewa',
  awaiting_check: 'Menunggu pemeriksaan',
  preparing: 'Persiapan',
  in_transit: 'Dalam perjalanan',
  lost: 'Hilang',
};
export function CalendarTimeline({
  units,
  start,
  end,
}: {
  units: CalendarUnit[];
  start: string;
  end: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = units.find((unit) => unit.id === selectedId);
  const from = new Date(start + 'T00:00:00+07:00').getTime();
  const until = new Date(end + 'T00:00:00+07:00').getTime();
  const span = until - from;
  const days = Array.from(
    { length: Math.round(span / 86400000) },
    (_, i) => new Date(from + i * 86400000),
  );
  const weekday = new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    timeZone: 'Asia/Jakarta',
  });
  const day = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Jakarta',
  });
  const rows = units.map((unit) => {
    const laneEnds: number[] = [];
    const allocations = [...unit.allocations]
      .filter(
        (allocation) =>
          new Date(allocation.blockEndAt).getTime() > from &&
          new Date(allocation.blockStartAt).getTime() < until,
      )
      .sort((a, b) => Date.parse(a.blockStartAt) - Date.parse(b.blockStartAt))
      .map((allocation) => {
        const start = Date.parse(allocation.blockStartAt);
        let lane = laneEnds.findIndex((end) => end <= start);
        if (lane === -1) lane = laneEnds.length;
        laneEnds[lane] = Date.parse(allocation.blockEndAt);
        return { ...allocation, lane };
      });
    return { unit, allocations, lanes: laneEnds.length };
  });
  const rowHeight = Math.max(96, ...rows.map((row) => row.lanes * 38 + 24));
  if (!units.length)
    return (
      <AdminEmpty
        title="Belum ada unit untuk filter ini."
        description="Pilih model atau rentang tanggal lain."
      />
    );
  return (
    <>
      <div className="am-cal-legend">
        <span>
          <i />
          Sewa
        </span>
        <span>
          <i />
          Buffer persiapan
        </span>
        <span>
          <i />
          Hold perpanjangan
        </span>
        <small>Geser ke samping untuk melihat seluruh rentang.</small>
      </div>
      <div
        className="am-calendar-scroll"
        role="region"
        aria-label="Timeline jadwal unit"
        tabIndex={0}
      >
        <div
          className="am-calendar-board"
          style={
            {
              '--calendar-days': days.length,
              '--calendar-row-height': rowHeight + 'px',
            } as CSSProperties
          }
        >
          <div className="am-cal-head">
            <strong>Perangkat / unit</strong>
            <div>
              {days.map((date) => (
                <span key={date.toISOString()}>
                  <small>{weekday.format(date)}</small>
                  <b>{day.format(date)}</b>
                </span>
              ))}
            </div>
          </div>
          {rows.map(({ unit, allocations }) => (
            <article className="am-cal-unit" key={unit.id}>
              <header>
                <ItemPhoto path={unit.item.photoPath} name={unit.item.name} />
                <div>
                  <h2>{unit.code}</h2>
                  <p>{unit.item.name}</p>
                  <AdminBadge
                    tone={
                      unit.overdue
                        ? 'red'
                        : unit.conditionStatus === 'maintenance'
                          ? 'amber'
                          : unit.physicalStatus === 'ready'
                            ? 'green'
                            : 'neutral'
                    }
                  >
                    {unit.overdue
                      ? 'Terlambat kembali'
                      : unit.conditionStatus === 'maintenance'
                        ? 'Perawatan'
                        : physical[unit.physicalStatus] || unit.physicalStatus}
                  </AdminBadge>
                  {!unit.isActive && <small>Unit nonaktif</small>}
                </div>
                <button
                  type="button"
                  className="gantt-detail-trigger"
                  aria-label={'Detail jadwal ' + unit.code}
                  onClick={() => setSelectedId(unit.id)}
                >
                  <InfoCircledIcon aria-hidden="true" />
                </button>
              </header>
              <div className="am-cal-tracks">
                {allocations.length ? (
                  allocations.map((allocation) => {
                    const blockStart = Math.max(
                      from,
                      new Date(allocation.blockStartAt).getTime(),
                    );
                    const blockEnd = Math.min(
                      until,
                      new Date(allocation.blockEndAt).getTime(),
                    );
                    if (blockEnd <= blockStart) return null;
                    const rentStart = Math.max(
                      blockStart,
                      new Date(allocation.startAt).getTime(),
                    );
                    const rentEnd = Math.min(
                      blockEnd,
                      new Date(allocation.endAt).getTime(),
                    );
                    return (
                      <div
                        className="am-cal-track"
                        key={allocation.id}
                        style={{ top: 12 + allocation.lane * 38 }}
                      >
                        <Link
                          className={
                            'am-cal-block ' +
                            (allocation.kind === 'extension_hold'
                              ? 'is-hold'
                              : '')
                          }
                          to={'/admin/bookings/' + allocation.bookingId}
                          aria-label={`${allocation.code}, ambil ${wib(allocation.startAt)}, kembali ${wib(allocation.endAt)}, blok persiapan sampai ${wib(allocation.blockEndAt)}`}
                          title={`${allocation.code}: ${wib(allocation.startAt)} - ${wib(allocation.endAt)}. Buffer sampai ${wib(allocation.blockEndAt)}`}
                          style={{
                            left: ((blockStart - from) / span) * 100 + '%',
                            width: ((blockEnd - blockStart) / span) * 100 + '%',
                          }}
                        >
                          <span
                            style={{
                              left:
                                ((rentStart - blockStart) /
                                  (blockEnd - blockStart)) *
                                  100 +
                                '%',
                              width:
                                (Math.max(0, rentEnd - rentStart) /
                                  (blockEnd - blockStart)) *
                                  100 +
                                '%',
                            }}
                          >
                            {allocation.code}
                          </span>
                        </Link>
                      </div>
                    );
                  })
                ) : (
                  <p>Belum ada jadwal</p>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
      {selected && (
        <AdminModal
          title={'Jadwal ' + selected.code}
          description={selected.item.name}
          onClose={() => setSelectedId(null)}
        >
          <div className="gantt-detail-list">
            {selected.preparationUntil && (
              <p>Persiapan hingga {wib(selected.preparationUntil)}</p>
            )}
            {selected.allocations.length ? (
              selected.allocations.map((allocation) => (
                <article key={allocation.id}>
                  <Link
                    className="am-plain-link"
                    to={'/admin/bookings/' + allocation.bookingId}
                  >
                    {allocation.code}
                  </Link>
                  <dl>
                    <div>
                      <dt>Pengambilan</dt>
                      <dd>{wib(allocation.startAt)}</dd>
                    </div>
                    <div>
                      <dt>Pengembalian</dt>
                      <dd>{wib(allocation.endAt)}</dd>
                    </div>
                    <div>
                      <dt>Buffer sampai</dt>
                      <dd>{wib(allocation.blockEndAt)}</dd>
                    </div>
                  </dl>
                </article>
              ))
            ) : (
              <p>
                Tidak ada alokasi pada rentang ini. Kesiapan fisik tetap perlu
                diperiksa.
              </p>
            )}
            <Link
              className="am-plain-link"
              to={'/admin/inventory/' + selected.item.id}
            >
              Kelola unit di inventaris
            </Link>
          </div>
        </AdminModal>
      )}
    </>
  );
}
