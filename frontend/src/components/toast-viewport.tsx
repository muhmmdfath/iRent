import { useEffect, useState } from 'react';
import {
  CheckCircledIcon,
  CrossCircledIcon,
  InfoCircledIcon,
  ExclamationTriangleIcon,
  Cross2Icon,
} from '@radix-ui/react-icons';
import { useToastStore, type Toast } from '@/stores/notifications';
function ToastCard({ item }: { item: Toast }) {
  const dismiss = useToastStore((state) => state.dismiss);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(
      () => dismiss(item.id),
      item.kind === 'error' ? 9000 : 6000,
    );
    return () => clearTimeout(timer);
  }, [item.id, item.kind, dismiss, paused]);
  const Icon = {
    success: CheckCircledIcon,
    error: CrossCircledIcon,
    info: InfoCircledIcon,
    warning: ExclamationTriangleIcon,
  }[item.kind];
  return (
    <article
      className={'toast-card toast-' + item.kind}
      role={item.kind === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setPaused(false);
      }}
    >
      <span className="toast-symbol">
        <Icon aria-hidden="true" />
      </span>
      <div>
        <strong>{item.title}</strong>
        {item.message && <p>{item.message}</p>}
      </div>
      <button
        type="button"
        aria-label="Tutup notifikasi"
        onClick={() => dismiss(item.id)}
      >
        <Cross2Icon aria-hidden="true" />
      </button>
    </article>
  );
}
export function ToastViewport() {
  const items = useToastStore((state) => state.items);
  return (
    <section className="toast-viewport" aria-label="Pemberitahuan tindakan">
      {items.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </section>
  );
}
