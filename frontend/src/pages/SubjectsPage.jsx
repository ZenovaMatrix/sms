import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Search, PlusCircle, Edit2, Trash2, X, Save,
  AlertTriangle, Filter, ChevronLeft, ChevronRight, LayoutGrid, List,
} from 'lucide-react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import EmptyState from '../components/EmptyState';
import { TableSkeleton, CardSkeleton } from '../components/LoadingSkeleton';

function uid() { return 'sub-' + Math.random().toString(36).slice(2, 10); }

const STATUS_OPTS = ['active', 'inactive'];

// ─── Form Modal ─────────────────────────────────────────────────────────────
function SubjectFormModal({ open, onClose, onSaved, editData }) {
  const [form, setForm] = useState({ subject_name: '', subject_code: '', description: '', status: 'active' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const { success, error: toastError } = useToast();

  useEffect(() => {
    if (open) {
      setForm(editData
        ? { subject_name: editData.subject_name || '', subject_code: editData.subject_code || '', description: editData.description || '', status: editData.status || 'active' }
        : { subject_name: '', subject_code: '', description: '', status: 'active' }
      );
      setErr('');
    }
  }, [open, editData]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.subject_name.trim()) { setErr('Subject name is required.'); return; }
    if (!form.subject_code.trim()) { setErr('Subject code is required.'); return; }
    setSaving(true);
    try {
      if (editData) {
        const { data } = await api.patch(`/subjects/${editData.id}`, { subject_name: form.subject_name.trim(), subject_code: form.subject_code.trim().toUpperCase(), description: form.description.trim() || null, status: form.status });
        if (data.success) { success('Subject updated!'); onSaved(); onClose(); }
      } else {
        const { data } = await api.post('/subjects', { id: uid(), subject_name: form.subject_name.trim(), subject_code: form.subject_code.trim().toUpperCase(), description: form.description.trim() || null, status: form.status });
        if (data.success) { success('Subject created!'); onSaved(); onClose(); }
      }
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to save subject.';
      setErr(msg); toastError(msg);
    } finally { setSaving(false); }
  }

  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{editData ? 'Edit Subject' : 'Add New Subject'}</h2>
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
              <label className="form-label">Subject Name *</label>
              <input className="form-input" placeholder="e.g. Mathematics, Science, English" value={form.subject_name} onChange={e => setForm(f => ({ ...f, subject_name: e.target.value }))} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Subject Code *</label>
              <input className="form-input" placeholder="e.g. MATH, SCI-10" value={form.subject_code} onChange={e => setForm(f => ({ ...f, subject_code: e.target.value.toUpperCase() }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUS_OPTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Description</label>
              <textarea className="form-input" style={{ resize: 'vertical', minHeight: 72 }} placeholder="Optional subject description…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              <Save size={14} /> {saving ? 'Saving…' : (editData ? 'Update Subject' : 'Create Subject')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm ──────────────────────────────────────────────────────────
function DeleteSubjectModal({ subject, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false);
  const { success, error: toastError } = useToast();

  async function handleDelete() {
    setLoading(true);
    try {
      const { data } = await api.delete(`/subjects/${subject.id}`);
      if (data.success) { success('Subject deleted.'); onDeleted(); onClose(); }
    } catch (e) {
      toastError(e.response?.data?.message || 'Cannot delete: subject has dependencies.');
    } finally { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Delete Subject</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14, backgroundColor: 'var(--danger-light)', borderRadius: 'var(--radius-sm)' }}>
            <AlertTriangle size={20} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontWeight: 600, color: 'var(--danger)', fontSize: '0.88rem' }}>This action cannot be undone.</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                Delete <strong>{subject.subject_name}</strong> ({subject.subject_code})?
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-sm" style={{ backgroundColor: 'var(--danger)', color: '#fff', border: 'none' }} onClick={handleDelete} disabled={loading}>
              {loading ? 'Deleting…' : 'Delete Subject'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Color per-subject type ──────────────────────────────────────────────────
const SUBJECT_COLORS = [
  { bg: 'var(--primary-light)', fg: 'var(--primary)' },
  { bg: 'var(--secondary-light)', fg: 'var(--secondary)' },
  { bg: 'var(--info-light)', fg: 'var(--info)' },
  { bg: 'var(--success-light)', fg: 'var(--success)' },
  { bg: 'var(--warning-light)', fg: 'var(--warning)' },
  { bg: 'var(--accent-light)', fg: 'var(--accent)' },
];

function colorFor(s) { return SUBJECT_COLORS[(s.subject_name || '').length % SUBJECT_COLORS.length]; }

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function SubjectsPage() {
  const { user } = useAuth();
  const isAdmin = (user?.role || '').toLowerCase() === 'admin';

  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [viewMode, setViewMode] = useState('table');

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const { data } = await api.get(`/subjects?${params}`);
      if (data.success) {
        setSubjects(data.data.subjects || data.data.items || data.data || []);
        const pag = data.data.pagination || {};
        setTotalPages(pag.totalPages || 1);
        setTotalCount(pag.total || 0);
      }
    } catch (err) {
      console.error('Failed to load subjects:', err);
    } finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchSubjects(); }, [fetchSubjects]);

  function handleSearchSubmit(e) { e.preventDefault(); setSearch(searchInput); setPage(1); }

  const activeCount = subjects.filter(s => s.status === 'active').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Modals */}
      <SubjectFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditTarget(null); }}
        onSaved={fetchSubjects}
        editData={editTarget}
      />
      {deleteTarget && <DeleteSubjectModal subject={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={fetchSubjects} />}

      {/* Stat Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
        {[
          { label: 'Total Subjects', value: totalCount, bg: 'var(--primary-light)', fg: 'var(--primary)' },
          { label: 'Active Subjects', value: activeCount, bg: 'var(--success-light)', fg: 'var(--success)' },
          { label: 'Inactive Subjects', value: totalCount - activeCount, bg: 'var(--warning-light)', fg: 'var(--warning)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', backgroundColor: s.bg, color: s.fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BookOpen size={22} /></div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.fg }}>{loading ? '—' : s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 8, flex: 1, minWidth: 200 }}>
          <div className="search-input-wrapper" style={{ flex: 1 }}>
            <Search size={15} />
            <input className="form-input" placeholder="Search by name or code…" value={searchInput} onChange={e => setSearchInput(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-secondary btn-sm">Search</button>
        </form>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={14} style={{ color: 'var(--text-muted)' }} />
          <select className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: '0.82rem' }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('table')} title="Table"><List size={15} /></button>
          <button type="button" className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('grid')} title="Grid"><LayoutGrid size={15} /></button>
        </div>
        {isAdmin && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { setEditTarget(null); setShowForm(true); }}>
            <PlusCircle size={15} /> Add Subject
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        viewMode === 'table' ? <div className="card" style={{ padding: 0, overflow: 'hidden' }}><TableSkeleton rows={6} cols={5} /></div> : <CardSkeleton count={6} />
      ) : subjects.length === 0 ? (
        <EmptyState icon={BookOpen} title="No subjects found" description={search ? 'Try a different search term.' : 'Create the first subject to get started.'} />
      ) : viewMode === 'table' ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Subject Code</th>
                  <th>Subject Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {subjects.map((s) => {
                  const { bg, fg } = colorFor(s);
                  return (
                    <tr key={s.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 30, height: 30, borderRadius: 'var(--radius-sm)', backgroundColor: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <BookOpen size={14} />
                          </div>
                          <code style={{ color: fg, fontWeight: 700, fontSize: '0.82rem' }}>{s.subject_code || '—'}</code>
                        </div>
                      </td>
                      <td><span className="td-main">{s.subject_name || '—'}</span></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.description || '—'}</td>
                      <td><span className={`badge ${s.status === 'active' ? 'badge-emerald' : 'badge-slate'}`}>{s.status || 'active'}</span></td>
                      {isAdmin && (
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm" style={{ padding: '4px 10px' }} onClick={() => { setEditTarget(s); setShowForm(true); }}><Edit2 size={13} /></button>
                            <button className="btn btn-sm" style={{ padding: '4px 10px', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid rgba(220,38,38,0.2)' }} onClick={() => setDeleteTarget(s)}><Trash2 size={13} /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span>Page {page} of {totalPages} ({totalCount} subjects)</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={14} /> Prev</button>
                <button className="btn btn-secondary btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next <ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Grid View */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {subjects.map(s => {
            const { bg, fg } = colorFor(s);
            return (
              <div key={s.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', backgroundColor: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <BookOpen size={18} />
                    </div>
                    <div>
                      <h4 style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{s.subject_name}</h4>
                      <code style={{ fontSize: '0.73rem', color: fg }}>{s.subject_code}</code>
                    </div>
                  </div>
                  <span className={`badge ${s.status === 'active' ? 'badge-emerald' : 'badge-slate'}`}>{s.status}</span>
                </div>
                {s.description && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{s.description}</p>
                )}
                {isAdmin && (
                  <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                    <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setEditTarget(s); setShowForm(true); }}><Edit2 size={13} /> Edit</button>
                    <button className="btn btn-sm" style={{ flex: 1, justifyContent: 'center', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid rgba(220,38,38,0.2)' }} onClick={() => setDeleteTarget(s)}><Trash2 size={13} /> Delete</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
