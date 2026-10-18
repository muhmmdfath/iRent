import { CalendarIcon, CheckIcon } from '@radix-ui/react-icons';
export function AuthRentalVisual() {
  return (
    <div className="auth-rental-visual" aria-hidden="true">
      <div className="auth-device-outline">
        <span className="auth-device-camera" />
        <div className="auth-device-screen">
          <span>iR</span>
          <small>
            Untuk rencana
            <br />
            berikutnya.
          </small>
        </div>
        <span className="auth-device-home" />
      </div>
      <div className="auth-visual-tag">
        <CalendarIcon />
        <span>6 / 12 / 24 jam</span>
      </div>
      <div className="auth-visual-note">
        <span>
          <CheckIcon />
        </span>
        <div>
          <strong>Sewa lebih teratur</strong>
          <small>Jadwal dan booking dalam satu akun.</small>
        </div>
      </div>
    </div>
  );
}
