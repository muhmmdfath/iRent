import { Link } from 'react-router-dom';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { CalendarIcon } from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { useSession } from '@/auth/session';
import { useAdminRead } from '@/admin/manage/hooks';
import {
  DashboardMetrics,
  TodaySchedule,
  BookingBreakdown,
  type Overview,
} from '../components/overview';
import { RecentBookings } from '../components/recent-bookings';
import { TasksPanel } from '../notifications/tasks';
export function AdminDashboardPage() {
  const user = useSession().data?.user;
  const client = useQueryClient();
  const fetching = useIsFetching({ queryKey: ['admin', user?.id] }) > 0;
  const query = useAdminRead<Overview>('overview', '/admin/overview', {}, true);
  const date = query.data?.asOf ? new Date(query.data.asOf) : new Date();
  return (
    <div className="admin-dashboard">
      <header className="ops-header">
        <div>
          <p className="ops-eyebrow">Beranda / Operasional</p>
          <h1>Ringkasan operasional</h1>
          <p className="ops-welcome">
            Selamat datang, {user?.name}. Berikut aktivitas rental Anda hari
            ini.
          </p>
        </div>
        <div className="ops-header-actions">
          <Button
            variant="outline"
            disabled={fetching}
            onClick={() =>
              void client.invalidateQueries({ queryKey: ['admin', user?.id] })
            }
          >
            {fetching ? 'Memperbarui...' : 'Perbarui'}
          </Button>
          <Button asChild>
            <Link to="/admin/calendar">
              <CalendarIcon aria-hidden="true" />
              Kalender
            </Link>
          </Button>
        </div>
      </header>
      <div className="ops-dayline">
        <p>
          {new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }).format(date)}
        </p>
        <span
          className={query.isError ? 'ops-update-error' : 'ops-update-status'}
        >
          {query.isError
            ? 'Pembaruan gagal'
            : query.dataUpdatedAt
              ? 'Diperbarui ' +
                new Intl.DateTimeFormat('id-ID', {
                  timeZone: 'Asia/Jakarta',
                  hour: '2-digit',
                  minute: '2-digit',
                  hourCycle: 'h23',
                }).format(query.dataUpdatedAt) +
                ' WIB'
              : 'Mengambil data terbaru'}
        </span>
      </div>
      {query.isError && (
        <div className="ops-overview-error" role="alert">
          <p>
            Ringkasan belum dapat diperbarui. Coba muat ulang untuk mendapatkan
            data terkini.
          </p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Coba lagi
          </Button>
        </div>
      )}
      <DashboardMetrics data={query.data} error={query.isError} />
      <div className="ops-main-grid">
        <div className="ops-agenda-column">
          <TodaySchedule
            data={query.data}
            loading={query.isPending}
            error={query.error}
            onRetry={() => void query.refetch()}
          />
          {(query.data || !query.isError) && (
            <BookingBreakdown data={query.data} />
          )}
          <div className="ops-inventory-note">
            <CubeNote />
            <div>
              <strong>Siap fisik, cek juga jadwalnya.</strong>
              <p>
                Unit yang siap tetap mengikuti alokasi dan persiapan di
                kalender.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link to="/admin/inventory">Inventaris</Link>
            </Button>
          </div>
        </div>
        <TasksPanel />
      </div>
      <RecentBookings />
      <div className="ops-risk-strip">
        <div>
          <strong>Antisipasi kendala sebelum serah terima.</strong>
          <p>Periksa keterlambatan unit dan tindak lanjut pengiriman.</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/admin/risks">Periksa risiko</Link>
        </Button>
      </div>
    </div>
  );
}
function CubeNote() {
  return <span className="ops-note-dot" aria-hidden="true" />;
}
