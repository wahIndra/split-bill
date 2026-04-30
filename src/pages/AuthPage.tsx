import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Receipt } from 'lucide-react';

export default function AuthPage() {
  const { signInWithGoogle, signInAsGuest } = useAuth();
  const [loading, setLoading] = useState<'google' | 'guest' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    try {
      setLoading('google');
      setError(null);
      await signInWithGoogle();
    } catch {
      setError('Gagal masuk dengan Google. Coba lagi.');
      setLoading(null);
    }
  };

  const handleGuest = async () => {
    try {
      setLoading('guest');
      setError(null);
      await signInAsGuest();
    } catch {
      setError('Gagal masuk sebagai tamu. Coba lagi.');
      setLoading(null);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <Receipt size={36} />
          </div>
          <h1 className="auth-title">SplitBill</h1>
          <p className="auth-subtitle">Bagi tagihan dengan mudah &amp; transparan</p>
        </div>

        {/* Sign in options */}
        <div className="auth-actions">
          <button
            className="auth-btn auth-btn--google"
            onClick={handleGoogle}
            disabled={loading !== null}
          >
            {loading === 'google' ? (
              <span className="auth-spinner" />
            ) : (
              <GoogleIcon />
            )}
            <span>Masuk dengan Google</span>
          </button>

          <div className="auth-divider"><span>atau</span></div>

          <button
            className="auth-btn auth-btn--guest"
            onClick={handleGuest}
            disabled={loading !== null}
          >
            {loading === 'guest' ? (
              <span className="auth-spinner" />
            ) : (
              <span className="auth-guest-icon">👤</span>
            )}
            <span>Lanjut sebagai Tamu</span>
          </button>
        </div>

        {error && <p className="auth-error">{error}</p>}

        <p className="auth-note">
          Masuk dengan Google untuk menyimpan riwayat split bill secara permanen.
          Mode tamu tidak menyimpan riwayat setelah sesi berakhir.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.1l-6.2-5.2C29.4 35.5 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-8H6.1C9.5 35.6 16.3 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.4 4.3-4.4 5.7l6.2 5.2C36.9 39.9 44 34.7 44 24c0-1.3-.1-2.6-.4-3.9z"/>
    </svg>
  );
}
