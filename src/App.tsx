import React from 'react';
import { BillProvider, useBill } from './context/BillContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import ReviewPage from './pages/ReviewPage';
import ParticipantsPage from './pages/ParticipantsPage';
import AssignPage from './pages/AssignPage';
import SummaryPage from './pages/SummaryPage';
import AuthPage from './pages/AuthPage';
import { Home, Upload, ClipboardList, Users, BarChart2, LogOut } from 'lucide-react';
import type { PageName } from './types';

const STEPS: { page: PageName; label: string; shortLabel: string }[] = [
  { page: 'upload', label: 'Upload', shortLabel: '1' },
  { page: 'review', label: 'Review', shortLabel: '2' },
  { page: 'participants', label: 'Peserta', shortLabel: '3' },
  { page: 'assign', label: 'Assign', shortLabel: '4' },
  { page: 'summary', label: 'Summary', shortLabel: '5' },
];

function StepBar() {
  const { state, navigate } = useBill();
  const { currentPage } = state;
  if (currentPage === 'home') return null;

  const currentIndex = STEPS.findIndex(s => s.page === currentPage);

  return (
    <div className="step-bar">
      {STEPS.map((step, i) => (
        <React.Fragment key={step.page}>
          <button
            className={`step-item ${i === currentIndex ? 'active' : ''} ${i < currentIndex ? 'done' : ''}`}
            onClick={() => i <= currentIndex && navigate(step.page)}
            disabled={i > currentIndex}
          >
            <div className="step-circle">
              {i < currentIndex ? '✓' : i + 1}
            </div>
            <span className="step-label">{step.label}</span>
          </button>
          {i < STEPS.length - 1 && (
            <div className={`step-connector ${i < currentIndex ? 'done' : ''}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function NavBar() {
  const { state, navigate } = useBill();
  const { currentPage } = state;
  if (currentPage === 'home') return null;

  return (
    <div className="bottom-nav">
      <button className="nav-btn" onClick={() => navigate('home')}>
        <Home size={20} />
        <span>Home</span>
      </button>
      <button className={`nav-btn ${currentPage === 'upload' ? 'active' : ''}`} onClick={() => navigate('upload')}>
        <Upload size={20} />
        <span>Upload</span>
      </button>
      <button className={`nav-btn ${currentPage === 'review' ? 'active' : ''}`} onClick={() => navigate('review')} disabled={!state.receipt}>
        <ClipboardList size={20} />
        <span>Review</span>
      </button>
      <button className={`nav-btn ${currentPage === 'participants' ? 'active' : ''}`} onClick={() => navigate('participants')} disabled={!state.receipt}>
        <Users size={20} />
        <span>Orang</span>
      </button>
      <button className={`nav-btn ${currentPage === 'summary' ? 'active' : ''}`} onClick={() => navigate('summary')} disabled={!state.receipt || state.participants.length === 0}>
        <BarChart2 size={20} />
        <span>Summary</span>
      </button>
    </div>
  );
}

function AppContent() {
  const { state } = useBill();
  const { user, isGuest, isOffline, signOut } = useAuth();
  const { currentPage } = state;

  const displayName = isOffline
    ? 'Offline'
    : isGuest
    ? 'Tamu'
    : (user?.user_metadata?.full_name as string | undefined)
      ?? user?.email?.split('@')[0]
      ?? 'User';

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-logo">🍽️ SplitBill</div>
          {state.currentPage !== 'home' && (
            <div className="app-header-merchant">
              {state.receipt?.merchantName || '—'}
            </div>
          )}
          <div className="app-header-user">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="user-avatar-img" referrerPolicy="no-referrer" />
            ) : (
              <div className="user-avatar-fallback">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="user-name">{displayName}</span>
            {!isOffline && (
              <button className="btn-icon user-signout" title="Keluar" onClick={() => signOut()}>
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
        <StepBar />
      </header>

      <main className="app-main">
        {currentPage === 'home' && <HomePage />}
        {currentPage === 'upload' && <UploadPage />}
        {currentPage === 'review' && <ReviewPage />}
        {currentPage === 'participants' && <ParticipantsPage />}
        {currentPage === 'assign' && <AssignPage />}
        {currentPage === 'summary' && <SummaryPage />}
      </main>

      <NavBar />
    </div>
  );
}

function AuthGate({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="auth-loading">
        <span className="auth-spinner auth-spinner--lg" />
      </div>
    );
  }
  if (!user) return <AuthPage />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BillProvider>
        <AuthGate>
          <AppContent />
        </AuthGate>
      </BillProvider>
    </AuthProvider>
  );
}
