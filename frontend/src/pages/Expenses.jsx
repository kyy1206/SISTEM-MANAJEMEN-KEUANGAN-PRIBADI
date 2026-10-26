import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../services/api';
import { notifyFinancialDataChanged } from '../services/financialDataEvents';
import './Expenses.css';

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const currentPeriod = () => today().slice(0, 7);

const currency = (value = 0) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(Number(value));

const monthLabel = (period) => {
  const [year, month] = period.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
};

const dateLabel = (value) => new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const initialForm = () => ({
  budget_id: '',
  amount: '',
  date: today(),
  merchant: '',
  payment_method: '',
  description: '',
});

const Sidebar = ({ user, onLogout, loadingLogout, onSelectEntry }) => {
  const location = useLocation();
  const [expenseMenuOpen, setExpenseMenuOpen] = useState(location.pathname.startsWith('/expenses'));

  return (
    <aside className="expense-sidebar">
      <Link to="/dashboard" className="expense-brand">
        <span className="expense-brand-mark">BH</span>
        <span><strong>Bocor Halus</strong><small>PERSONAL FINANCE</small></span>
      </Link>
      <Link to="/dashboard" className="expense-nav-link"><span>⌂</span> Dashboard</Link>
      <button
        type="button"
        className={`expense-nav-link expense-nav-toggle ${location.pathname.startsWith('/expenses') ? 'active' : ''}`}
        aria-expanded={expenseMenuOpen}
        onClick={() => setExpenseMenuOpen((open) => !open)}
      >
        <span>↕</span> Pengeluaran <span className="expense-nav-chevron">{expenseMenuOpen ? '⌄' : '›'}</span>
      </button>
      {expenseMenuOpen && (
        <nav className="expense-subnav" aria-label="Menu pengeluaran">
          <Link to="/expenses" className={`expense-subnav-link ${location.pathname === '/expenses' ? 'active' : ''}`} aria-current={location.pathname === '/expenses' ? 'page' : undefined}>Riwayat Pengeluaran</Link>
          <Link to="/expenses/manual" onClick={onSelectEntry} className={`expense-subnav-link ${location.pathname === '/expenses/manual' ? 'active' : ''}`} aria-current={location.pathname === '/expenses/manual' ? 'page' : undefined}>Pengeluaran Manual</Link>
          <Link to="/expenses/ocr" onClick={onSelectEntry} className={`expense-subnav-link ${location.pathname === '/expenses/ocr' ? 'active' : ''}`} aria-current={location.pathname === '/expenses/ocr' ? 'page' : undefined}>Scan Struk (OCR)</Link>
        </nav>
      )}
      <Link to="/budgets" className="expense-nav-link"><span>▤</span> Budget</Link>
      <Link to="/categories" className="expense-nav-link"><span>＋</span> Kategori</Link>
      <Link to="/subscriptions" className="expense-nav-link"><span>↻</span> Subscription</Link>
      <Link to="/reports" className="expense-nav-link"><span>▥</span> Laporan</Link>
      <Link to="/notifications" className="expense-nav-link"><span>♧</span> Notifikasi</Link>
      <div className="expense-sidebar-spacer" />
      <div className="expense-user">
        <span className="expense-avatar">{user?.name?.[0] ?? 'U'}</span>
        <span><strong>{user?.name ?? 'User'}</strong><small>{user?.email ?? ''}</small></span>
      </div>
      <button type="button" className="expense-logout" onClick={onLogout} disabled={loadingLogout}>
        {loadingLogout ? 'Keluar...' : 'Keluar akun'}
      </button>
    </aside>
  );
};

const ExpenseField = ({ label, children, className = '' }) => (
  <label className={`expense-field ${className}`}>
    <span>{label}</span>
    {children}
  </label>
);

const Expenses = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isHistory = location.pathname === '/expenses';
  const mode = location.pathname === '/expenses/ocr' ? 'ocr' : 'manual';
  const [period, setPeriod] = useState(currentPeriod);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [periodReport, setPeriodReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [form, setForm] = useState(initialForm);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [detailTransaction, setDetailTransaction] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deletingTransactionId, setDeletingTransactionId] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState('');
  const receiptPreviewUrl = useRef('');
  const [hasExtracted, setHasExtracted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingLogout, setLoadingLogout] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    return () => {
      if (receiptPreviewUrl.current) URL.revokeObjectURL(receiptPreviewUrl.current);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const [year, month] = period.split('-').map(Number);
        const firstDay = `${period}-01`;
        const lastDate = new Date(year, month, 0).getDate();
        const lastDay = `${period}-${String(lastDate).padStart(2, '0')}`;
        const [categoriesResponse, dashboardResponse, planResponse, transactionsResponse] = await Promise.all([
          api.get('/categories', { signal: controller.signal }),
          api.get('/dashboard', { params: { month, year }, signal: controller.signal }),
          api.get('/monthly-plans', { params: { month, year }, signal: controller.signal }),
          isHistory ? api.get('/transactions', {
            params: {
              date_from: dateFrom || firstDay,
              date_to: dateTo || lastDay,
              category_id: categoryFilter || undefined,
              search: search.trim() || undefined,
              page,
            },
            signal: controller.signal,
          }) : Promise.resolve(null),
        ]);
        const plan = planResponse.data.data[0];
        const budgetResponse = plan
          ? await api.get('/budgets', { params: { monthly_plan_id: plan.id }, signal: controller.signal })
          : null;
        setCategories(categoriesResponse.data.data);
        setDashboard(dashboardResponse.data.data);
        setBudgets(budgetResponse?.data.data ?? []);
        if (transactionsResponse) {
          setTransactions(transactionsResponse.data.data.data);
          setPagination({
            current_page: transactionsResponse.data.data.current_page,
            last_page: transactionsResponse.data.data.last_page,
            total: transactionsResponse.data.data.total,
          });
        }
      } catch (requestError) {
        if (requestError.code !== 'ERR_CANCELED') {
          setError(requestError.response?.data?.message ?? 'Data pengeluaran gagal dimuat. Coba lagi.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [period, categoryFilter, dateFrom, dateTo, search, page, refreshKey, isHistory]);

  useEffect(() => {
    if (!isHistory) return undefined;
    const controller = new AbortController();
    const [year, month] = period.split('-').map(Number);
    const loadPeriodReport = async () => {
      setReportLoading(true);
      setReportError('');
      try {
        const response = await api.get('/reports', {
          params: { year, month },
          signal: controller.signal,
        });
        setPeriodReport(response.data.data);
      } catch (requestError) {
        if (requestError.code !== 'ERR_CANCELED') {
          setReportError(requestError.response?.data?.message ?? 'Rekap pengeluaran gagal dimuat.');
        }
      } finally {
        if (!controller.signal.aborted) setReportLoading(false);
      }
    };
    loadPeriodReport();
    return () => controller.abort();
  }, [period, refreshKey, isHistory]);

  const selectedBudget = budgets.find((budget) => String(budget.id) === form.budget_id);
  const spentTotal = Number(dashboard?.summary?.spent_total ?? 0);
  const [periodYear, periodMonth] = period.split('-').map(Number);
  const isCurrentPeriod = new Date().getFullYear() === periodYear && new Date().getMonth() + 1 === periodMonth;
  const daysInPeriod = new Date(periodYear, periodMonth, 0).getDate();
  const dailyAverage = spentTotal / Math.max(1, isCurrentPeriod ? new Date().getDate() : daysInPeriod);
  const topCategory = useMemo(
    () => [...(dashboard?.budget_categories ?? [])].sort((left, right) => right.spent - left.spent)[0],
    [dashboard],
  );
  const projectedRemaining = selectedBudget
    ? Number(selectedBudget.amount) - Number(selectedBudget.spent_amount ?? 0) - Number(form.amount || 0)
    : null;

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const startEditing = (transaction) => {
    setEditingTransaction(transaction);
    setForm({
      budget_id: transaction.budget_id ? String(transaction.budget_id) : '',
      amount: String(Number(transaction.amount)),
      date: transaction.date.slice(0, 10),
      merchant: transaction.merchant ?? '',
      payment_method: transaction.payment_method ?? '',
      description: transaction.description ?? '',
    });
    setReceipt(null);
    setHasExtracted(false);
    setError('');
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditing = () => {
    setEditingTransaction(null);
    setForm(initialForm());
    setError('');
    setNotice('');
  };

  const handleViewDetails = async (transaction) => {
    setLoadingDetail(true);
    setError('');
    try {
      const response = await api.get(`/transactions/${transaction.id}`);
      setDetailTransaction(response.data.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Detail transaksi gagal dimuat. Coba lagi.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDelete = async (transaction) => {
    const transactionLabel = transaction.merchant || transaction.description || 'transaksi ini';
    if (!window.confirm(`Hapus pengeluaran "${transactionLabel}"? Tindakan ini tidak dapat dibatalkan.`)) return;

    setDeletingTransactionId(transaction.id);
    setError('');
    setNotice('');
    try {
      await api.delete(`/transactions/${transaction.id}`);
      notifyFinancialDataChanged();
      setNotice('Pengeluaran berhasil dihapus.');
      if (transactions.length === 1 && page > 1) setPage((current) => current - 1);
      else setRefreshKey((key) => key + 1);
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Pengeluaran gagal dihapus. Coba lagi.');
    } finally {
      setDeletingTransactionId(null);
    }
  };

  const prepareEntry = () => {
    setEditingTransaction(null);
    setError('');
    setNotice('');
    setHasExtracted(false);
    setReceipt(null);
    if (receiptPreviewUrl.current) URL.revokeObjectURL(receiptPreviewUrl.current);
    receiptPreviewUrl.current = '';
    setReceiptPreview('');
    setForm(initialForm());
  };

  const handleReceiptChange = (event) => {
    const selected = event.target.files?.[0] ?? null;
    if (receiptPreviewUrl.current) URL.revokeObjectURL(receiptPreviewUrl.current);
    receiptPreviewUrl.current = selected?.type.startsWith('image/')
      ? URL.createObjectURL(selected)
      : '';
    setReceiptPreview(receiptPreviewUrl.current);
    setReceipt(selected);
    setHasExtracted(false);
    setError('');
    setNotice('');
  };

  const handleExtract = async (event) => {
    event.preventDefault();
    if (!receipt) {
      setError('Pilih foto atau file struk terlebih dahulu.');
      return;
    }
    setProcessing(true);
    setError('');
    setNotice('');
    try {
      const formData = new FormData();
      formData.append('receipt', receipt);
      const response = await api.post('/receipt-extractions', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setForm((current) => ({
        ...current,
        merchant: response.data.data.merchant ?? '',
        amount: response.data.data.amount ?? '',
        date: response.data.data.date ?? '',
        payment_method: response.data.data.payment_method ?? '',
        description: response.data.data.description ?? '',
      }));
      setHasExtracted(true);
      setNotice('Hasil pembacaan siap ditinjau. Periksa semua kolom sebelum menyimpan.');
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Struk gagal diproses. Coba lagi atau catat secara manual.');
    } finally {
      setProcessing(false);
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        budget_id: form.budget_id ? Number(form.budget_id) : null,
        amount: Number(form.amount),
        date: form.date,
        merchant: form.merchant || null,
        payment_method: form.payment_method || null,
        description: form.description || null,
      };
      if (editingTransaction) {
        await api.put(`/transactions/${editingTransaction.id}`, payload);
      } else {
        await api.post('/transactions', { ...payload, source: mode });
      }
      notifyFinancialDataChanged();
      setEditingTransaction(null);
      setForm(initialForm());
      setReceipt(null);
      setHasExtracted(false);
      setNotice(editingTransaction ? 'Pengeluaran berhasil diperbarui.' : 'Pengeluaran berhasil disimpan.');
      setPage(1);
      setRefreshKey((key) => key + 1);
      if (!isHistory) navigate('/expenses');
    } catch (requestError) {
      const validationError = Object.values(requestError.response?.data?.errors ?? {})[0]?.[0];
      setError(validationError ?? requestError.response?.data?.message ?? 'Pengeluaran gagal disimpan. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    setLoadingLogout(true);
    try {
      await logout();
      navigate('/login');
    } catch {
      setError('Gagal keluar dari akun. Coba lagi.');
    } finally {
      setLoadingLogout(false);
    }
  };

  const pageTitle = monthLabel(period);
  const canSave = isHistory ? Boolean(editingTransaction) : mode === 'manual' || hasExtracted;

  return (
    <div className="expense-app">
      <Sidebar user={user} onLogout={handleLogout} loadingLogout={loadingLogout} onSelectEntry={prepareEntry} />
      <main className="expense-main">
        <header className="expense-topbar">
          <div className="expense-breadcrumb"><Link to="/dashboard">Dashboard</Link><span>/</span><strong>{isHistory ? 'Riwayat Pengeluaran' : mode === 'ocr' ? 'Scan Struk (OCR)' : 'Pengeluaran Manual'}</strong></div>
          <div className="expense-topbar-user"><span className="expense-topbar-avatar">{user?.name?.[0] ?? 'U'}</span><span>{user?.name ?? 'User'}</span></div>
        </header>

        <section className="expense-heading">
          <div>
            <span className="expense-eyebrow">{isHistory ? 'KELOLA TRANSAKSI' : mode === 'ocr' ? 'CATAT DARI STRUK' : 'CATAT PENGELUARAN'}</span>
            <h1>{isHistory ? 'Riwayat Pengeluaran' : mode === 'ocr' ? 'Scan Struk (OCR)' : 'Pengeluaran Manual'}</h1>
            <p>{isHistory
              ? 'Lihat, cari, edit, dan hapus seluruh transaksi pengeluaran Anda.'
              : mode === 'ocr'
                ? 'Unggah struk, tinjau hasil pembacaan, lalu konfirmasi transaksi.'
                : 'Catat transaksi secara langsung dengan mengisi detail pengeluaran.'}</p>
          </div>
          {isHistory ? (
            <div className="expense-heading-actions">
              <label className="expense-period">
                <span>Periode</span>
                <input type="month" value={period} onChange={(event) => {
                  setPeriod(event.target.value);
                  setDateFrom('');
                  setDateTo('');
                  setPage(1);
                }} />
              </label>
              <Link to="/expenses/manual" className="expense-button primary">＋ Catat Manual</Link>
              <Link to="/expenses/ocr" className="expense-button secondary">▣ Scan Struk (OCR)</Link>
            </div>
          ) : (
            <div className="expense-heading-actions">
              <label className="expense-period">
                <span>Periode</span>
                <input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
              </label>
              <Link to="/expenses" className="expense-button secondary expense-back-button">← Kembali ke riwayat</Link>
            </div>
          )}
        </section>

        {error && <div className="expense-alert error" role="alert">{error}</div>}

        {isHistory && <section className="expense-metrics" aria-label="Ringkasan pengeluaran">
          <article className="expense-metric-card">
            <span className="expense-metric-icon violet">↗</span>
            <div><span className="expense-metric-label">Total pengeluaran · {pageTitle}</span><strong>{currency(spentTotal)}</strong><small>Dari seluruh transaksi periode ini</small></div>
          </article>
          <article className="expense-metric-card">
            <span className="expense-metric-icon green">◷</span>
            <div><span className="expense-metric-label">Rata-rata pengeluaran harian</span><strong>{currency(dailyAverage)}</strong><small>Rata-rata sejak awal bulan</small></div>
          </article>
          <article className="expense-metric-card">
            <span className="expense-metric-icon orange">◇</span>
            <div><span className="expense-metric-label">Kategori pengeluaran tertinggi</span><strong>{topCategory?.category ?? 'Belum ada'}</strong><small>{topCategory ? currency(topCategory.spent) : 'Catat transaksi untuk melihat ringkasan'}</small></div>
          </article>
        </section>}

        {isHistory && <section className="expense-period-breakdown" aria-label="Rekap pengeluaran periode">
          <header className="expense-breakdown-heading">
            <div><span className="expense-eyebrow">REKAP PENGELUARAN</span><h2>Ringkasan {pageTitle}</h2></div>
            {reportLoading && <span role="status">Memperbarui...</span>}
          </header>
          {reportError && <div className="expense-alert error" role="alert">{reportError}</div>}
          {!reportError && periodReport && (
            <div className="expense-breakdown-grid">
              <article className="expense-breakdown-card">
                <h3>Per kategori</h3>
                {periodReport.category_spending.length ? (
                  <div className="expense-breakdown-list">
                    {periodReport.category_spending.map((item) => (
                      <div key={item.category}><span>{item.category}</span><strong>{currency(item.total)}</strong></div>
                    ))}
                  </div>
                ) : <p>Belum ada transaksi.</p>}
              </article>
              <article className="expense-breakdown-card">
                <h3>Per hari</h3>
                {periodReport.daily_spending.length ? (
                  <div className="expense-breakdown-list">
                    {periodReport.daily_spending.map((item) => (
                      <div key={item.date}><span>{dateLabel(item.date)}</span><strong>{currency(item.total)}</strong></div>
                    ))}
                  </div>
                ) : <p>Belum ada transaksi.</p>}
              </article>
            </div>
          )}
        </section>}

        {(!isHistory || editingTransaction) && <section className="expense-workspace">
          <article className="expense-panel expense-entry-panel">
            <header className="expense-panel-heading">
              <div><span className="expense-eyebrow">{editingTransaction ? 'UBAH TRANSAKSI' : mode === 'ocr' ? 'LANGKAH 1 · UPLOAD STRUK' : 'INPUT PENGELUARAN'}</span><h2>{editingTransaction ? 'Edit pengeluaran' : mode === 'ocr' ? 'Baca struk dengan OCR' : 'Detail pengeluaran'}</h2></div>
              <span className="expense-step-badge">01</span>
            </header>

            {mode === 'ocr' && (
              <form className="expense-upload-form" onSubmit={handleExtract}>
                <label className={`expense-dropzone ${receipt ? 'has-file' : ''}`}>
                  <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleReceiptChange} />
                  {receiptPreview
                    ? <img src={receiptPreview} alt="Pratinjau struk yang dipilih" />
                    : <span className="expense-upload-icon">⇧</span>}
                  <strong>{receipt?.name ?? 'Pilih atau tarik foto struk ke sini'}</strong>
                  <small>JPG, PNG, WEBP, atau PDF · Maks. 10 MB</small>
                  <span className="expense-upload-browse">Pilih file</span>
                </label>
                <button className="expense-button primary full-width" type="submit" disabled={processing || !receipt}>
                  {processing ? <><span className="expense-spinner" /> Membaca struk...</> : '✦  Baca Struk'}
                </button>
                <p className="expense-privacy-note">Hasil OCR perlu diperiksa dan dikonfirmasi sebelum masuk ke transaksi.</p>
              </form>
            )}

            {(mode === 'manual' || editingTransaction) && !editingTransaction && (
              <p className="expense-mode-description">Masukkan detail transaksi secara langsung. Kolom bertanda <b>*</b> wajib diisi.</p>
            )}

            {notice && <div className="expense-alert success" role="status">{notice}</div>}

            {canSave && (
              <form className="expense-fields-form" onSubmit={handleSave}>
                {mode === 'ocr' && <div className="expense-review-banner"><span>✓</span><span><strong>Tinjau hasil scan</strong><small>Pastikan jumlah dan tanggal sesuai dengan struk.</small></span></div>}
                <ExpenseField label="Nama toko / merchant">
                  <input name="merchant" value={form.merchant} onChange={updateField} placeholder="Contoh: Kopi Kenangan" maxLength="255" />
                </ExpenseField>
                <div className="expense-fields-row">
                  <ExpenseField label={<>Nominal pengeluaran <b>*</b></>}>
                    <div className="expense-currency-input"><span>Rp</span><input name="amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={updateField} placeholder="0" required /></div>
                  </ExpenseField>
                  <ExpenseField label={<>Tanggal transaksi <b>*</b></>}>
                    <input
                      name="date"
                      type="date"
                      value={form.date}
                      min={`${period}-01`}
                      max={`${period}-${String(daysInPeriod).padStart(2, '0')}`}
                      onChange={updateField}
                      required
                    />
                  </ExpenseField>
                </div>
                <ExpenseField label="Kategori / alokasi budget">
                  <select name="budget_id" value={form.budget_id} onChange={updateField}>
                    <option value="">Tanpa kategori budget</option>
                    {budgets.map((budget) => <option key={budget.id} value={budget.id}>{budget.category.name}</option>)}
                  </select>
                  {budgets.length === 0 && <small className="expense-field-hint">Belum ada alokasi periode ini. <Link to="/budgets">Atur budget</Link></small>}
                </ExpenseField>
                <div className="expense-fields-row">
                  <ExpenseField label="Metode pembayaran">
                    <select name="payment_method" value={form.payment_method} onChange={updateField}>
                      <option value="">Pilih metode</option><option>Cash</option><option>Debit</option><option>Kartu kredit</option><option>QRIS</option><option>E-wallet</option><option>Transfer</option>
                    </select>
                  </ExpenseField>
                  <ExpenseField label="Catatan">
                    <input name="description" value={form.description} onChange={updateField} placeholder="Contoh: makan siang" maxLength="2000" />
                  </ExpenseField>
                </div>
                <div className="expense-form-actions">
                  {editingTransaction && <button type="button" className="expense-button secondary full-width" onClick={cancelEditing} disabled={saving}>Batal</button>}
                  <button type="submit" className="expense-button primary full-width" disabled={saving}>
                    {saving ? 'Menyimpan...' : editingTransaction ? 'Simpan Perubahan' : mode === 'ocr' ? 'Konfirmasi & Simpan Pengeluaran' : 'Simpan Pengeluaran'}
                  </button>
                </div>
              </form>
            )}
          </article>

          <aside className="expense-impact-column">
            <article className="expense-panel expense-impact-panel">
              <header className="expense-panel-heading">
                <div><span className="expense-eyebrow">DAMPAK TRANSAKSI</span><h2>Budget kategori</h2></div>
                <span className="expense-step-badge">02</span>
              </header>
              {selectedBudget ? (
                <>
                  <div className="expense-impact-category">
                    <span className="expense-category-dot" style={{ backgroundColor: selectedBudget.category.color || '#6d5ce8' }} />
                    <strong>{selectedBudget.category.name}</strong>
                    <span>{currency(selectedBudget.amount)}</span>
                  </div>
                  <div className="expense-impact-progress">
                    <div><span>Terpakai sekarang</span><strong>{currency(selectedBudget.spent_amount ?? 0)}</strong></div>
                    <div className="expense-progress-track"><span style={{ width: `${Math.min(100, Number(selectedBudget.amount) > 0 ? Number(selectedBudget.spent_amount ?? 0) / Number(selectedBudget.amount) * 100 : 0)}%` }} /></div>
                    <div><span>Sisa sebelum transaksi</span><strong>{currency(Number(selectedBudget.amount) - Number(selectedBudget.spent_amount ?? 0))}</strong></div>
                  </div>
                  {form.amount && (
                    <div className={`expense-projected-balance ${projectedRemaining < 0 ? 'over' : ''}`}>
                      <span>Perkiraan sisa setelah transaksi</span><strong>{currency(projectedRemaining)}</strong>
                      {projectedRemaining < 0 && <small>Nominal ini akan melewati alokasi budget kategori.</small>}
                    </div>
                  )}
                </>
              ) : (
                <div className="expense-impact-empty"><span>⌁</span><strong>Pilih kategori budget</strong><p>Pilih alokasi kategori pada formulir untuk melihat dampaknya di sini.</p></div>
              )}
            </article>
            <article className="expense-budget-tip">
              <span>✦</span><div><strong>Catat segera, pantau lebih baik</strong><p>Catatan transaksi membantu melihat pola pengeluaran dan menjaga budget tetap terkendali.</p></div>
            </article>
            <Link to="/budgets" className="expense-budget-link">Kelola budget bulanan <span>→</span></Link>
          </aside>
        </section>}

        {isHistory && <section className="expense-panel expense-history-panel">
          <header className="expense-history-header">
            <div><span className="expense-eyebrow">RIWAYAT TRANSAKSI</span><h2>Pengeluaran {pageTitle}</h2><p>{pagination.total} transaksi tercatat</p></div>
            <div className="expense-filters">
              <label className="expense-search"><span>⌕</span><input value={search} onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }} placeholder="Cari toko atau catatan..." /></label>
              <label className="expense-date-filter">
                <span>Dari tanggal</span>
                <input
                  type="date"
                  aria-label="Tanggal awal pengeluaran"
                  min={`${period}-01`}
                  max={dateTo || `${period}-${String(new Date(periodYear, periodMonth, 0).getDate()).padStart(2, '0')}`}
                  value={dateFrom}
                  onChange={(event) => {
                    setDateFrom(event.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label className="expense-date-filter">
                <span>Sampai tanggal</span>
                <input
                  type="date"
                  aria-label="Tanggal akhir pengeluaran"
                  min={dateFrom || `${period}-01`}
                  max={`${period}-${String(new Date(periodYear, periodMonth, 0).getDate()).padStart(2, '0')}`}
                  value={dateTo}
                  onChange={(event) => {
                    setDateTo(event.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <select aria-label="Filter kategori" value={categoryFilter} onChange={(event) => {
                setCategoryFilter(event.target.value);
                setPage(1);
              }}>
                <option value="">Semua kategori</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <button
                type="button"
                className="expense-filter-reset"
                onClick={() => {
                  setSearch('');
                  setCategoryFilter('');
                  setDateFrom('');
                  setDateTo('');
                  setPage(1);
                }}
                disabled={!search && !categoryFilter && !dateFrom && !dateTo}
              >
                Reset filter
              </button>
            </div>
          </header>
          {loading ? <div className="expense-empty-state">Memuat transaksi...</div> : transactions.length === 0 ? (
            <div className="expense-empty-state"><span>↗</span><strong>Belum ada pengeluaran</strong><p>Transaksi pada periode ini akan tampil di sini setelah dicatat.</p></div>
          ) : (
            <>
              <div className="expense-table-scroll">
                <table className="expense-table">
                  <thead><tr><th>TRANSAKSI</th><th>KATEGORI</th><th>TANGGAL</th><th>METODE</th><th>SUMBER</th><th className="amount-cell">NOMINAL</th><th className="expense-actions-heading">AKSI</th></tr></thead>
                  <tbody>{transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td><strong>{transaction.merchant || transaction.description || 'Pengeluaran'}</strong><small>{transaction.description && transaction.merchant ? transaction.description : `Transaksi #${transaction.id}`}</small></td>
                      <td>{transaction.budget?.category?.name ?? <span className="expense-muted">Tanpa kategori</span>}</td>
                      <td>{dateLabel(transaction.date.slice(0, 10))}</td>
                      <td>{transaction.payment_method || <span className="expense-muted">—</span>}</td>
                      <td><span className={`expense-source-tag ${transaction.source === 'ocr' ? 'ocr' : ''}`}>{transaction.source === 'ocr' ? 'Scan OCR' : 'Manual'}</span></td>
                      <td className="amount-cell"><strong>{currency(transaction.amount)}</strong></td>
                      <td className="expense-row-actions">
                        <button type="button" aria-label={`Lihat detail ${transaction.merchant || transaction.description || 'pengeluaran'}`} title="Lihat detail" onClick={() => handleViewDetails(transaction)} disabled={loadingDetail}>
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></svg>
                        </button>
                        <button type="button" aria-label={`Edit ${transaction.merchant || transaction.description || 'pengeluaran'}`} title="Edit" onClick={() => startEditing(transaction)}>
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4.2-.8L20 7.4 16.6 4 4.8 15.8 4 20Z" /></svg>
                        </button>
                        <button type="button" className="delete" aria-label={`Hapus ${transaction.merchant || transaction.description || 'pengeluaran'}`} title="Hapus" onClick={() => handleDelete(transaction)} disabled={deletingTransactionId === transaction.id}>
                          {deletingTransactionId === transaction.id
                            ? <span aria-hidden="true">…</span>
                            : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M5.5 7l1 14h11l1-14M9 7V4h6v3" /></svg>}
                        </button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <footer className="expense-pagination">
                <span>Halaman {pagination.current_page} dari {pagination.last_page}</span>
                <div><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading}>Sebelumnya</button><button type="button" onClick={() => setPage((value) => Math.min(pagination.last_page, value + 1))} disabled={page >= pagination.last_page || loading}>Berikutnya</button></div>
              </footer>
            </>
          )}
        </section>}
      </main>
      {detailTransaction && (
        <div className="expense-dialog-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDetailTransaction(null);
        }}>
          <section className="expense-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="expense-detail-title">
            <header className="expense-detail-heading">
              <div><span className="expense-eyebrow">RINCIAN TRANSAKSI</span><h2 id="expense-detail-title">Detail pengeluaran</h2></div>
              <button type="button" className="expense-detail-close" onClick={() => setDetailTransaction(null)} aria-label="Tutup detail">×</button>
            </header>
            <div className="expense-detail-amount">{currency(detailTransaction.amount)}</div>
            <dl className="expense-detail-list">
              <div><dt>Nama toko / merchant</dt><dd>{detailTransaction.merchant || '—'}</dd></div>
              <div><dt>Catatan</dt><dd>{detailTransaction.description || '—'}</dd></div>
              <div><dt>Kategori</dt><dd>{detailTransaction.budget?.category?.name || 'Tanpa kategori'}</dd></div>
              <div><dt>Tanggal</dt><dd>{dateLabel(detailTransaction.date.slice(0, 10))}</dd></div>
              <div><dt>Metode pembayaran</dt><dd>{detailTransaction.payment_method || '—'}</dd></div>
              <div><dt>Sumber pencatatan</dt><dd>{detailTransaction.source === 'ocr' ? 'Scan OCR' : 'Manual'}</dd></div>
            </dl>
            <footer className="expense-detail-footer">
              <button type="button" className="expense-button secondary" onClick={() => setDetailTransaction(null)}>Tutup</button>
              <button type="button" className="expense-button primary" onClick={() => {
                setDetailTransaction(null);
                startEditing(detailTransaction);
              }}>Edit transaksi</button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
};

export default Expenses;
