import { useState, useEffect, useRef } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  CheckCircle,
  ArrowRight,
  Lock,
  Mail,
  User,
  Sparkles,
  Eye,
  EyeOff,
  KeyRound,
  RotateCw,
  ArrowLeft,
  AlertCircle,
  Check,
  Users,
  GraduationCap,
  UserCheck,
  BookOpen,
  Info,
  Building2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';

const PORTAL_ROLES = [
  {
    id: 'admin',
    name: 'Admin Portal',
    shortName: 'Admin',
    tagline: 'Institution Governance',
    description: 'Institution-wide control, security policies, and administrative operations.',
    icon: ShieldCheck,
    badge: 'Dual-Factor 2FA',
    color: '#065f46',
    bgLight: '#dcfce7',
  },
  {
    id: 'faculty',
    name: 'Faculty Portal',
    shortName: 'Faculty',
    tagline: 'Classes & Grading',
    description: 'Manage assigned classes, student attendance, exams, and academic gradebooks.',
    icon: Users,
    badge: 'Direct Access',
    color: '#1e40af',
    bgLight: '#dbeafe',
  },
  {
    id: 'student',
    name: 'Student Portal',
    shortName: 'Student',
    tagline: 'Courses & Results',
    description: 'Access academic curriculum, attendance reports, exam schedules, and term grades.',
    icon: GraduationCap,
    badge: 'Direct Access',
    color: '#047857',
    bgLight: '#d1fae5',
  },
  {
    id: 'parent',
    name: 'Parent Portal',
    shortName: 'Parent',
    tagline: 'Progress & Fees',
    description: "Monitor children's attendance ratios, exam scorecards, and tuition fee schedules.",
    icon: UserCheck,
    badge: 'Family Access',
    color: '#b45309',
    bgLight: '#fef3c7',
  },
  {
    id: 'librarian',
    name: 'Librarian Portal',
    shortName: 'Librarian',
    tagline: 'Catalog & Books',
    description: 'Manage curriculum textbooks, academic subject repositories, and book circulation.',
    icon: BookOpen,
    badge: 'Direct Access',
    color: '#7c3aed',
    bgLight: '#ede9fe',
  },
];

export default function LoginPage() {
  // Navigation mode: 'login' | 'signup' | 'admin-otp'
  const [mode, setMode] = useState('login');

  // Selected Role for Login (defaults to 'admin')
  const [selectedRole, setSelectedRole] = useState('admin');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Sign Up form state
  const [signupRole, setSignupRole] = useState('student');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Admin OTP state
  const [adminTempToken, setAdminTempToken] = useState('');
  const [adminMaskedEmail, setAdminMaskedEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpCountdown, setOtpCountdown] = useState(300); // 5 minutes in seconds
  const [canResend, setCanResend] = useState(false);
  const otpInputRefs = useRef([]);

  // Shared UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  // Currently active role object
  const currentRole = PORTAL_ROLES.find((r) => r.id === selectedRole) || PORTAL_ROLES[0];

  // OTP Countdown Timer
  useEffect(() => {
    let timer;
    if (mode === 'admin-otp' && otpCountdown > 0) {
      timer = setInterval(() => {
        setOtpCountdown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          if (prev <= 270) {
            // Can resend after 30 seconds
            setCanResend(true);
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [mode, otpCountdown]);

  function switchTab(newMode) {
    setMode(newMode);
    setError('');
    setSuccessMessage('');
  }

  // Handle Role Selection
  function handleSelectRole(roleId) {
    setSelectedRole(roleId);
    setError('');
    setSuccessMessage('');
  }

  // Handle Standard Login
  async function handleLoginSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      const { data } = await api.post('/auth/login', {
        email: loginEmail,
        password: loginPassword,
        selectedRole: selectedRole,
      });

      if (data.success) {
        if (data.data.requiresOtp) {
          // Admin OTP 2FA required
          setAdminTempToken(data.data.tempToken);
          setAdminMaskedEmail(data.data.email);
          setOtpDigits(['', '', '', '', '', '']);
          setOtpCountdown(300);
          setCanResend(false);
          setMode('admin-otp');
          setSuccessMessage(data.data.message || 'Verification code sent to registered admin email.');
        } else {
          // Standard direct login for verified role
          const { token, user } = data.data;
          login(user, token);
          navigate('/', { replace: true });
        }
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Authentication failed. Please verify your credentials and selected portal.'
      );
    } finally {
      setLoading(false);
    }
  }

  // Handle Admin OTP Verification
  async function handleVerifyOtp(e) {
    if (e) e.preventDefault();
    const fullOtp = otpDigits.join('');
    if (fullOtp.length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      const { data } = await api.post('/auth/verify-otp', {
        tempToken: adminTempToken,
        otp: fullOtp,
      });

      if (data.success) {
        const { token, user } = data.data;
        login(user, token);
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  }

  // Handle Resend OTP
  async function handleResendOtp() {
    if (!canResend || loading) return;
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      const { data } = await api.post('/auth/resend-otp', {
        tempToken: adminTempToken,
      });

      if (data.success) {
        setAdminTempToken(data.data.tempToken);
        setOtpCountdown(300);
        setCanResend(false);
        setOtpDigits(['', '', '', '', '', '']);
        setSuccessMessage(data.data.message || 'A fresh verification code has been dispatched.');
        if (otpInputRefs.current[0]) otpInputRefs.current[0].focus();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Handle Sign Up
  async function handleSignupSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (signupRole !== 'student' && signupRole !== 'parent') {
      setError('Faculty, Librarian, and Administrator accounts must be created by institution management.');
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      setError('Passwords do not match. Please verify your entries.');
      return;
    }

    if (signupPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const { data } = await api.post('/auth/register', {
        name: signupName,
        email: signupEmail,
        password: signupPassword,
        role: signupRole,
      });

      if (data.success) {
        const { token, user } = data.data;
        login(user, token);
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please check your information.');
    } finally {
      setLoading(false);
    }
  }

  // OTP Input navigation helpers
  function handleOtpChange(index, value) {
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...otpDigits];
    if (value.length > 1) {
      const pasted = value.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pasted[i] || '';
      }
      setOtpDigits(newDigits);
      const nextIndex = Math.min(pasted.length, 5);
      if (otpInputRefs.current[nextIndex]) {
        otpInputRefs.current[nextIndex].focus();
      }
      return;
    }

    newDigits[index] = value.slice(-1);
    setOtpDigits(newDigits);

    if (value && index < 5 && otpInputRefs.current[index + 1]) {
      otpInputRefs.current[index + 1].focus();
    }
  }

  function handleOtpKeyDown(index, e) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1].focus();
    }
  }

  // Format countdown mm:ss
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: '1.05fr 0.95fr',
        backgroundColor: 'var(--bg-app)',
      }}
      className="login-container"
    >
      {/* ─── LEFT BRAND PANEL ───────────────────────────────────────────── */}
      <div
        style={{
          background: 'linear-gradient(145deg, #14532d 0%, #166534 50%, #064e3b 100%)',
          color: '#ffffff',
          padding: '48px 64px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
        }}
        className="brand-panel"
      >
        {/* Subtle decorative circles */}
        <div
          style={{
            position: 'absolute',
            top: '-10%',
            right: '-10%',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(220, 252, 231, 0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-15%',
            left: '-15%',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(220, 252, 231, 0.05) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(255, 255, 255, 0.16)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
            }}
          >
            <ShieldCheck size={28} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', margin: 0 }}>
              EduManage
            </h3>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#86efac', fontWeight: 600 }}>
              Multi-Role Educational Platform
            </span>
          </div>
        </div>

        {/* Brand Value Proposition */}
        <div style={{ margin: '36px 0', maxWidth: 540 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: '#bbf7d0',
              marginBottom: 18,
            }}
          >
            <Sparkles size={14} /> Unified Multi-Role Authentication
          </div>

          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, lineHeight: 1.22, color: '#ffffff', marginBottom: 16 }}>
            Dedicated portals tailored for every campus stakeholder.
          </h1>

          <p style={{ color: '#dcfce7', fontSize: '0.94rem', lineHeight: 1.6, opacity: 0.9 }}>
            Seamlessly switch between institutional governance, faculty classrooms, student learning suites, family progress trackers, and library circulation desks.
          </p>

          {/* Interactive Role Highlights */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginTop: 28 }}>
            {PORTAL_ROLES.map((r) => {
              const IconComp = r.icon;
              const isSelected = selectedRole === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => handleSelectRole(r.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                    backdropFilter: 'blur(4px)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: isSelected ? '1px solid #86efac' : '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      backgroundColor: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.15)',
                      color: isSelected ? '#166534' : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <IconComp size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#ffffff' }}>{r.name}</span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '1px 6px',
                          borderRadius: 4,
                          backgroundColor: isSelected ? '#bbf7d0' : 'rgba(255, 255, 255, 0.15)',
                          color: isSelected ? '#14532d' : '#e2e8f0',
                          fontWeight: 600,
                        }}
                      >
                        {r.badge}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.74rem', color: '#dcfce7', opacity: 0.85, display: 'block' }}>
                      {r.tagline}
                    </span>
                  </div>
                  {isSelected && <Check size={16} style={{ color: '#86efac' }} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Brand Footer */}
        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.15)', paddingTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.76rem', color: 'rgba(255, 255, 255, 0.75)' }}>
            © {new Date().getFullYear()} EduManage Enterprise
          </span>
          <span style={{ fontSize: '0.76rem', color: '#86efac', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block' }} />
            TiDB Cloud SSL Protected
          </span>
        </div>
      </div>

      {/* ─── RIGHT AUTHENTICATION PANEL ─────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '36px 40px',
          backgroundColor: 'var(--bg-surface)',
          overflowY: 'auto',
        }}
        className="form-panel"
      >
        <div style={{ width: '100%', maxWidth: 520 }}>
          {/* Navigation Tabs (Only in Login or Sign Up mode) */}
          {mode !== 'admin-otp' && (
            <div
              style={{
                display: 'flex',
                background: 'var(--bg-muted)',
                padding: 4,
                borderRadius: 'var(--radius-lg)',
                marginBottom: 24,
                border: '1px solid var(--border)',
              }}
            >
              <button
                type="button"
                onClick={() => switchTab('login')}
                style={{
                  flex: 1,
                  padding: '9px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: mode === 'login' ? 'var(--bg-surface)' : 'transparent',
                  color: mode === 'login' ? 'var(--primary)' : 'var(--text-secondary)',
                  boxShadow: mode === 'login' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchTab('signup')}
                style={{
                  flex: 1,
                  padding: '9px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: mode === 'signup' ? 'var(--bg-surface)' : 'transparent',
                  color: mode === 'signup' ? 'var(--primary)' : 'var(--text-secondary)',
                  boxShadow: mode === 'signup' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                Create Account
              </button>
            </div>
          )}

          {/* Feedback Alerts */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                backgroundColor: 'var(--danger-light)',
                color: 'var(--danger)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.82rem',
                marginBottom: 20,
                border: '1px solid rgba(220, 38, 38, 0.2)',
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 500 }}>{error}</span>
            </motion.div>
          )}

          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                backgroundColor: 'var(--success-light)',
                color: 'var(--success)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.82rem',
                marginBottom: 20,
                border: '1px solid rgba(22, 163, 74, 0.2)',
              }}
            >
              <Check size={18} style={{ flexShrink: 0 }} />
              <span>{successMessage}</span>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {/* ─── 1. LOGIN FORM WITH ROLE SELECTION ──────────────────────── */}
            {mode === 'login' && (
              <motion.div
                key="login-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                {/* Role Selection Header */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                      Select Institution Portal
                    </label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-primary-600)', fontWeight: 600 }}>
                      Active: {currentRole.name}
                    </span>
                  </div>

                  {/* 5 Selectable Role Cards */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))',
                      gap: 8,
                    }}
                  >
                    {PORTAL_ROLES.map((r) => {
                      const IconComp = r.icon;
                      const isSelected = selectedRole === r.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => handleSelectRole(r.id)}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '10px 6px',
                            borderRadius: 'var(--radius-md)',
                            border: isSelected ? '2px solid #166534' : '1px solid var(--border)',
                            backgroundColor: isSelected ? '#f0fdf4' : 'var(--bg-card)',
                            cursor: 'pointer',
                            transition: 'all 0.18s ease',
                            position: 'relative',
                            boxShadow: isSelected ? '0 2px 8px rgba(22, 101, 52, 0.15)' : 'none',
                          }}
                        >
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              backgroundColor: isSelected ? '#166534' : 'var(--bg-muted)',
                              color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginBottom: 6,
                              transition: 'all 0.18s ease',
                            }}
                          >
                            <IconComp size={16} />
                          </div>
                          <span
                            style={{
                              fontSize: '0.76rem',
                              fontWeight: isSelected ? 700 : 600,
                              color: isSelected ? '#166534' : 'var(--text-primary)',
                              textAlign: 'center',
                              lineHeight: 1.1,
                            }}
                          >
                            {r.shortName}
                          </span>
                          {isSelected && (
                            <div
                              style={{
                                position: 'absolute',
                                top: 4,
                                right: 4,
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                backgroundColor: '#16a34a',
                              }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Form Heading tailored to selected role */}
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-muted)',
                    border: '1px solid var(--border)',
                    marginBottom: 20,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <currentRole.icon size={18} style={{ color: '#166534' }} />
                      <h2 style={{ fontSize: '1.08rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                        {currentRole.name}
                      </h2>
                    </div>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 999,
                        backgroundColor: currentRole.bgLight,
                        color: currentRole.color,
                      }}
                    >
                      {currentRole.badge}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    {currentRole.description}
                  </p>
                  {selectedRole === 'admin' && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginTop: 8,
                        paddingTop: 8,
                        borderTop: '1px solid var(--border)',
                        fontSize: '0.74rem',
                        color: '#065f46',
                        fontWeight: 600,
                      }}
                    >
                      <ShieldCheck size={14} /> 2FA enforced: 6-digit OTP code will be sent to registered email.
                    </div>
                  )}
                </div>

                <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="login-email">
                      Email Address
                    </label>
                    <div className="search-input-wrapper" style={{ position: 'relative' }}>
                      <Mail size={17} style={{ color: 'var(--text-muted)' }} />
                      <input
                        id="login-email"
                        type="email"
                        required
                        className="form-input"
                        placeholder={`${selectedRole}@edumanage.com`}
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        style={{ paddingLeft: '38px' }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="form-label" htmlFor="login-password">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => alert('Password reset request has been logged. Contact your institutional IT administrator.')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="search-input-wrapper" style={{ position: 'relative' }}>
                      <Lock size={17} style={{ color: 'var(--text-muted)' }} />
                      <input
                        id="login-password"
                        type={showLoginPassword ? 'text' : 'password'}
                        required
                        className="form-input"
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        style={{ paddingLeft: '38px', paddingRight: '40px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: 0,
                        }}
                      >
                        {showLoginPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary btn-lg"
                    disabled={loading}
                    style={{ marginTop: 6, height: 46, fontSize: '0.92rem', fontWeight: 600 }}
                  >
                    {loading ? (
                      'Authenticating...'
                    ) : (
                      <>
                        Sign In to {currentRole.shortName} Portal <ArrowRight size={17} />
                      </>
                    )}
                  </button>
                </form>

                <div style={{ marginTop: 22, textAlign: 'center' }}>
                  <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => switchTab('signup')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Create Account
                    </button>
                  </span>
                </div>

                {/* Demo Access Card for Admin Demonstration */}
                <div
                  style={{
                    marginTop: 18,
                    padding: '12px 14px',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#166534', fontWeight: 700, fontSize: '0.82rem' }}>
                      <Sparkles size={14} /> Demo Access (Admin Preview)
                    </div>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', color: '#15803d' }}>
                      Populate dedicated demo admin credentials for testing
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRole('admin');
                      setLoginEmail('demo@edumanage.com');
                      setLoginPassword('Demo@EduManage2026');
                      setError('');
                      setSuccessMessage('Demo admin credentials filled. Click "Sign In".');
                    }}
                    style={{
                      backgroundColor: '#166534',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '7px 12px',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    Load Demo Admin
                  </button>
                </div>

                {/* Institution Management Link (Requirement 10) */}
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  <NavLink
                    to="/institution/manage-accounts"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      color: '#065f46',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--bg-muted)',
                      border: '1px solid var(--border)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Building2 size={13} /> Institution Management · Staff Account Creation →
                  </NavLink>
                </div>
              </motion.div>
            )}

            {/* ─── 2. SIGN UP FORM WITH ROLE PERMISSIONS ───────────────────── */}
            {mode === 'signup' && (
              <motion.div
                key="signup-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                <div style={{ marginBottom: 20 }}>
                  <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
                    Create Account
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', margin: 0 }}>
                    Register for campus portal access.
                  </p>
                </div>

                {/* Account Type Selector */}
                <div style={{ marginBottom: 18 }}>
                  <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>
                    Select Account Role
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setSignupRole('student')}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: signupRole === 'student' ? '2px solid #166534' : '1px solid var(--border)',
                        backgroundColor: signupRole === 'student' ? '#f0fdf4' : 'var(--bg-card)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          padding: 6,
                          borderRadius: 6,
                          backgroundColor: signupRole === 'student' ? '#166534' : 'var(--bg-muted)',
                          color: signupRole === 'student' ? '#ffffff' : 'var(--text-secondary)',
                        }}
                      >
                        <GraduationCap size={16} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>Student</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Self-Enrollment</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSignupRole('parent')}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: signupRole === 'parent' ? '2px solid #166534' : '1px solid var(--border)',
                        backgroundColor: signupRole === 'parent' ? '#f0fdf4' : 'var(--bg-card)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          padding: 6,
                          borderRadius: 6,
                          backgroundColor: signupRole === 'parent' ? '#166534' : 'var(--bg-muted)',
                          color: signupRole === 'parent' ? '#ffffff' : 'var(--text-secondary)',
                        }}
                      >
                        <UserCheck size={16} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>Parent / Guardian</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Family Access</div>
                      </div>
                    </button>
                  </div>

                  {/* Institutional Provisioning Notice for Restricted Roles */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      padding: '10px 12px',
                      backgroundColor: 'var(--bg-muted)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                      marginTop: 10,
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.4,
                    }}
                  >
                    <Info size={15} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 1 }} />
                    <span>
                      <strong>Institutional Notice:</strong> Faculty, Librarian, and Administrator accounts must be created by institution management.
                    </span>
                  </div>
                </div>

                <form onSubmit={handleSignupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="signup-name">
                      Full Name
                    </label>
                    <div className="search-input-wrapper" style={{ position: 'relative' }}>
                      <User size={17} style={{ color: 'var(--text-muted)' }} />
                      <input
                        id="signup-name"
                        type="text"
                        required
                        className="form-input"
                        placeholder="John Doe"
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        style={{ paddingLeft: '38px' }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="signup-email">
                      Email Address
                    </label>
                    <div className="search-input-wrapper" style={{ position: 'relative' }}>
                      <Mail size={17} style={{ color: 'var(--text-muted)' }} />
                      <input
                        id="signup-email"
                        type="email"
                        required
                        className="form-input"
                        placeholder="name@school.edu"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        style={{ paddingLeft: '38px' }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="signup-password">
                      Password (min. 6 characters)
                    </label>
                    <div className="search-input-wrapper" style={{ position: 'relative' }}>
                      <Lock size={17} style={{ color: 'var(--text-muted)' }} />
                      <input
                        id="signup-password"
                        type={showSignupPassword ? 'text' : 'password'}
                        required
                        className="form-input"
                        placeholder="••••••••"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        style={{ paddingLeft: '38px', paddingRight: '40px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignupPassword(!showSignupPassword)}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: 0,
                        }}
                      >
                        {showSignupPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="signup-confirm-password">
                      Confirm Password
                    </label>
                    <div className="search-input-wrapper" style={{ position: 'relative' }}>
                      <Lock size={17} style={{ color: 'var(--text-muted)' }} />
                      <input
                        id="signup-confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        className="form-input"
                        placeholder="••••••••"
                        value={signupConfirmPassword}
                        onChange={(e) => setSignupConfirmPassword(e.target.value)}
                        style={{ paddingLeft: '38px', paddingRight: '40px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: 0,
                        }}
                      >
                        {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary btn-lg"
                    disabled={loading}
                    style={{ marginTop: 6, height: 46, fontSize: '0.92rem', fontWeight: 600 }}
                  >
                    {loading ? (
                      'Creating Account...'
                    ) : (
                      <>
                        Create {signupRole === 'student' ? 'Student' : 'Parent'} Account <ArrowRight size={17} />
                      </>
                    )}
                  </button>
                </form>

                <div style={{ marginTop: 22, textAlign: 'center' }}>
                  <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => switchTab('login')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Sign In
                    </button>
                  </span>
                </div>
              </motion.div>
            )}

            {/* ─── 3. ADMIN OTP VERIFICATION SCREEN ────────────────────────── */}
            {mode === 'admin-otp' && (
              <motion.div
                key="admin-otp-form"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25 }}
              >
                <div style={{ marginBottom: 20 }}>
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                      marginBottom: 16,
                    }}
                  >
                    <ArrowLeft size={16} /> Back to Sign In
                  </button>

                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--primary-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--primary)',
                      marginBottom: 14,
                    }}
                  >
                    <KeyRound size={22} />
                  </div>

                  <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
                    Admin 2FA Verification
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: 4, lineHeight: 1.5 }}>
                    For institutional security, enter the 6-digit verification code sent to{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>{adminMaskedEmail}</strong>.
                  </p>
                </div>

                <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* 6 Digit Inputs */}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => (otpInputRefs.current[idx] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        autoFocus={idx === 0}
                        style={{
                          width: '100%',
                          height: '56px',
                          textAlign: 'center',
                          fontSize: '1.4rem',
                          fontWeight: 700,
                          borderRadius: 'var(--radius-md)',
                          border: digit ? '2px solid var(--primary)' : '1px solid var(--border)',
                          backgroundColor: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          outline: 'none',
                          boxShadow: digit ? '0 0 0 3px var(--primary-ring)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      />
                    ))}
                  </div>

                  {/* Timer & Resend */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.82rem',
                    }}
                  >
                    <span style={{ color: otpCountdown > 0 ? 'var(--text-secondary)' : 'var(--danger)' }}>
                      Code expires in: <strong>{formatTime(otpCountdown)}</strong>
                    </span>

                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={!canResend || loading}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: canResend ? 'var(--primary)' : 'var(--text-muted)',
                        fontWeight: 600,
                        cursor: canResend ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: 0,
                      }}
                    >
                      <RotateCw size={14} className={loading ? 'animate-spin' : ''} /> Resend Code
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary btn-lg"
                    disabled={loading || otpDigits.join('').length !== 6}
                    style={{ height: 46, fontSize: '0.92rem', fontWeight: 600 }}
                  >
                    {loading ? 'Verifying...' : 'Verify & Continue'}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
