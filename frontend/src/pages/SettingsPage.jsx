import { useState, useEffect, useCallback } from 'react';
import {
  Settings, Building, Shield, Palette, Save, CheckCircle,
  Users, PlusCircle, X, AlertTriangle, Eye, EyeOff, RefreshCcw,
  KeyRound, User, Mail, Lock,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/api';
import { TableSkeleton } from '../components/LoadingSkeleton';

// ─── Create User Modal ─────────────────────────────────────────────────────
function CreateUserModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'teacher' });
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const { success, error: toastError } = useToast();

  useEffect(() => {
    if (open) { setForm({ name: '', email: '', password: '', role: 'teacher' }); setErr(''); }
  }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setErr('Full name is required.'); return; }
    if (!form.email.trim()) { setErr('Email is required.'); return; }
    if (!form.password || form.password.length < 8) { setErr('Password must be at least 8 characters.'); return; }
    setSaving(true);
    try {
      const { data } = await api.post('/users', { name: form.name.trim(), email: form.email.trim().toLowerCase(), password: form.password, role: form.role });
      if (data.success) {
        success(`User ${form.name} created successfully!`);
        onSaved?.();
        onClose();
      }
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to create user.';
      setErr(msg);
      toastError(msg);
    } finally { setSaving(false); }
  }

  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Create New User</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 24px 24px' }}>
          {err && (
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={14} /> {err}
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <div className="search-input-wrapper">
              <User size={15} />
              <input className="form-input" placeholder="e.g. Dr. Anita Sharma" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email Address *</label>
            <div className="search-input-wrapper">
              <Mail size={15} />
              <input type="email" className="form-input" placeholder="user@school.edu" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Password *</label>
            <div className="search-input-wrapper">
              <Lock size={15} />
              <input
                type={showPwd ? 'text' : 'password'}
                className="form-input"
                placeholder="Minimum 8 characters"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                style={{ paddingRight: 40 }}
              />
              <button type="button" style={{ position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setShowPwd(v => !v)}>
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {form.password && (
              <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                {[...Array(5)].map((_, i) => (
                  <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: form.password.length >= (i + 1) * 2 ? (form.password.length >= 8 ? 'var(--success)' : 'var(--warning)') : 'var(--border)' }} />
                ))}
                <span style={{ fontSize: '0.7rem', color: form.password.length >= 8 ? 'var(--success)' : 'var(--warning)', fontWeight: 600, marginLeft: 6 }}>
                  {form.password.length >= 12 ? 'Strong' : form.password.length >= 8 ? 'Good' : 'Weak'}
                </span>
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Role *</label>
            <select className="form-input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="admin">Admin</option>
              <option value="teacher">Teacher</option>
              <option value="student">Student</option>
              <option value="parent">Parent</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              <Save size={14} /> {saving ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Change Password Modal ───────────────────────────────────────────────────
function ChangePasswordModal({ open, onClose }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ current: '', newPwd: '', confirm: '' });
  const [showPwds, setShowPwds] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const { success, error: toastError } = useToast();

  useEffect(() => { if (open) { setForm({ current: '', newPwd: '', confirm: '' }); setErr(''); } }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.current) { setErr('Current password is required.'); return; }
    if (form.newPwd.length < 8) { setErr('New password must be at least 8 characters.'); return; }
    if (form.newPwd !== form.confirm) { setErr('Passwords do not match.'); return; }
    setSaving(true);
    try {
      await api.patch(`/users/${user.id}`, { current_password: form.current, password: form.newPwd });
      success('Password changed successfully!');
      onClose();
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to change password.';
      setErr(msg); toastError(msg);
    } finally { setSaving(false); }
  }

  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Change Password</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 24px 24px' }}>
          {err && <div style={{ padding: '10px 14px', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={14} /> {err}</div>}
          {[
            { label: 'Current Password *', key: 'current' },
            { label: 'New Password *', key: 'newPwd' },
            { label: 'Confirm New Password *', key: 'confirm' },
          ].map(f => (
            <div key={f.key} className="form-group">
              <label className="form-label">{f.label}</label>
              <input type={showPwds ? 'text' : 'password'} className="form-input" value={form[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} />
            </div>
          ))}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={showPwds} onChange={e => setShowPwds(e.target.checked)} />
            Show passwords
          </label>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}><KeyRound size={14} /> {saving ? 'Updating…' : 'Update Password'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Users Table (Admin Only) ─────────────────────────────────────────────────
function UsersManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users?limit=30');
      if (data.success) setUsers(data.data.users || data.data.items || data.data || []);
    } catch { setUsers([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const ROLE_COLORS = { admin: 'badge-violet', teacher: 'badge-sky', student: 'badge-emerald', parent: 'badge-amber' };

  function formatDate(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return d; }
  }

  return (
    <>
      {showCreate && <CreateUserModal open={showCreate} onClose={() => setShowCreate(false)} onSaved={fetchUsers} />}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card-header" style={{ marginBottom: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={18} color="var(--primary)" />
            <h3 className="card-title">User Management</h3>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={fetchUsers}><RefreshCcw size={14} /></button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
              <PlusCircle size={14} /> Create User
            </button>
          </div>
        </div>
        <div style={{ margin: '0 -24px', overflow: 'hidden', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
          {loading ? (
            <TableSkeleton rows={5} cols={4} />
          ) : users.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No users found.</div>
          ) : (
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                            {(u.name || 'U')[0].toUpperCase()}
                          </div>
                          <span className="td-main">{u.name || '—'}</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{u.email || '—'}</td>
                      <td><span className={`badge ${ROLE_COLORS[u.role] || 'badge-slate'}`}>{u.role || '—'}</span></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{formatDate(u.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Total {users.length} users · Admin-only section
        </p>
      </div>
    </>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────
export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { success } = useToast();
  const isAdmin = (user?.role || '').toLowerCase() === 'admin';

  const [saved, setSaved] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);

  const [TABS] = useState(['School Settings', 'User Management', 'Account']);
  const [activeTab, setActiveTab] = useState('School Settings');

  function handleSave(e) {
    e.preventDefault();
    setSaved(true);
    success('Configuration saved!');
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 960 }}>
      {showChangePwd && <ChangePasswordModal open={showChangePwd} onClose={() => setShowChangePwd(false)} />}

      {/* Tab Bar */}
      <div className="card" style={{ padding: '8px 20px', display: 'flex', gap: 4 }}>
        {TABS.filter(t => t !== 'User Management' || isAdmin).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
              backgroundColor: activeTab === tab ? 'var(--primary-light)' : 'transparent',
              color: activeTab === tab ? 'var(--primary)' : 'var(--text-secondary)',
              transition: 'all var(--transition-fast)',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* School Settings Tab */}
      {activeTab === 'School Settings' && (
        <>
          <form onSubmit={handleSave} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card-header" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Building size={18} color="var(--primary)" />
                <h3 className="card-title">School &amp; Institution Details</h3>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">School Name</label>
                <input className="form-input" defaultValue="EduManage International Academy" />
              </div>
              <div className="form-group">
                <label className="form-label">Affiliation / Board Code</label>
                <input className="form-input" defaultValue="CBSE / INT-9842" />
              </div>
              <div className="form-group">
                <label className="form-label">Official Contact Email</label>
                <input type="email" className="form-input" defaultValue="administration@edumanage.com" />
              </div>
              <div className="form-group">
                <label className="form-label">School Phone Number</label>
                <input type="tel" className="form-input" defaultValue="+1 (555) 019-2834" />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Campus Address</label>
                <input className="form-input" defaultValue="100 Academic Boulevard, Suite 400, Education City" />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
              <button type="submit" className="btn btn-primary btn-sm">
                <Save size={15} /> Save Changes
              </button>
            </div>
          </form>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card-header" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Palette size={18} color="var(--primary)" />
                <h3 className="card-title">Theme &amp; Interface Preferences</h3>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
              <div>
                <h5 style={{ fontSize: '0.88rem', fontWeight: 600 }}>Dark Theme Mode</h5>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Toggle between warm light and dark slate aesthetic</p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={toggleTheme} style={{ minWidth: 130 }}>
                {theme === 'dark' ? '☀️ Switch to Light' : '🌙 Switch to Dark'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* User Management Tab (Admin Only) */}
      {activeTab === 'User Management' && isAdmin && <UsersManagement />}

      {/* Account Tab */}
      {activeTab === 'Account' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card-header" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <User size={18} color="var(--primary)" />
              <h3 className="card-title">My Account</h3>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.4rem' }}>
              {(user?.name || 'U')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{user?.name || '—'}</div>
              <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>{user?.email}</div>
              <span className={`badge ${user?.role === 'admin' ? 'badge-violet' : 'badge-sky'}`} style={{ marginTop: 4, display: 'inline-block' }}>{user?.role}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowChangePwd(true)}>
              <KeyRound size={14} /> Change Password
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
