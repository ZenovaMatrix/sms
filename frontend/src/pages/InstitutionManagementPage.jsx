import { useState, useEffect, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Building2,
  Users,
  GraduationCap,
  BookOpen,
  UserCheck,
  UserPlus,
  Mail,
  Lock,
  Phone,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  LogOut,
  Edit2,
  Send,
  Power,
  ChevronLeft,
  KeyRound,
  ShieldAlert,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/api';

const STAFF_ROLES = [
  {
    id: 'admin',
    label: 'Administrator',
    description: 'System-wide control, security policies, audit logs & institutional settings.',
    badge: 'Dual-Factor 2FA',
    color: '#065f46',
    bgLight: '#dcfce7',
    icon: ShieldCheck,
  },
  {
    id: 'teacher',
    label: 'Faculty / Teacher',
    description: 'Assigned classes, student attendance records, exams and academic gradebooks.',
    badge: 'Academics',
    color: '#1e40af',
    bgLight: '#dbeafe',
    icon: Users,
  },
  {
    id: 'librarian',
    label: 'Institutional Librarian',
    description: 'Curriculum subject catalogs, textbook inventories and circulation management.',
    badge: 'Library & Catalog',
    color: '#7c3aed',
    bgLight: '#ede9fe',
    icon: BookOpen,
  },
];

export default function InstitutionManagementPage() {
  const { user, isAuthenticated, role, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // Access control check: Only Institution Management / Super Admin (admin role)
  const isAuthorized = isAuthenticated && role === 'admin';

  // Staff list state
  const [staffUsers, setStaffUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Account creation form state
  const [createRole, setCreateRole] = useState('teacher');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [sendActivationEmail, setSendActivationEmail] = useState(true);
  const [creating, setCreating] = useState(false);

  // Edit user modal state
  const [editingUser, setEditingUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [savingEdit, setSavingEdit] = useState(false);

  // Action busy indicators (user id -> action)
  const [actionBusyId, setActionBusyId] = useState(null);

  // Fetch all institutional staff
  const loadStaffUsers = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/users?limit=100');
      if (data.success && data.data?.users) {
        // Filter to staff roles: admin, teacher, librarian
        const staff = data.data.users.filter((u) =>
          ['admin', 'teacher', 'librarian'].includes(u.role)
        );
        setStaffUsers(staff);
      }
    } catch (err) {
      console.error('Failed to load staff list:', err);
      toast.error('Failed to load staff records from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      loadStaffUsers();
    }
  }, [isAuthorized]);

  // Generate a random secure temporary password
  const generateSecurePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let res = '';
    for (let i = 0; i < 12; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(res);
    toast.info('Secure temporary password generated.');
  };

  // Handle staff account creation
  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password) {
      toast.error('Full Name, Email, and Password are required.');
      return;
    }

    setCreating(true);
    try {
      const payload = {
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role: createRole,
        phone: phone.trim() || null,
        status: 'active',
      };

      const { data } = await api.post('/users', payload);
      if (data.success) {
        toast.success(
          `Staff account created for ${data.data.name} (${createRole.toUpperCase()}). Activation email dispatched.`
        );
        // Reset form
        setFullName('');
        setEmail('');
        setPhone('');
        setPassword('');
        loadStaffUsers();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create staff account.';
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  // Handle Resend Invitation / Activation Email
  const handleResendInvitation = async (staffId, staffEmail) => {
    setActionBusyId(staffId);
    try {
      const { data } = await api.post(`/users/${staffId}/resend-invite`);
      if (data.success) {
        toast.success(data.message || `Activation email resent to ${staffEmail}.`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend activation email.');
    } finally {
      setActionBusyId(null);
    }
  };

  // Handle Toggle Account Status (Active <-> Inactive)
  const handleToggleStatus = async (staffId, currentStatus, staffName) => {
    const targetStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const confirmMsg =
      targetStatus === 'inactive'
        ? `Are you sure you want to deactivate ${staffName}'s account? They will not be able to log in.`
        : `Reactivate ${staffName}'s account?`;

    if (!window.confirm(confirmMsg)) return;

    setActionBusyId(staffId);
    try {
      const { data } = await api.patch(`/users/${staffId}/status`);
      if (data.success) {
        toast.success(`${staffName}'s account is now ${data.data.status}.`);
        loadStaffUsers();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update account status.');
    } finally {
      setActionBusyId(null);
    }
  };

  // Open Edit Modal
  const openEditModal = (u) => {
    setEditingUser(u);
    setEditName(u.name || '');
    setEditPhone(u.phone || '');
    setEditStatus(u.status || 'active');
  };

  // Save Edit Changes
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    setSavingEdit(true);
    try {
      const payload = {
        name: editName.trim(),
        phone: editPhone.trim() || null,
        status: editStatus,
      };

      const { data } = await api.patch(`/users/${editingUser.id}`, payload);
      if (data.success) {
        toast.success(`Account details updated for ${data.data.name}.`);
        setEditingUser(null);
        loadStaffUsers();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update account details.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Computed Staff Statistics
  const stats = useMemo(() => {
    const total = staffUsers.length;
    const admins = staffUsers.filter((u) => u.role === 'admin').length;
    const teachers = staffUsers.filter((u) => u.role === 'teacher').length;
    const librarians = staffUsers.filter((u) => u.role === 'librarian').length;
    const active = staffUsers.filter((u) => u.status === 'active').length;
    return { total, admins, teachers, librarians, active };
  }, [staffUsers]);

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffUsers.filter((u) => {
      // Role filter
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      // Status filter
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = u.name?.toLowerCase().includes(q);
        const matchesEmail = u.email?.toLowerCase().includes(q);
        const matchesPhone = u.phone?.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesPhone) return false;
      }
      return true;
    });
  }, [staffUsers, roleFilter, statusFilter, searchQuery]);

  // ─── GATE: UNAUTHORIZED USER VIEW ──────────────────────────────────────────
  if (!isAuthorized) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          padding: '24px',
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            maxWidth: 520,
            width: '100%',
            backgroundColor: '#1e293b',
            borderRadius: 16,
            padding: '40px',
            border: '1px solid #334155',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            <ShieldAlert size={32} />
          </div>

          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 8, color: '#ffffff' }}>
            Institution Management Restricted
          </h2>

          <p style={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: 24 }}>
            Access to this provisioning interface is strictly restricted to authorized Institution
            Administrators and Super Admins. Faculty, student, and parent accounts cannot manage
            staff credentials.
          </p>

          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 8,
              fontSize: '0.82rem',
              color: '#cbd5e1',
              marginBottom: 28,
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            {isAuthenticated ? (
              <span>
                Currently authenticated as <strong>{user?.name || user?.email}</strong> (Role:{' '}
                <span style={{ color: '#f87171', fontWeight: 700 }}>{role}</span>).
              </span>
            ) : (
              <span>You are currently not signed in. Please authenticate with Administrator credentials.</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <NavLink
              to="/login"
              style={{
                backgroundColor: '#166534',
                color: '#ffffff',
                padding: '12px 24px',
                borderRadius: 8,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.9rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              Sign In as Administrator <ArrowRight size={16} />
            </NavLink>
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => navigate('/')}
                style={{
                  backgroundColor: 'transparent',
                  color: '#94a3b8',
                  border: '1px solid #475569',
                  padding: '12px 20px',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                Back to Dashboard
              </button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── AUTHORIZED INSTITUTION MANAGEMENT DASHBOARD ───────────────────────────
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', color: '#0f172a' }}>
      {/* Top Enterprise Management Bar */}
      <header
        style={{
          background: 'linear-gradient(90deg, #064e3b 0%, #166534 60%, #14532d 100%)',
          color: '#ffffff',
          padding: '16px 32px',
          boxShadow: '0 4px 20px rgba(6, 78, 59, 0.15)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div
          style={{
            maxWidth: 1300,
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                backdropFilter: 'blur(8px)',
              }}
            >
              <Building2 size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: '#ffffff' }}>
                  EduManage Institution Management
                </h1>
                <span
                  style={{
                    fontSize: '0.68rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    backgroundColor: '#86efac',
                    color: '#064e3b',
                    padding: '2px 8px',
                    borderRadius: 999,
                    fontWeight: 700,
                  }}
                >
                  Super Admin
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#dcfce7', opacity: 0.9 }}>
                Staff Account Provisioning, Role Permissions & Credential Governance
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <NavLink
              to="/"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                padding: '8px 16px',
                borderRadius: 8,
                textDecoration: 'none',
                fontSize: '0.82rem',
                fontWeight: 600,
                transition: 'all 0.15s ease',
              }}
            >
              <ChevronLeft size={16} /> Admin Portal
            </NavLink>

            <button
              type="button"
              onClick={logout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                color: '#fecaca',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '8px 14px',
                borderRadius: 8,
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <LogOut size={15} /> Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: 1300, margin: '32px auto', padding: '0 24px' }}>
        {/* KPI Summary Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 12,
              padding: '20px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Total Institutional Staff</span>
              <div style={{ padding: 8, borderRadius: 8, backgroundColor: '#f1f5f9', color: '#475569' }}>
                <Users size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', marginTop: 8 }}>{stats.total}</div>
            <span style={{ fontSize: '0.74rem', color: '#16a34a', fontWeight: 600 }}>{stats.active} Active accounts</span>
          </div>

          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 12,
              padding: '20px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Administrators (2FA)</span>
              <div style={{ padding: 8, borderRadius: 8, backgroundColor: '#dcfce7', color: '#166534' }}>
                <ShieldCheck size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#166534', marginTop: 8 }}>{stats.admins}</div>
            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Governance & Security</span>
          </div>

          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 12,
              padding: '20px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Faculty / Teachers</span>
              <div style={{ padding: 8, borderRadius: 8, backgroundColor: '#dbeafe', color: '#1e40af' }}>
                <Users size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e40af', marginTop: 8 }}>{stats.teachers}</div>
            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Classes & Gradebooks</span>
          </div>

          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 12,
              padding: '20px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Librarians</span>
              <div style={{ padding: 8, borderRadius: 8, backgroundColor: '#ede9fe', color: '#7c3aed' }}>
                <BookOpen size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#7c3aed', marginTop: 8 }}>{stats.librarians}</div>
            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Curriculum & Textbooks</span>
          </div>
        </div>

        {/* Two-Column Grid: Form on Left, Directory on Right */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: 24, alignItems: 'start' }}>
          {/* ─── COLUMN 1: ACCOUNT CREATION FORM ──────────────────────────────── */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 14,
              padding: '28px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  backgroundColor: '#166534',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <UserPlus size={18} />
              </div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Provision Staff Account
              </h2>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: 20, lineHeight: 1.45 }}>
              Authorize institutional staff with custom roles. An official activation email will be dispatched.
            </p>

            {/* Role Selector Tabs */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', display: 'block', marginBottom: 8 }}>
                Select Role to Authorize
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {STAFF_ROLES.map((r) => {
                  const IconC = r.icon;
                  const isSel = createRole === r.id;
                  return (
                    <div
                      key={r.id}
                      onClick={() => setCreateRole(r.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 14px',
                        borderRadius: 8,
                        border: isSel ? `2px solid ${r.color}` : '1px solid #e2e8f0',
                        backgroundColor: isSel ? r.bgLight : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 6,
                          backgroundColor: isSel ? r.color : '#f1f5f9',
                          color: isSel ? '#ffffff' : '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <IconC size={16} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.86rem', fontWeight: 700, color: isSel ? r.color : '#0f172a' }}>
                            {r.label}
                          </span>
                          <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '1px 6px', borderRadius: 4, backgroundColor: isSel ? '#ffffff' : '#f1f5f9', color: isSel ? r.color : '#64748b' }}>
                            {r.badge}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>
                          {r.description}
                        </span>
                      </div>
                      {isSel && <Check size={16} style={{ color: r.color }} />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Creation Form */}
            <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
                  Full Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Rajesh Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
                  Official Email Address <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. r.sharma@edumanage.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
                  Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>
                    Initial Password <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={generateSecurePassword}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#166534',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Sparkles size={12} /> Auto-Generate
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 38px 9px 12px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      fontSize: '0.88rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontFamily: showPassword ? 'monospace' : 'inherit',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <input
                  type="checkbox"
                  id="sendActivation"
                  checked={sendActivationEmail}
                  onChange={(e) => setSendActivationEmail(e.target.checked)}
                  style={{ accentColor: '#166534' }}
                />
                <label htmlFor="sendActivation" style={{ fontSize: '0.8rem', color: '#475569', cursor: 'pointer' }}>
                  Dispatch activation email with portal sign-in instructions
                </label>
              </div>

              <button
                type="submit"
                disabled={creating}
                style={{
                  backgroundColor: '#166534',
                  color: '#ffffff',
                  padding: '12px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  cursor: creating ? 'not-allowed' : 'pointer',
                  marginTop: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 12px rgba(22, 101, 52, 0.25)',
                }}
              >
                {creating ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Provisioning...
                  </>
                ) : (
                  <>
                    <UserPlus size={16} /> Authorize & Create Account
                  </>
                )}
              </button>
            </form>
          </div>

          {/* ─── COLUMN 2: EXISTING STAFF DIRECTORY ───────────────────────────── */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 14,
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden',
            }}
          >
            {/* Header & Controls */}
            <div style={{ padding: '24px 28px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px 0', color: '#0f172a' }}>
                    Institutional Staff Directory
                  </h2>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                    Active and provisioned personnel authorized across institutional roles
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadStaffUsers}
                  disabled={loading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: '#334155',
                    cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Roster
                </button>
              </div>

              {/* Filters bar */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Search */}
                <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="Search by name, email, or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 36px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      fontSize: '0.84rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Role Filter */}
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                    color: '#334155',
                    outline: 'none',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Administrators</option>
                  <option value="teacher">Faculty / Teachers</option>
                  <option value="librarian">Librarians</option>
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                    color: '#334155',
                    outline: 'none',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                    <th style={{ padding: '12px 20px', fontWeight: 600 }}>Staff Member</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Assigned Role</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Phone</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '12px 20px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                        <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                        <p style={{ margin: 0 }}>Querying TiDB Cloud records...</p>
                      </td>
                    </tr>
                  ) : filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                        <Users size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                        <p style={{ margin: 0, fontWeight: 600 }}>No matching staff members found.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredStaff.map((u) => {
                      const isBusy = actionBusyId === u.id;
                      const roleConfig = STAFF_ROLES.find((r) => r.id === u.role) || {
                        label: u.role,
                        color: '#64748b',
                        bgLight: '#f1f5f9',
                      };

                      return (
                        <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          {/* Name & Email */}
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div
                                style={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: '50%',
                                  backgroundColor: roleConfig.bgLight,
                                  color: roleConfig.color,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  fontSize: '0.9rem',
                                  flexShrink: 0,
                                }}
                              >
                                {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: '#0f172a' }}>{u.name}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{u.email}</div>
                              </div>
                            </div>
                          </td>

                          {/* Role */}
                          <td style={{ padding: '14px 16px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '3px 10px',
                                borderRadius: 999,
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                backgroundColor: roleConfig.bgLight,
                                color: roleConfig.color,
                              }}
                            >
                              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: roleConfig.color }} />
                              {roleConfig.label}
                            </span>
                          </td>

                          {/* Phone */}
                          <td style={{ padding: '14px 16px', color: u.phone ? '#334155' : '#94a3b8' }}>
                            {u.phone || '—'}
                          </td>

                          {/* Status */}
                          <td style={{ padding: '14px 16px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '2px 8px',
                                borderRadius: 999,
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                backgroundColor:
                                  u.status === 'active'
                                    ? '#dcfce7'
                                    : u.status === 'suspended'
                                    ? '#fee2e2'
                                    : '#f1f5f9',
                                color:
                                  u.status === 'active'
                                    ? '#166534'
                                    : u.status === 'suspended'
                                    ? '#991b1b'
                                    : '#475569',
                              }}
                            >
                              {u.status === 'active' && <CheckCircle2 size={12} />}
                              {u.status === 'inactive' && <Power size={12} />}
                              {u.status === 'suspended' && <AlertCircle size={12} />}
                              {u.status ? u.status.charAt(0).toUpperCase() + u.status.slice(1) : 'Active'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                              {/* Edit Button */}
                              <button
                                type="button"
                                title="Edit Staff Details"
                                onClick={() => openEditModal(u)}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: 6,
                                  border: '1px solid #cbd5e1',
                                  backgroundColor: '#ffffff',
                                  color: '#334155',
                                  fontSize: '0.76rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <Edit2 size={13} /> Edit
                              </button>

                              {/* Resend Activation */}
                              <button
                                type="button"
                                title="Resend Activation Email"
                                disabled={isBusy}
                                onClick={() => handleResendInvitation(u.id, u.email)}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: 6,
                                  border: '1px solid #cbd5e1',
                                  backgroundColor: '#ffffff',
                                  color: '#166534',
                                  fontSize: '0.76rem',
                                  fontWeight: 600,
                                  cursor: isBusy ? 'not-allowed' : 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <Send size={13} /> Resend Invite
                              </button>

                              {/* Toggle Status */}
                              <button
                                type="button"
                                title={u.status === 'active' ? 'Deactivate Account' : 'Reactivate Account'}
                                disabled={isBusy}
                                onClick={() => handleToggleStatus(u.id, u.status, u.name)}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: 6,
                                  border: u.status === 'active' ? '1px solid #fecaca' : '1px solid #bbf7d0',
                                  backgroundColor: u.status === 'active' ? '#fff5f5' : '#f0fdf4',
                                  color: u.status === 'active' ? '#dc2626' : '#166534',
                                  fontSize: '0.76rem',
                                  fontWeight: 600,
                                  cursor: isBusy ? 'not-allowed' : 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <Power size={13} />
                                {u.status === 'active' ? 'Deactivate' : 'Activate'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* ─── EDIT STAFF DETAILS MODAL ────────────────────────────────────────── */}
      <AnimatePresence>
        {editingUser && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 50,
              padding: 20,
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 14,
                padding: '28px',
                maxWidth: 460,
                width: '100%',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  Edit Staff Account
                </h3>
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: 4,
                    backgroundColor: '#e2e8f0',
                    color: '#334155',
                  }}
                >
                  {editingUser.role}
                </span>
              </div>

              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 20px 0' }}>
                Account Email: <strong>{editingUser.email}</strong>
              </p>

              <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      fontSize: '0.88rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      fontSize: '0.88rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
                    Account Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      fontSize: '0.88rem',
                      color: '#334155',
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="active">Active (Full Portal Access)</option>
                    <option value="inactive">Inactive (Access Suspended)</option>
                    <option value="suspended">Suspended (Security Review)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    style={{
                      padding: '9px 16px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      color: '#64748b',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    style={{
                      padding: '9px 20px',
                      borderRadius: 8,
                      border: 'none',
                      backgroundColor: '#166534',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      color: '#ffffff',
                      cursor: savingEdit ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {savingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
