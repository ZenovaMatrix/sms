import { useState, useEffect, useCallback } from 'react';
import {
  Calendar, CheckCircle, PlusCircle, X, Save, AlertTriangle,
  Edit2, Trash2, ChevronLeft, ChevronRight, Clock, Award,
} from 'lucide-react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import EmptyState from '../components/EmptyState';
import { TableSkeleton } from '../components/LoadingSkeleton';

function uid() { return 'ay-' + Math.random().toString(36).slice(2, 10); }

// ─── Form Modal ──────────────────────────────────────────────────────────────
function AcademicYearFormModal({ open, onClose, onSaved, editData }) {
  const [form, setForm] = useState({ year_name: '', year_code: '', start_date: '', end_date: '', is_current: false });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const { success, error: toastError } = useToast();

  useEffect(() => {
    if (open) {
      setForm(editData
        ? { year_name: editData.year_name || '', year_code: editData.year_code || editData.code || '', start_date: (editData.start_date || '').split('T')[0], end_date: (editData.end_date || '').split('T')[0], is_current: !!editData.is_current }
        : { year_name: '', year_code: '', start_date: '', end_date: '', is_current: false }
      );
      setErr('');
    }
  }, [open, editData]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.year_name.trim()) { setErr('Year name is required.'); return; }
    if (!form.start_date) { setErr('Start date is required.'); return; }
    if (!form.end_date) { setErr('End date is required.'); return; }
    setSaving(true);
    try {
      const payload = { year_name: form.year_name.trim(), year_code: form.year_code.trim() || undefined, start_date: form.start_date, end_date: form.end_date, is_current: form.is_current };
      if (editData) {
        const { data } = await api.patch(`/academic-years/${editData.id}`, payload);
        if (data.success) { success('Academic year updated!'); onSaved(); onClose(); }
      } else {
        const { data } = await api.post('/academic-years', { id: uid(), ...payload });
        if (data.success) { success('Academic year created!'); onSaved(); onClose(); }
      }
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to save academic year.';
      setErr(msg); toastError(msg);
    } finally { setSaving(false); }
  }

  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{editData ? 'Edit Academic Year' : 'Add Academic Year'}</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 24px 24px' }}>
          {err && (
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={14} /> {err}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Year Name *</label>
              <input className="form-input" placeholder="e.g. 2026–2027 Academic Year" value={form.year_name} onChange={e => setForm(f => ({ ...f, year_name: e.target.value }))} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Year Code</label>
              <input className="form-input" placeholder="e.g. AY-2026-27" value={form.year_code} onChange={e => setForm(f => ({ ...f, year_code: e.target.value }))} />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 24 }}>
              <input type="checkbox" id="is-current" style={{ width: 16, height: 16, cursor: 'pointer' }} checked={form.is_current} onChange={e => setForm(f => ({ ...f, is_current: e.target.checked }))} />
              <label htmlFor="is-current" style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Set as Current Year</label>
            </div>
            <div className="form-group">
              <label className="form-label">Start Date *</label>
              <input type="date" className="form-input" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">End Date *</label>
              <input type="date" className="form-input" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              <Save size={14} /> {saving ? 'Saving…' : (editData ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm ──────────────────────────────────────────────────────────
function DeleteAYModal({ item, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false);
  const { success, error: toastError } = useToast();

  async function handleDelete() {
    setLoading(true);
    try {
      const { data } = await api.delete(`/academic-years/${item.id}`);
      if (data.success) { success('Academic year deleted.'); onDeleted(); onClose(); }
    } catch (e) { toastError(e.response?.data?.message || 'Cannot delete: year has dependencies.'); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Delete Academic Year</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14, backgroundColor: 'var(--danger-light)', borderRadius: 'var(--radius-sm)' }}>
            <AlertTriangle size={20} style={{ color: 'var(--danger)', flexShrink: 0 }} />
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Delete <strong>{item.year_name}</strong>? This may fail if the year has enrollments or exam records.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-sm" style={{ backgroundColor: 'var(--danger)', color: '#fff', border: 'none' }} onClick={handleDelete} disabled={loading}>{loading ? 'Deleting…' : 'Delete'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function AcademicYearsPage() {
  const { user } = useAuth();
  const isAdmin = (user?.role || '').toLowerCase() === 'admin';

  const [academicYears, setAcademicYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchYears = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/academic-years?limit=20');
      if (data.success) {
        setAcademicYears(data.data.academicYears || data.data.items || data.data || []);
      }
    } catch (err) {
      console.error('Failed to load academic years:', err);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchYears(); }, [fetchYears]);

  function formatDate(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return d; }
  }

  function getStatus(ay) {
    const now = new Date();
    const start = new Date(ay.start_date);
    const end = new Date(ay.end_date);
    if (ay.is_current) return { label: 'Current Active', cls: 'badge-emerald' };
    if (now < start) return { label: 'Upcoming', cls: 'badge-sky' };
    if (now > end) return { label: 'Completed', cls: 'badge-slate' };
    return { label: 'Active', cls: 'badge-emerald' };
  }

  const activeYear = academicYears.find(a => a.is_current);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Modals */}
      <AcademicYearFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditTarget(null); }}
        onSaved={fetchYears}
        editData={editTarget}
      />
      {deleteTarget && <DeleteAYModal item={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={fetchYears} />}

      {/* Stat / Info Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
        {[
          { label: 'Total Sessions', value: academicYears.length, icon: <Calendar size={22} />, bg: 'var(--primary-light)', fg: 'var(--primary)' },
          { label: 'Current Year', value: activeYear?.year_name?.split(' ').slice(0, 2).join(' ') || '—', icon: <Award size={22} />, bg: 'var(--success-light)', fg: 'var(--success)', small: true },
          { label: 'Upcoming Sessions', value: academicYears.filter(a => new Date(a.start_date) > new Date()).length, icon: <Clock size={22} />, bg: 'var(--secondary-light)', fg: 'var(--secondary)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', backgroundColor: s.bg, color: s.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</span>
              <div style={{ fontSize: s.small ? '1rem' : '1.4rem', fontWeight: 800, color: s.fg }}>{loading ? '—' : s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="card" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Academic Sessions</h3>
        {isAdmin && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { setEditTarget(null); setShowForm(true); }}>
            <PlusCircle size={15} /> Add Academic Year
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : academicYears.length === 0 ? (
          <EmptyState icon={Calendar} title="No academic sessions found" description="Add the first academic year to get started." />
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Session Name</th>
                  <th>Year Code</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Status</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {academicYears.map((ay) => {
                  const status = getStatus(ay);
                  return (
                    <tr key={ay.id} style={ay.is_current ? { backgroundColor: 'var(--primary-light)' } : {}}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {ay.is_current && <CheckCircle size={15} style={{ color: 'var(--success)', flexShrink: 0 }} />}
                          <span className="td-main">{ay.year_name || ay.name || '—'}</span>
                        </div>
                      </td>
                      <td><code style={{ color: 'var(--primary)', fontWeight: 600 }}>{ay.year_code || ay.code || '—'}</code></td>
                      <td>{formatDate(ay.start_date)}</td>
                      <td>{formatDate(ay.end_date)}</td>
                      <td><span className={`badge ${status.cls}`}>{status.label}</span></td>
                      {isAdmin && (
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm" style={{ padding: '4px 10px' }} onClick={() => { setEditTarget(ay); setShowForm(true); }}><Edit2 size={13} /></button>
                            <button className="btn btn-sm" style={{ padding: '4px 10px', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid rgba(220,38,38,0.2)' }} onClick={() => setDeleteTarget(ay)}><Trash2 size={13} /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
