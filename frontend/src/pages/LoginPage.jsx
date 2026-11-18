import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';

export default function LoginPage() {
  // Navigation mode: 'login' | 'signup' | 'admin-otp'
  const [mode, setMode] = useState('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Sign Up form state
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
          // Standard login for students, teachers, parents, librarians
          const { token, user } = data.data;
          login(user, token);
          navigate('/', { replace: true });
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password. Please verify your credentials.');
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
    // Handle paste of 6 digits
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
        gridTemplateColumns: '1.1fr 0.9fr',
        backgroundColor: 'var(--bg-app)',
      }}
    >
      {/* Left Brand Panel */}
      <div
        style={{
          background: 'linear-gradient(145deg, #14532d 0%, #166534 50%, #064e3b 100%)',
          color: '#ffffff',
          padding: '60px 80px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
        }}
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
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
              EduManage
            </h3>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#86efac', fontWeight: 600 }}>
              Institutional SaaS Platform
            </span>
          </div>
        </div>

        {/* Brand Value Proposition */}
        <div style={{ margin: '40px 0', maxWidth: 520 }}>
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
              marginBottom: 20,
            }}
          >
            <Sparkles size={14} /> Multi-Role Campus Architecture
          </div>

          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1.2, color: '#ffffff', marginBottom: 18 }}>
            Enterprise security for modern educational institutions.
          </h1>

          <p style={{ color: '#dcfce7', fontSize: '0.98rem', lineHeight: 1.6, opacity: 0.9 }}>
            Connecting administrators, educators, students, and parents with dual-factor authentication, verified gradebooks, and instant campus communications.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 36 }}>
            {[
              'Hardware-grade Admin 2FA One-Time Passcode (OTP)',
              'Granular Role Enforcement (Admin, Faculty, Student, Parent)',
              'Live Biometric & Class Attendance Records',
              'Automated Ledger Invoicing with Real-Time Receipts',
            ].map((feat, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.88rem', color: '#f0fdf4' }}>
                <CheckCircle size={18} color="#4ade80" />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ fontSize: '0.76rem', color: '#86efac', opacity: 0.85 }}>
          © 2026 EduManage Technologies Inc. Strict TLS 1.3 & 2FA Enforced.
        </div>
      </div>

      {/* Right Authentication Panel */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          backgroundColor: 'var(--bg-surface)',
          overflowY: 'auto',
        }}
      >
        <div style={{ width: '100%', maxWidth: 440 }}>
          {/* Navigation Tabs (Only in Login or Sign Up mode) */}
          {mode !== 'admin-otp' && (
            <div
              style={{
                display: 'flex',
                background: 'var(--bg-muted)',
                padding: 4,
                borderRadius: 'var(--radius-lg)',
                marginBottom: 28,
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
            <div
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
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div
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
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* ─── 1. LOGIN FORM ─────────────────────────────────────────── */}
            {mode === 'login' && (
              <motion.div
                key="login-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                <div style={{ marginBottom: 24 }}>
                  <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Welcome back
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: 4 }}>
                    Enter your email and password to access your portal.
                  </p>
                </div>

                <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
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
                        placeholder="name@school.edu"
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
                        onClick={() => alert('Password reset link has been dispatched to your administrator.')}
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
                    style={{ marginTop: 8, height: 46, fontSize: '0.92rem', fontWeight: 600 }}
                  >
                    {loading ? (
                      'Authenticating...'
                    ) : (
                      <>
                        Sign In <ArrowRight size={17} />
                      </>
                    )}
                  </button>
                </form>

                <div style={{ marginTop: 24, textAlign: 'center' }}>
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
                      Sign Up
                    </button>
                  </span>
                </div>
              </motion.div>
            )}

            {/* ─── 2. SIGN UP FORM ─────────────────────────────────────────── */}
            {mode === 'signup' && (
              <motion.div
                key="signup-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                <div style={{ marginBottom: 24 }}>
                  <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Create an account
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: 4 }}>
                    Sign up to join your campus learning network.
                  </p>
                </div>

                <form onSubmit={handleSignupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                        placeholder="john.doe@school.edu"
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
                    style={{ marginTop: 8, height: 46, fontSize: '0.92rem', fontWeight: 600 }}
                  >
                    {loading ? (
                      'Creating Account...'
                    ) : (
                      <>
                        Create Account <ArrowRight size={17} />
                      </>
                    )}
                  </button>
                </form>

                <div style={{ marginTop: 24, textAlign: 'center' }}>
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

                  <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)' }}>
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
