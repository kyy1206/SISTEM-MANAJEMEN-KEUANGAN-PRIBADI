import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useState } from 'react';
import '../pages/Dashboard.css';

const InsightsLayout = ({ active, title, eyebrow, children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  const handleLogout = async () => {
    setLoggingOut(true);
    setLogoutError('');
    try {
      await logout();
      navigate('/login');
    } catch {
      setLogoutError('Gagal keluar dari akun. Coba lagi.');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="dashboard-app">
      <aside className="dashboard-sidebar">
        <Link to="/dashboard" className="dashboard-brand">
          <span className="dashboard-brand-mark">BH</span>
          <span><strong>Bocor Halus</strong><small>PERSONAL FINANCE</small></span>
        </Link>
        <nav className="dashboard-nav">
          <Link to="/dashboard" className="dashboard-nav-link"><span>⌂</span> Dashboard</Link>
          <Link to="/expenses" className="dashboard-nav-link"><span>↕</span> Pengeluaran</Link>
          <Link to="/budgets" className="dashboard-nav-link"><span>▤</span> Budget</Link>
          <Link to="/categories" className="dashboard-nav-link"><span>＋</span> Kategori</Link>
          <Link to="/subscriptions" className="dashboard-nav-link"><span>↻</span> Subscription</Link>
          <Link to="/reports" className={`dashboard-nav-link ${active === 'reports' ? 'active' : ''}`} aria-current={active === 'reports' ? 'page' : undefined}><span>▥</span> Laporan</Link>
          <Link to="/notifications" className={`dashboard-nav-link ${active === 'notifications' ? 'active' : ''}`} aria-current={active === 'notifications' ? 'page' : undefined}><span>♧</span> Notifikasi</Link>
        </nav>
        <div className="dashboard-sidebar-spacer" />
        <div className="dashboard-user">
          <span className="dashboard-avatar">{user?.name?.[0] ?? 'U'}</span>
          <span><strong>{user?.name ?? 'User'}</strong><small>{user?.email ?? ''}</small></span>
        </div>
        <button type="button" className="dashboard-logout" onClick={handleLogout} disabled={loggingOut}>
          {loggingOut ? 'Keluar...' : 'Keluar akun'}
        </button>
      </aside>
      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="dashboard-welcome">
            <span className="dashboard-eyebrow">{eyebrow}</span>
            <h1>{title}</h1>
          </div>
          <Link to="/notifications" className="dashboard-primary-button" aria-label="Buka riwayat notifikasi">♧ Notifikasi</Link>
        </header>
        {logoutError && <div className="dashboard-message error" role="alert">{logoutError}</div>}
        {children}
      </main>
    </div>
  );
};

export default InsightsLayout;
