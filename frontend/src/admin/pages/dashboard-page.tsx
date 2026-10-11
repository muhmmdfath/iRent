import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSession } from '@/auth/session';
import { PaymentQueue } from '../components/payment-queue';
import { AdminOverview } from '../components/overview';
import { TasksPanel } from '../notifications/tasks';
export function AdminDashboardPage() {
  const user = useSession().data?.user;
  return (
    <>
      <header className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">Ruang kerja iRent</p>
          <h1>Selamat datang, {user?.name}.</h1>
          <p>
            Mulai dari bukti yang perlu diperiksa, lalu buka rincian booking.
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/bookings">Semua booking</Link>
        </Button>
      </header>
      <PaymentQueue />
      <AdminOverview />
      <TasksPanel />
      <Button asChild variant="outline">
        <Link to="/admin/risks">Periksa risiko & tindak lanjut</Link>
      </Button>
    </>
  );
}
