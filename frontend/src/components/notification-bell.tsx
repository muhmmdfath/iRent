import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BellIcon,
  CheckIcon,
  Cross2Icon,
  ReloadIcon,
} from '@radix-ui/react-icons';
import { useSession } from '@/auth/session';
import { api, errorMessage } from '@/services/api';
import { wib } from '@/customer/format';
interface Notice {
  id: string;
  title: string;
  message: string;
  href: string;
  createdAt: string;
  readAt: string | null;
}
interface Inbox {
  data: Notice[];
  total: number;
  unread: number;
  page: number;
  limit: number;
}
export function NotificationBell() {
  const user = useSession().data?.user;
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const container = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const key = ['inbox', user?.id];
  const query = useQuery({
    queryKey: [...key, page],
    queryFn: async ({ signal }) =>
      (
        await api.get<Inbox>('/notifications', {
          params: { page, limit: 10 },
          signal,
        })
      ).data,
    enabled: !!user,
    refetchInterval: 30000,
  });
  const read = useMutation({
    mutationFn: async (id?: string) =>
      api.post(
        id ? '/notifications/' + id + '/read' : '/notifications/read-all',
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (e.target instanceof Node && !container.current?.contains(e.target))
        setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  const unread = query.data?.unread || 0;
  return (
    <div className="navbar-notifications" ref={container}>
      <button
        ref={toggle}
        type="button"
        className="studio-icon-button notification-toggle"
        aria-label={
          unread ? 'Notifikasi, ' + unread + ' belum dibaca' : 'Notifikasi'
        }
        aria-expanded={open}
        aria-controls="notification-inbox"
        onClick={() => setOpen(!open)}
      >
        <BellIcon aria-hidden="true" />
        {unread > 0 && (
          <span className="notification-count">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <section
          id="notification-inbox"
          className="notification-inbox"
          aria-label="Notifikasi pengguna"
        >
          <header>
            <div>
              <h2>Notifikasi</h2>
              <p>
                {unread ? unread + ' belum dibaca' : 'Kabar terbaru untukmu'}
              </p>
            </div>
            <button
              type="button"
              className="notification-close"
              aria-label="Tutup daftar notifikasi"
              onClick={() => {
                setOpen(false);
                toggle.current?.focus();
              }}
            >
              <Cross2Icon />
            </button>
          </header>
          {unread > 0 && (
            <button
              className="notification-read-all"
              type="button"
              disabled={read.isPending}
              onClick={() => read.mutate(undefined)}
            >
              <CheckIcon aria-hidden="true" />
              Tandai semua dibaca
            </button>
          )}
          {query.isPending ? (
            <p className="notification-state" role="status">
              Memuat notifikasi...
            </p>
          ) : query.isError ? (
            <div className="notification-state">
              <p>{errorMessage(query.error)}</p>
              <button
                type="button"
                aria-label="Muat ulang notifikasi"
                onClick={() => void query.refetch()}
              >
                <ReloadIcon />
                Coba lagi
              </button>
            </div>
          ) : query.data?.data.length ? (
            <ul>
              {query.data.data.map((notice) => (
                <li
                  key={notice.id}
                  className={notice.readAt ? '' : 'is-unread'}
                >
                  <Link
                    className="notification-entry"
                    to={notice.href}
                    onClick={() => {
                      if (!notice.readAt) read.mutate(notice.id);
                      setOpen(false);
                    }}
                  >
                    <span className="notification-entry-symbol">
                      <BellIcon aria-hidden="true" />
                    </span>
                    <div>
                      <strong>{notice.title}</strong>
                      <p>{notice.message}</p>
                      <time dateTime={notice.createdAt}>
                        {wib(notice.createdAt)}
                      </time>
                    </div>
                    {!notice.readAt && (
                      <span
                        className="notification-unread-dot"
                        aria-label="Belum dibaca"
                      />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="notification-empty">
              <BellIcon aria-hidden="true" />
              <h3>Belum ada notifikasi</h3>
              <p>
                Perubahan booking, pembayaran, dan refund akan muncul di sini.
              </p>
            </div>
          )}
          {query.data && query.data.total > 10 && (
            <footer>
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Sebelumnya
              </button>
              <span>{page}</span>
              <button
                type="button"
                disabled={page * 10 >= query.data.total}
                onClick={() => setPage(page + 1)}
              >
                Berikutnya
              </button>
            </footer>
          )}
        </section>
      )}
    </div>
  );
}
