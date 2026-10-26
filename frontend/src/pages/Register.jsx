import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    password_confirmation: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const isMounted = useRef(false);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.password_confirmation) {
      setError('Password tidak cocok');
      return;
    }
    if (formData.password.length < 8) {
      setError('Password minimal 8 karakter');
      return;
    }

    setLoading(true);
    try {
      await register(formData);
      if (isMounted.current) navigate('/dashboard', { replace: true });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Registrasi gagal. Coba lagi.';
      if (isMounted.current) setError(message);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  // Styles (inline cepat untuk copy-paste; pindahkan ke CSS jika diperlukan)
  const pageStyle = { minHeight: '100vh', background: '#f7fafc', display: 'flex', flexDirection: 'column' };
  const headerStyle = { padding: '16px 40px', maxWidth: 1200, margin: '0 auto', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box' };
  const logoStyle = { display: 'flex', alignItems: 'center', gap: 10, color: '#0f172a', fontWeight: 700 };
  const containerStyle = { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '36px 20px', boxSizing: 'border-box' };
  const innerStyle = { width: '100%', maxWidth: 1200, display: 'grid', gridTemplateColumns: '1fr 420px', gap: 36, alignItems: 'start' };
  const leftCol = { background: 'transparent' };
  const rightColCard = { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 10px 30px rgba(2,6,23,0.06)' };
  const headingStyle = { fontSize: 28, margin: 0, lineHeight: 1.05, color: '#0f172a' };
  const highlight = { color: '#4f46e5' };
  const descStyle = { marginTop: 10, fontSize: 15, color: '#475569', maxWidth: 560 };
  const featureCard = { display: 'flex', gap: 14, alignItems: 'flex-start', background: '#fff', borderRadius: 10, padding: '12px 14px', boxShadow: '0 6px 18px rgba(15,23,42,0.03)', border: '1px solid rgba(15,23,42,0.03)' };
  const featureIconBox = { width: 40, height: 40, borderRadius: 8, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5', fontWeight: 700 };
  const smallText = { fontSize: 13, color: '#6b7280' };
  const inputWrap = { display: 'flex', alignItems: 'center', gap: 10, background: '#f1f5f9', borderRadius: 8, padding: '10px 12px', border: '1px solid rgba(99,102,241,0.06)' };
  const input = { border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 14, color: '#0f172a' };
  const labelStyle = { display: 'block', marginBottom: 8, fontSize: 13, color: '#374151', fontWeight: 600 };
  const primaryBtn = { width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: 'linear-gradient(90deg,#6c63ff 0%,#764ba2 100%)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: '0 8px 20px rgba(108,99,255,0.16)' };
  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div style={logoStyle}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#111827', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>BH</div>
          <div>Bocor Halus Financial OS</div>
        </div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          <a href="#" style={{ color: '#6b7280', textDecoration: 'none' }}>Versi 1.0 • SSO</a>
        </div>
      </header>

      <main style={containerStyle}>
        <div style={innerStyle}>
          {/* LEFT: marketing / feature list */}
          <section style={leftCol}>
            <h1 style={headingStyle}>
              Mulai Audit Finansial Pertama Anda <span style={highlight}>dalam 2 Menit.</span>
            </h1>
            <p style={descStyle}>
              Daftar sekarang untuk mendapatkan ringkasan arus kas, rekomendasi penghematan, dan target tabungan otomatis. Mudah dipakai — langsung dapat insight.
            </p>

            <div style={{ marginTop: 22, display: 'grid', gap: 12 }}>
              <div style={featureCard}>
                <div style={featureIconBox}>1</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Pelacak Pengeluaran Harian</div>
                  <div style={smallText}>Catat pengeluaran secara cepat dan otomatis, lihat kategori utama.</div>
                </div>
              </div>

              <div style={featureCard}>
                <div style={featureIconBox}>2</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Analisis Rutin Keuangan</div>
                  <div style={smallText}>Laporan bulanan & rekomendasi untuk menurunkan pengeluaran.</div>
                </div>
              </div>

              <div style={featureCard}>
                <div style={featureIconBox}>3</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Target & Proteksi</div>
                  <div style={smallText}>Atur target saldo dan pantau progres dengan cepat.</div>
                </div>
              </div>
            </div>

            {/* target card */}
            <div style={{ marginTop: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ background: '#fff', padding: 14, borderRadius: 10, boxShadow: '0 8px 24px rgba(15,23,42,0.04)', minWidth: 220 }}>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Target Proteksi Saldo</div>
                <div style={{ marginTop: 8, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Rp 500.000</div>
                <div style={{ marginTop: 8, height: 8, background: '#eef2ff', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ width: '68%', height: '100%', background: '#4f46e5' }} />
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>Progres 68%</div>
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                Gratis untuk penggunaan dasar. Upgrade untuk fitur laporan lengkap dan saran otomatis.
              </div>
            </div>

            <div style={{ marginTop: 26, color: '#9ca3af', fontSize: 12 }}>
              © {new Date().getFullYear()} Bocor Halus. Hak cipta dilindungi.
            </div>
          </section>

          {/* RIGHT: register form card */}
          <aside style={rightColCard} aria-labelledby="register-title">
            <h3 id="register-title" style={{ margin: 0, fontSize: 16, color: '#0f172a', fontWeight: 800 }}>Buat Akun</h3>
            <p style={{ marginTop: 8, marginBottom: 14, color: '#6b7280', fontSize: 13 }}>
              Isi data dasar untuk memulai audit finansial Anda. Cepat dan aman.
            </p>

            {error && (
              <div role="alert" style={{ background: '#fff1f2', color: '#b91c1c', padding: '10px 12px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div style={{ marginBottom: 12 }}>
                <label htmlFor="name" style={labelStyle}>Nama Lengkap</label>
                <div style={inputWrap}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 21v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <input id="name" name="name" type="text" value={formData.name} onChange={handleChange} placeholder="Masukkan nama lengkap" required style={input} autoComplete="name" />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label htmlFor="email" style={labelStyle}>Alamat Email</label>
                <div style={inputWrap}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M3 7.5v9A2.5 2.5 0 0 0 5.5 19h13A2.5 2.5 0 0 0 21 16.5v-9" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 7.5L12 13 3 7.5" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <input id="email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="name@email.com" required style={input} autoComplete="email" />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label htmlFor="password" style={labelStyle}>Password</label>
                <div style={inputWrap}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <rect x="3.5" y="10.5" width="17" height="9" rx="2" stroke="#9CA3AF" strokeWidth="1.4" />
                    <path d="M7 10.5V8a5 5 0 0 1 10 0v2.5" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <input id="password" name="password" type="password" value={formData.password} onChange={handleChange} placeholder="Minimal 8 karakter" required minLength={8} style={input} autoComplete="new-password" />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label htmlFor="password_confirmation" style={labelStyle}>Konfirmasi Password</label>
                <div style={inputWrap}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <rect x="3.5" y="10.5" width="17" height="9" rx="2" stroke="#9CA3AF" strokeWidth="1.4" />
                    <path d="M7 10.5V8a5 5 0 0 1 10 0v2.5" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <input id="password_confirmation" name="password_confirmation" type="password" value={formData.password_confirmation} onChange={handleChange} placeholder="Ulangi password" required minLength={8} style={input} autoComplete="new-password" />
                </div>
              </div>

              <button type="submit" disabled={loading} aria-busy={loading} style={primaryBtn}>
                {loading ? 'Memproses...' : 'Daftar'}
              </button>
            </form>

            <p style={{ marginTop: 12, textAlign: 'center', fontSize: 13, color: '#6b7280' }}>
              Sudah punya akun? <Link to="/login" style={{ color: '#4f46e5', fontWeight: 700, textDecoration: 'none' }}>Masuk</Link>
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default Register;