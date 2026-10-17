import { useEffect, type RefObject } from 'react';
export function useLandingMotion(
  ref: RefObject<HTMLDivElement | null>,
  contentVersion: number,
) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const reduced = preference?.matches ?? false;
    let frame = 0;
    const update = () => {
      frame = 0;
      root.dataset.scrolled = String(window.scrollY > 16);
      const distance = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      root.style.setProperty(
        '--page-progress',
        String(Math.min(1, Math.max(0, window.scrollY / distance))),
      );
      root.style.setProperty(
        '--hero-progress',
        reduced
          ? '0'
          : String(
              Math.min(1, Math.max(0, window.scrollY / window.innerHeight)),
            ),
      );
    };
    const scroll = () => {
      if (!frame && window.requestAnimationFrame)
        frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('resize', scroll);
    let observer: IntersectionObserver | undefined;
    if (!reduced && 'IntersectionObserver' in window) {
      root.dataset.motion = 'ready';
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries)
            if (entry.isIntersecting) {
              (entry.target as HTMLElement).dataset.revealed = 'true';
              observer?.unobserve(entry.target);
            }
        },
        { threshold: 0.08, rootMargin: '0px 0px -24px 0px' },
      );
      root
        .querySelectorAll('[data-reveal]:not([data-revealed])')
        .forEach((node) => observer?.observe(node));
    }
    return () => {
      observer?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scroll);
      window.removeEventListener('resize', scroll);
      delete root.dataset.motion;
    };
  }, [ref, contentVersion]);
}
