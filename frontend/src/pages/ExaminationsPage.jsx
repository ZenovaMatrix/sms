import { useState, useEffect, useCallback } from 'react';
import {
  FileSpreadsheet, Calendar, Clock, MapPin, Award, PlusCircle,
  ChevronLeft, ChevronRight, Filter, X, Save, AlertTriangle, Edit2,
} from 'lucide-react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import EmptyState from '../components/EmptyState';
import { TableSkeleton } from '../components/LoadingSkeleton';

function uid() { return 'exam-' + Math.random().toString(36).slice(2, 10); }

function ExamStatusPill({ status }) {
  const map = { scheduled: 'badge-sky', ongoing: 'badge-amber', completed: 'badge-emerald', cancelled: 'badge-red' };
  return <span className={`badge ${map[status] || 'badge-sky'}`}>{status || 'scheduled'}</span>;
}

const EXAM_TYPES = ['Term Exam', 'Unit Test', 'Midterm', 'Final', 'Surprise Quiz', 'Practical', 'Assignment'];
const STATUSES = ['scheduled', 'ongoing', 'completed', 'cancelled'];

// ─── Form Modal ──────────────────────────────────────────────────────────────
function ExamFormModal({ open, onClose, onSaved, editData, classes, academicYears }) {
  const [form, setForm] = useState({ exam_name: '', exam_type: 'Term Exam', class_id: '', academic_year_id: '', start_date: '', end_date: '', description: '', status: 'scheduled' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const { success, error: toastError } = useToast();

  useEffect(() => {
    if (open) {
      setForm(editData
        ? { exam_name: editData.exam_name || editData.title || '', exam_type: editData.exam_type || 'Term Exam', class_id: editData.class_id || '', academic_year_id: editData.academic_year_id || '', start_date: (editData.start_date || '').split('T')[0], end_date: (editData.end_date || '').split('T')[0], description: editData.description || '', status: editData.status || 'scheduled' }
        : { exam_name: '', exam_type: 'Term Exam', class_id: '', academic_year_id: '', start_date: '', end_date: '', description: '', status: 'scheduled' }
      );
      setErr('');
    }
  }, [open, editData]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.exam_name.trim()) { setErr('Exam name is required.'); return; }
    if (!form.start_date) { setErr('Start date is required.'); return; }
    setSaving(true);
    try {
      const payload = { exam_name: form.exam_name.trim(), exam_type: form.exam_type, class_id: form.class_id || null, academic_year_id: form.academic_year_id || null, start_date: form.start_date, end_date: form.end_date || null, description: form.description.trim() || null, status: form.status };
      if (editData) {
        const { data } = await api.patch(`/examinations/${editData.id}`, payload);
        if (data.success) { success('Exam updated!'); onSaved(); onClose(); }
      } else {
        const { data } = await api.post('/examinations', { id: uid(), ...payload });
        if (data.success) { success('Exam scheduled!'); onSaved(); onClose(); }
      }
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to save exam.';
      setErr(msg); toastError(msg);
    } finally { setSaving(false); }
  }

  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{editData ? 'Edit Examination' : 'Schedule New Exam'}</h2>
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
              <label className="form-label">Exam Name *</label>
              <input className="form-input" placeholder="e.g. Midterm 2026, Unit Test 1" value={form.exam_name} onChange={e => setForm(f => ({ ...f, exam_name: e.target.value }))} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Exam Type</label>
              <select className="form-input" value={form.exam_type} onChange={e => setForm(f => ({ ...f, exam_type: e.target.value }))}>
                {EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Class (Optional)</label>
              <select className="form-input" value={form.class_id} onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))}>
                <option value="">All Classes</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Academic Year</label>
              <select className="form-input" value={form.academic_year_id} onChange={e => setForm(f => ({ ...f, academic_year_id: e.target.value }))}>
                <option value="">Select Year</option>
                {academicYears.map(a => <option key={a.id} value={a.id}>{a.year_name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Start Date *</label>
              <input type="date" className="form-input" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">End Date</label>
              <input type="date" className="form-input" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Description / Notes</label>
              <textarea className="form-input" style={{ resize: 'vertical', minHeight: 72 }} placeholder="Optional notes, syllabus, or instructions…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              <Save size={14} /> {saving ? 'Saving…' : (editData ? 'Update Exam' : 'Schedule Exam')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function ExaminationsPage() {
  const { user } = useAuth();
  const isAdmin = (user?.role || '').toLowerCase() === 'admin';

  const [exams, setExams] = useState([]);
  const [classes, setClasses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const fetchExams = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 12 });
      if (statusFilter) params.set('status', statusFilter);
      const { data } = await api.get(`/examinations?${params}`);
      if (data.success) {
        setExams(data.data.examinations || data.data.items || data.data || []);
        const pag = data.data.pagination || {};
        setTotalPages(pag.totalPages || 1);
        setTotal(pag.total || 0);
      }
    } catch (err) {
      console.error('Failed to load exams:', err);
    } finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { fetchExams(); }, [fetchExams]);

  // Load classes and academic years for form
  useEffect(() => {
    api.get('/classes?limit=50').then(({ data }) => { if (data.success) setClasses(data.data.classes || []); }).catch(() => {});
    api.get('/academic-years?limit=20').then(({ data }) => { if (data.success) setAcademicYears(data.data.academicYears || data.data.items || data.data || []); }).catch(() => {});
  }, []);

  function formatDate(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return d; }
  }

  const upcoming = exams.filter(e => e.status === 'scheduled').length;
  const ongoing = exams.filter(e => e.status === 'ongoing').length;
  const completed = exams.filter(e => e.status === 'completed').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Modals */}
      <ExamFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditTarget(null); }}
        onSaved={fetchExams}
        editData={editTarget}
        classes={classes}
        academicYears={academicYears}
      />

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        {[
          { label: 'Total Exams', value: total, icon: <FileSpreadsheet size={22} />, bg: 'var(--primary-light)', fg: 'var(--primary)' },
          { label: 'Scheduled', value: upcoming, icon: <Calendar size={22} />, bg: 'var(--info-light)', fg: 'var(--info)' },
          { label: 'Ongoing', value: ongoing, icon: <Clock size={22} />, bg: 'var(--warning-light)', fg: 'var(--warning)' },
          { label: 'Completed', value: completed, icon: <Award size={22} />, bg: 'var(--success-light)', fg: 'var(--success)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', backgroundColor: s.bg, color: s.fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.fg }}>{loading ? '—' : s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="card" style={{ padding: '14px 20px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>Examination Timetable</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={14} style={{ color: 'var(--text-muted)' }} />
          <select className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: '0.82rem' }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
        {isAdmin && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { setEditTarget(null); setShowForm(true); }}>
            <PlusCircle size={15} /> Schedule Exam
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : exams.length === 0 ? (
          <EmptyState icon={FileSpreadsheet} title="No examinations scheduled" description="Examination periods and timetable schedules will appear here." />
        ) : (
          <>
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Exam Name</th>
                    <th>Type</th>
                    <th>Class</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Status</th>
                    {isAdmin && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {exams.map((e, idx) => (
                    <tr key={e.id || idx}>
                      <td><span className="td-main">{e.exam_name || e.title || '—'}</span></td>
                      <td><span className="badge badge-slate">{e.exam_type || 'Term Exam'}</span></td>
                      <td>{e.class_name || '—'}</td>
                      <td style={{ fontWeight: 500 }}>{formatDate(e.start_date)}</td>
                      <td style={{ fontWeight: 500 }}>{formatDate(e.end_date)}</td>
                      <td><ExamStatusPill status={e.status || 'scheduled'} /></td>
                      {isAdmin && (
                        <td>
                          <button className="btn btn-secondary btn-sm" style={{ padding: '4px 10px' }} onClick={() => { setEditTarget(e); setShowForm(true); }}><Edit2 size={13} /></button>
                        </td>
                      )}
                    </tr>
                  ))}
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
          </>
        )}
      </div>
    </div>
  );
}
