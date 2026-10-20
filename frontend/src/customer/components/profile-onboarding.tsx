import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from '@/auth/session';
import { ProfilePage } from '../pages/profile-page';
import './profile-onboarding.css';

export function ProfileOnboarding() {
  const user = useSession().data?.user;
  if (!user || user.role !== 'customer' || user.profile?.completedAt)
    return null;
  return <RequiredProfileModal />;
}

function RequiredProfileModal() {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  return createPortal(
    <dialog
      ref={dialog}
      className="profile-onboarding"
      aria-labelledby="profile-onboarding-title"
      aria-describedby="profile-onboarding-description"
      onCancel={(event) => event.preventDefault()}
    >
      <header className="profile-onboarding-heading">
        <p className="eyebrow">Selamat datang di iRent</p>
        <h1 id="profile-onboarding-title">Lengkapi data diri</h1>
        <p id="profile-onboarding-description">
          Isi data wajib dan simpan untuk melanjutkan. Kontak tambahan boleh
          dikosongkan.
        </p>
      </header>
      <ProfilePage onboarding />
    </dialog>,
    document.body,
  );
}
