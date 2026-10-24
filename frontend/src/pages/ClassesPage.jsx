import { useState, useEffect, useCallback } from 'react';
import {
  Layers, Users, BookOpen, GraduationCap, PlusCircle, ChevronRight,
  LayoutGrid, List, Search, Edit2, Trash2, X, Save, CheckCircle,
  AlertTriangle, ChevronLeft,
} from 'lucide-react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import EmptyState from '../components/EmptyState';
import { CardSkeleton, TableSkeleton } from '../components/LoadingSkeleton';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function uid() {
  return 'cls-' + Math.random().toString(36).slice(2, 10);
}

const PALETTE = [
  ['#166534','#dcfce7'], ['#1d4ed8','#dbeafe'], ['#7c3aed','#ede9fe'],
  ['#b45309','#fef3c7'], ['#0f766e','#ccfbf1'], ['#be185d','#fce7f3'],
  ['#c2410c','#ffedd5'], ['#0369a1','#e0f2fe'],
];

// ─── Create / Edit Modal ───────────────────────────────────────────────────────
function ClassFormModal({ open, onClose, onSaved, editData }) {
  const [form, setForm] = useState({ class_name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const { success, error: toastError } = useToast();

  useEffect(() => {
    if (open) {
      setForm(editData ? { class_name: editData.class_name || '', description: editData.description || '' } : { class_name: '', description: '' });
      setErr('');
    }
  }, [open, editData]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.class_name.trim()) { setErr('Class name is required.'); return; }
    setSaving(true);
    try {
      if (editData) {
        const { data } = await api.patch(`/classes/${editData.id}`, { class_name: form.class_name.trim(), description: form.description.trim() || null });
        if (data.success) { success('Class updated successfully!'); onSaved(); onClose(); }
      } else {
        const { data } = await api.post('/classes', { id: uid(), class_name: form.class_name.trim(), description: form.description.trim() || null });
        if (data.success) { success('Class created successfully!'); onSaved(); onClose(); }
      }
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to save class.';
      setErr(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{editData ? 'Edit Class' : 'Add New Class'}</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 24px 24px' }}>
          {err && (
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={14} /> {err}
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Class Name *</label>
            <input className="form-input" placeholder="e.g. Grade 8, Class VI-A" value={form.class_name} onChange={e => setForm(f => ({ ...f, class_name: e.target.value }))} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-input" style={{ resize: 'vertical', minHeight: 80 }} placeholder="Optional description or notes..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              <Save size={14} /> {saving ? 'Saving…' : (editData ? 'Update Class' : 'Create Class')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Detail / Side Panel ───────────────────────────────────────────────────────
function ClassDetailPanel({ cls, onClose }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cls) return;
    setLoading(true);
    api.get(`/classes/${cls.id}`)
      .then(({ data }) => { if (data.success) setDetails(data.data.class || data.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [cls]);

  if (!cls) return null;

  const colorIdx = cls.class_name ? cls.class_name.length % PALETTE.length : 0;
  const [fgColor, bgColor] = PALETTE[colorIdx];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', backgroundColor: bgColor, color: fgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem' }}>
              {(cls.class_name || 'C')[0]}
            </div>
            <div>
              <h2 className="modal-title" style={{ marginBottom: 2 }}>{cls.class_name}</h2>
              {cls.description && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{cls.description}</p>}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Stats Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {[
              { label: 'Sections', value: details?.section_count ?? cls.section_count ?? '—', color: 'var(--primary)' },
              { label: 'Enrolled', value: details?.total_enrolled ?? cls.total_enrolled ?? '—', color: 'var(--success)' },
              { label: 'Capacity', value: details?.total_capacity ?? cls.total_capacity ?? '—', color: 'var(--secondary)' },
            ].map(s => (
              <div key={s.label} style={{ backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-md)', padding: '12px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Sections list */}
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading sections…</div>
          ) : details?.sections?.length > 0 ? (
            <div>
              <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Sections</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {details.sections.map(sec => (
                  <div key={sec.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                    <div>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{sec.section_name}</span>
                      {sec.teachers && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 10 }}>Teacher: {sec.teachers}</span>}
                    </div>
                    <span className="badge badge-emerald">{sec.enrolled_count}/{sec.capacity} enrolled</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: 16, backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
              No sections configured for this class.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Delete Modal ──────────────────────────────────────────────────────
function DeleteConfirmModal({ cls, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false);
  const { success, error: toastError } = useToast();

  async function handleDelete() {
    setLoading(true);
    try {
      const { data } = await api.delete(`/classes/${cls.id}`);
      if (data.success) { success('Class deleted.'); onDeleted(); onClose(); }
    } catch (e) {
      toastError(e.response?.data?.message || 'Cannot delete: class has dependencies.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Delete Class</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14, backgroundColor: 'var(--danger-light)', borderRadius: 'var(--radius-sm)' }}>
            <AlertTriangle size={20} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontWeight: 600, color: 'var(--danger)', fontSize: '0.88rem' }}>This action cannot be undone.</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                Deleting <strong>{cls.class_name}</strong> will fail if it has sections, enrollments, or exam records.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-sm" style={{ backgroundColor: 'var(--danger)', color: '#fff', border: 'none' }} onClick={handleDelete} disabled={loading}>
              {loading ? 'Deleting…' : 'Delete Class'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ClassesPage() {
  const { user } = useAuth();
  const isAdmin = (user?.role || '').toLowerCase() === 'admin';

  const [classes, setClasses] = useState([]);
  const [stats, setStats] = useState({ totalClasses: 0, totalSections: 0, totalEnrolled: 0 });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 12 });
      if (search) params.set('search', search);
      const { data } = await api.get(`/classes?${params}`);
      if (data.success) {
        const list = data.data.classes || [];
        setClasses(list);
        const pag = data.data.pagination || {};
        setTotalPages(pag.totalPages || 1);
        // Compute overview stats
        const totalSections = list.reduce((s, c) => s + (Number(c.section_count) || 0), 0);
        const totalEnrolled = list.reduce((s, c) => s + (Number(c.total_enrolled) || 0), 0);
        setStats({ totalClasses: pag.total || list.length, totalSections, totalEnrolled });
      }
    } catch (err) {
      console.error('Failed to load classes:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  const colorForClass = (c) => PALETTE[(c.class_name || '').length % PALETTE.length];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Modals */}
      <ClassFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditTarget(null); }}
        onSaved={fetchClasses}
        editData={editTarget}
      />
      {detailTarget && <ClassDetailPanel cls={detailTarget} onClose={() => setDetailTarget(null)} />}
      {deleteTarget && <DeleteConfirmModal cls={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={fetchClasses} />}

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        {[
          { label: 'Total Grade Levels', value: stats.totalClasses, icon: <Layers size={22} />, bg: 'var(--primary-light)', fg: 'var(--primary)', valColor: 'var(--text-primary)' },
          { label: 'Active Sections', value: stats.totalSections, icon: <Users size={22} />, bg: 'var(--secondary-light)', fg: 'var(--secondary)', valColor: 'var(--secondary)' },
          { label: 'Total Enrolled', value: stats.totalEnrolled, icon: <GraduationCap size={22} />, bg: 'var(--success-light)', fg: 'var(--success)', valColor: 'var(--success)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', backgroundColor: s.bg, color: s.fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.valColor }}>{loading ? '—' : s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 8, flex: 1, minWidth: 200 }}>
          <div className="search-input-wrapper" style={{ flex: 1 }}>
            <Search size={15} />
            <input className="form-input" placeholder="Search classes…" value={searchInput} onChange={e => setSearchInput(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-secondary btn-sm">Search</button>
        </form>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('grid')}
            title="Grid View"
          ><LayoutGrid size={15} /></button>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('table')}
            title="Table View"
          ><List size={15} /></button>
        </div>
        {isAdmin && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { setEditTarget(null); setShowForm(true); }}>
            <PlusCircle size={15} /> Add Class
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        viewMode === 'grid' ? <CardSkeleton count={6} /> : <div className="card" style={{ padding: 0, overflow: 'hidden' }}><TableSkeleton rows={6} cols={5} /></div>
      ) : classes.length === 0 ? (
        <EmptyState icon={Layers} title="No classes found" description={search ? 'Try a different search term.' : 'Create the first class to get started.'} />
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {classes.map((c) => {
            const [fg, bg] = colorForClass(c);
            const enrolled = Number(c.total_enrolled) || 0;
            const capacity = Number(c.total_capacity) || 0;
            const pct = capacity > 0 ? Math.min(100, Math.round((enrolled / capacity) * 100)) : 0;
            return (
              <div key={c.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, cursor: 'pointer', transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', backgroundColor: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.2rem', flexShrink: 0 }}>
                      {(c.class_name || 'C')[0]}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{c.class_name}</h4>
                      {c.description && <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 1 }}>{c.description}</p>}
                    </div>
                  </div>
                  <span className="badge badge-emerald">Active</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: '0.8rem', backgroundColor: 'var(--bg-muted)', padding: 12, borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Sections</span>
                    <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{c.section_count || 0}</p>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Capacity</span>
                    <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{enrolled} / {capacity || '—'}</p>
                  </div>
                </div>

                {capacity > 0 && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                      <span>Enrollment</span><span>{pct}%</span>
                    </div>
                    <div style={{ height: 6, backgroundColor: 'var(--bg-muted)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: pct >= 90 ? 'var(--danger)' : pct >= 70 ? 'var(--warning)' : 'var(--success)', borderRadius: 3, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {isAdmin && (
                      <>
                        <button className="btn btn-secondary btn-sm" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={e => { e.stopPropagation(); setEditTarget(c); setShowForm(true); }}><Edit2 size={12} /></button>
                        <button className="btn btn-sm" style={{ padding: '4px 10px', fontSize: '0.75rem', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid rgba(220,38,38,0.2)' }} onClick={e => { e.stopPropagation(); setDeleteTarget(c); }}><Trash2 size={12} /></button>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    style={{ fontSize: '0.78rem', fontWeight: 600, color: fg, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => setDetailTarget(c)}
                  >
                    Details <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Class Name</th>
                  <th>Sections</th>
                  <th>Enrolled</th>
                  <th>Capacity</th>
                  <th>Status</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => {
                  const [fg] = colorForClass(c);
                  return (
                    <tr key={c.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', backgroundColor: colorForClass(c)[1], color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', flexShrink: 0 }}>
                            {(c.class_name || 'C')[0]}
                          </div>
                          <div>
                            <span className="td-main">{c.class_name}</span>
                            {c.description && <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{c.description}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{c.section_count || 0}</td>
                      <td style={{ fontWeight: 600 }}>{c.total_enrolled || 0}</td>
                      <td style={{ fontWeight: 600 }}>{c.total_capacity || '—'}</td>
                      <td><span className="badge badge-emerald">Active</span></td>
                      {isAdmin && (
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm" style={{ padding: '4px 10px' }} onClick={() => setDetailTarget(c)} title="Details"><ChevronRight size={13} /></button>
                            <button className="btn btn-secondary btn-sm" style={{ padding: '4px 10px' }} onClick={() => { setEditTarget(c); setShowForm(true); }} title="Edit"><Edit2 size={13} /></button>
                            <button className="btn btn-sm" style={{ padding: '4px 10px', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid rgba(220,38,38,0.2)' }} onClick={() => setDeleteTarget(c)} title="Delete"><Trash2 size={13} /></button>
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
              <span>Page {page} of {totalPages}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={14} /> Prev</button>
                <button className="btn btn-secondary btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next <ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
