import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../services/api';
import { FINANCIAL_DATA_CHANGED } from '../services/financialDataEvents';
import './Dashboard.css';

const formatCurrency = (value = 0) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(Number(value));

const statusLabels = {
  aman: 'Aman',
  waspada: 'Waspada',
  kritis: 'Kritis',
  overbudget: 'Melewati budget',
};

const statusColors = {
  aman: '#059669',
  waspada: '#d97706',
  kritis: '#dc2626',
  overbudget: '#b91c1c',
};

const formatTransactionDate = (value) => new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', {
  day: '2-digit',
  month: 'short',
});

const Sidebar = ({ user }) => {
  return (
    <aside className="dashboard-sidebar">
      <Link to="/dashboard" className="dashboard-brand">
        <span className="dashboard-brand-mark">BH</span>
        <span><strong>Bocor Halus</strong><small>PERSONAL FINANCE</small></span>
      </Link>
      <nav className="dashboard-nav">
        <Link to="/dashboard" className="dashboard-nav-link active" aria-current="page"><span>⌂</span> Dashboard</Link>
        <Link to="/expenses" className="dashboard-nav-link"><span>↕</span> Pengeluaran</Link>
        <Link to="/budgets" className="dashboard-nav-link"><span>▤</span> Budget</Link>
        <Link to="/categories" className="dashboard-nav-link"><span>＋</span> Kategori</Link>
        <Link to="/subscriptions" className="dashboard-nav-link"><span>↻</span> Subscription</Link>
        <Link to="/reports" className="dashboard-nav-link"><span>▥</span> Laporan</Link>
        <Link to="/notifications" className="dashboard-nav-link"><span>♧</span> Notifikasi</Link>
      </nav>
      <div className="dashboard-sidebar-spacer" />
      <div className="dashboard-user">
        <span className="dashboard-avatar">{user?.name?.[0] ?? 'U'}</span>
        <span><strong>{user?.name ?? 'User'}</strong><small>{user?.email ?? ''}</small></span>
      </div>
    </aside>
  );
};

const KPI = ({ title, value, sub, accent }) => (
  <article className="dashboard-kpi">
    <span className="dashboard-kpi-label">{title}</span>
    <strong style={{ color: accent || '#172033' }}>{value}</strong>
    {sub && <small>{sub}</small>}
  </article>
);

const MiniCard = ({ title, children }) => (
  <article className="dashboard-mini-card">
    <h2>{title}</h2>
    <div>{children}</div>
  </article>
);

const FakeBarChart = ({ data = [] }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'end', height: 120 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, height: 120, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', textAlign: 'center' }}>
          <div title={`${d.label}: ${d.value}`} style={{ height: `${(d.value / max) * 84}px`, background: '#4f46e5', borderRadius: 6 }} />
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
};

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loadingLogout, setLoadingLogout] = useState(false);
  const [period, setPeriod] = useState(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
  const [dashboard, setDashboard] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    const [year, month] = period.split('-').map(Number);

    const loadDashboard = async () => {
      setLoadingDashboard(true);
      setError('');
      setDashboard(null);

      try {
        const response = await api.get('/dashboard', { params: { month, year } });
        if (active) {
          setDashboard(response.data.data);
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.response?.data?.message ?? 'Ringkasan keuangan gagal dimuat. Coba lagi sebentar.');
        }
      } finally {
        if (active) {
          setLoadingDashboard(false);
        }
      }
    };

    loadDashboard();
    return () => {
      active = false;
    };
  }, [period, refreshKey]);

  useEffect(() => {
    const refreshDashboard = () => setRefreshKey((current) => current + 1);
    window.addEventListener(FINANCIAL_DATA_CHANGED, refreshDashboard);
    return () => window.removeEventListener(FINANCIAL_DATA_CHANGED, refreshDashboard);
  }, []);

  const handleLogout = async () => {
    setLoadingLogout(true);
    try {
      await logout();
      navigate('/login');
    } finally {
      setLoadingLogout(false);
    }
  };

  const summary = dashboard?.summary;
  const budgets = dashboard?.budget_categories ?? [];
  const recent = dashboard?.recent_transactions ?? [];
  const chartData = (dashboard?.daily_spending ?? []).map((item) => ({
    label: item.date.slice(-2),
    value: item.amount,
  }));
  const status = summary?.status ?? 'aman';
  const statusColor = statusColors[status] ?? statusColors.aman;
  const displayCurrency = (value) => dashboard ? formatCurrency(value) : '—';
  const usageWidth = Math.min(summary?.percentage ?? 0, 100);
  const largestCategory = budgets.reduce((largest, category) => (
    !largest || category.spent > largest.spent ? category : largest
  ), null);
  const [selectedYear, selectedMonth] = period.split('-').map(Number);
  const periodLabel = new Date(selectedYear, selectedMonth - 1, 1)
    .toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  return (
    <div className="dashboard-app">
      <Sidebar user={user} />

      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="dashboard-welcome">
            <span className="dashboard-eyebrow">RINGKASAN KEUANGAN</span>
            <h1>Selamat datang kembali, <span>{user?.name?.split(' ')[0] ?? 'User'}</span></h1>
            <p>Pantau kondisi keuangan Anda untuk periode ini.</p>
          </div>

          <div className="dashboard-topbar-actions">
            <input
              className="dashboard-period-input"
              aria-label="Pilih periode dashboard"
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
            />
            <Link to="/expenses/manual" className="dashboard-primary-button">+ Catat Pengeluaran</Link>
            {!loadingDashboard && dashboard && (
              <span className="dashboard-status-badge" style={{ '--dashboard-status': statusColor }}>
                {statusLabels[status] ?? statusLabels.aman}
              </span>
            )}
            <span className="dashboard-topbar-avatar">{user?.name?.[0] ?? 'U'}</span>
            <button type="button" className="dashboard-logout" onClick={handleLogout} disabled={loadingLogout}>
              {loadingLogout ? 'Keluar...' : 'Keluar akun'}
            </button>
          </div>
        </header>

        {error && (
          <div className="dashboard-message error" role="alert">
            {error}
          </div>
        )}

        {loadingDashboard && (
          <div className="dashboard-message loading" role="status">Memuat ringkasan keuangan...</div>
        )}

        {!loadingDashboard && dashboard && !dashboard.plan && (
          <div className="dashboard-message info">
            Belum ada rencana pengeluaran untuk {periodLabel}. Data akan tampil setelah rencana bulanan dan budget kategori dibuat.
          </div>
        )}

        <section className="dashboard-kpi-grid" aria-label="Ringkasan bulanan">
          <KPI title="Total Budget" value={displayCurrency(summary?.budget_total)} sub={periodLabel} />
          <KPI title="Total Pengeluaran" value={displayCurrency(summary?.spent_total)} sub={periodLabel} accent="#dc2626" />
          <KPI title="Sisa Budget" value={displayCurrency(summary?.remaining)} sub="Budget dikurangi pengeluaran" accent="#059669" />
          <KPI
            title="Penggunaan Budget"
            value={dashboard ? `${summary.percentage}%` : '—'}
            sub={dashboard ? (statusLabels[status] ?? statusLabels.aman) : 'Menunggu data'}
            accent={statusColor}
          />
        </section>

        <div className="dashboard-content-grid">
          <div className="dashboard-primary-column">
            <article className="dashboard-panel dashboard-progress-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>Penggunaan Budget Bulanan</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: statusColor }}>{statusLabels[status] ?? statusLabels.aman}</div>
                </div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>
                  Terpakai: <span style={{ fontWeight: 800, color: '#ef4444' }}>{displayCurrency(summary?.spent_total)}</span>
                </div>
              </div>
              <div style={{ height: 10, background: '#eef2ff', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ width: `${usageWidth}%`, height: '100%', background: statusColor }} />
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: '#64748b' }}>
                {dashboard ? `${summary.percentage}% terpakai · Sisa ${displayCurrency(summary.remaining)}` : 'Memuat data periode...'}
              </div>
            </article>

            <article className="dashboard-panel dashboard-chart-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 800 }}>Pengeluaran Harian</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{periodLabel}</div>
              </div>
              {chartData.length > 0
                ? <FakeBarChart data={chartData} />
                : <div style={{ padding: '28px 0', color: '#94a3b8', textAlign: 'center' }}>Belum ada transaksi pada periode ini.</div>}
            </article>

            <section className="dashboard-budget-list" aria-label="Penggunaan budget kategori">
              {budgets.map((b) => (
                <article key={b.id} className="dashboard-budget-card">
                  <div>
                    <div style={{ fontWeight: 800 }}>{b.category}</div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>{formatCurrency(b.spent)} dari {formatCurrency(b.amount)}</div>
                  </div>
                  <div style={{ width: 160 }}>
                    <div style={{ height: 8, background: '#eef2ff', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(b.percentage, 100)}%`, height: '100%', background: statusColors[b.status] ?? statusColors.aman }} />
                    </div>
                    <div style={{ fontSize: 12, color: statusColors[b.status] ?? statusColors.aman, marginTop: 8, textAlign: 'right' }}>
                      {b.percentage}% · {statusLabels[b.status] ?? statusLabels.aman}
                    </div>
                  </div>
                </article>
              ))}
              {!loadingDashboard && dashboard && budgets.length === 0 && (
                <div className="dashboard-empty-note">
                  Belum ada alokasi budget kategori untuk periode ini.
                </div>
              )}
            </section>

            <article className="dashboard-panel dashboard-recent-panel">
              <div className="dashboard-panel-heading">
                <h2>Transaksi Terbaru</h2>
                <Link to="/expenses">Lihat semua →</Link>
              </div>
              <div className="dashboard-recent-list">
                {recent.map((r) => (
                  <div key={r.id} className="dashboard-recent-item">
                    <div>
                      <div style={{ fontWeight: 700 }}>{r.description || r.merchant || 'Pengeluaran'}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        {[r.category, formatTransactionDate(r.date)].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, color: '#dc2626' }}>-{formatCurrency(r.amount)}</div>
                  </div>
                ))}
                {!loadingDashboard && dashboard && recent.length === 0 && (
                  <div className="dashboard-empty-note">
                    Belum ada transaksi pada periode ini.
                  </div>
                )}
              </div>
            </article>
          </div>

          <aside className="dashboard-side-column">
            <MiniCard title="Batas Pengeluaran Harian">
              <div style={{ fontSize: 18, fontWeight: 800 }}>{displayCurrency(summary?.daily_limit)}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
                Saran batas harian dari sisa budget dan {summary?.days_remaining ?? 0} hari periode tersisa.
              </div>
            </MiniCard>

            <MiniCard title="Peringatan">
              {budgets.filter((category) => category.status !== 'aman').length > 0
                ? budgets.filter((category) => category.status !== 'aman').map((category) => (
                  <div key={category.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ width: 10, height: 10, flexShrink: 0, borderRadius: 999, background: statusColors[category.status], marginTop: 6 }} />
                    <div style={{ fontSize: 13 }}>
                      {category.category}: {category.percentage}% ({statusLabels[category.status]}).
                    </div>
                  </div>
                ))
                : <div style={{ fontSize: 13, color: '#64748b' }}>Belum ada kategori yang melewati batas waspada.</div>}
            </MiniCard>

            <MiniCard title="Pengeluaran Terbesar">
              {largestCategory
                ? <>
                  <div style={{ fontWeight: 700 }}>{largestCategory.category} · {formatCurrency(largestCategory.spent)}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>Akumulasi kategori bulan ini</div>
                </>
                : <div style={{ fontSize: 13, color: '#64748b' }}>Belum ada pengeluaran berkategori.</div>}
            </MiniCard>
          </aside>
        </div>
      </main>

    </div>
  );
};

export default Dashboard;