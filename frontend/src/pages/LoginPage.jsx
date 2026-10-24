import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  GraduationCap,
  Users,
  CheckCircle,
  ArrowRight,
  Lock,
  Mail,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';

const DEMO_CREDENTIALS = [
  { role: 'admin', email: 'admin@edumanage.com', password: 'Password@123', label: 'Administrator', icon: ShieldCheck },
  { role: 'teacher', email: 'amit@edumanage.com', password: 'Password@123', label: 'Teacher', icon: Users },
  { role: 'student', email: 'aarav@edumanage.com', password: 'Password@123', label: 'Student', icon: GraduationCap },
  { role: 'parent', email: 'suresh@edumanage.com', password: 'Password@123', label: 'Parent', icon: Users },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      if (data.success) {
        const { token, user } = data.data;
        login(user, token);
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials. Please verify email and password.');
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(cred) {
    setEmail(cred.email);
    setPassword(cred.password);
    setError('');
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: '1.1fr 0.9fr',
      backgroundColor: 'var(--bg-app)',
    }}>
      {/* Left Brand Panel */}
      <div style={{
        background: 'linear-gradient(145deg, #14532d 0%, #166534 50%, #064e3b 100%)',
        color: '#ffffff',
        padding: '60px 80px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Subtle decorative circle */}
        <div style={{
          position: 'absolute',
          top: '-10%',
          right: '-10%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(220, 252, 231, 0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
          }}>
            <ShieldCheck size={26} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>EduManage</h3>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#86efac', fontWeight: 600 }}>
              Institutional SaaS Platform
            </span>
          </div>
        </div>

        <div style={{ margin: '40px 0', maxWidth: 520 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'rgba(255, 255, 255, 0.12)',
            fontSize: '0.78rem',
            fontWeight: 600,
            color: '#bbf7d0',
            marginBottom: 20,
          }}>
            <Sparkles size={13} /> Trusted by 500+ Schools Worldwide
          </div>

          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, lineHeight: 1.2, color: '#ffffff', marginBottom: 16 }}>
            Modern, intelligent management for modern schools.
          </h1>

          <p style={{ color: '#dcfce7', fontSize: '0.95rem', lineHeight: 1.6, opacity: 0.9 }}>
            A unified management ecosystem connecting school administration, educators, students, and parents with live attendance, automated grading, and digital fee processing.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 36 }}>
            {[
              'Enterprise-Grade Role Access (Admin, Teacher, Student, Parent)',
              'Live Daily Attendance & Instant Absence Alerts',
              'End-to-End Curriculum, Examination & Gradebook Management',
              'Automated Tuition Fee Billing & Receipt Ledger',
            ].map((feat, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem', color: '#f0fdf4' }}>
                <CheckCircle size={17} color="#4ade80" />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: '0.75rem', color: '#86efac', opacity: 0.8 }}>
          © 2026 EduManage Technologies Inc. All rights reserved.
        </div>
      </div>

      {/* Right Login Form */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        backgroundColor: 'var(--bg-surface)',
      }}>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          style={{ width: '100%', maxWidth: 420 }}
        >
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Sign in to Portal
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 4 }}>
              Enter your credentials or choose a 1-click demo account below.
            </p>
          </div>

          {/* 1-Click Demo Accounts */}
          <div style={{ marginBottom: 20 }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
              Quick Demo Access
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 8 }}>
              {DEMO_CREDENTIALS.map(c => {
                const CIcon = c.icon;
                return (
                  <button
                    key={c.role}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => fillDemo(c)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      padding: '10px 6px',
                      fontSize: '0.75rem',
                      height: 'auto',
                    }}
                  >
                    <CIcon size={16} color="var(--primary)" />
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div style={{
              padding: '10px 14px',
              backgroundColor: 'var(--danger-light)',
              color: 'var(--danger)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8rem',
              marginBottom: 16,
              border: '1px solid rgba(220, 38, 38, 0.2)',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email Address</label>
              <div className="search-input-wrapper">
                <Mail size={16} />
                <input
                  id="email"
                  type="email"
                  required
                  className="form-input"
                  placeholder="admin@edumanage.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <div className="search-input-wrapper">
                <Lock size={16} />
                <input
                  id="password"
                  type="password"
                  required
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
              style={{ marginTop: 8 }}
            >
              {loading ? 'Authenticating…' : (
                <>
                  Sign In to EduManage <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
