import { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList,
  Search,
  CheckCircle,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Edit2,
  Trash2,
  ArrowRightLeft,
  X,
  AlertTriangle,
  Filter,
  Check,
  UserCheck,
  UserX,
  Layers,
  Calendar,
} from 'lucide-react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import EmptyState from '../components/EmptyState';
import { TableSkeleton } from '../components/LoadingSkeleton';

function EnrollmentStatusPill({ status }) {
  const map = {
    active: 'badge-emerald',
    completed: 'badge-sky',
    transferred: 'badge-amber',
    withdrawn: 'badge-red',
    dropped: 'badge-red',
    suspended: 'badge-amber',
  };
  return <span className={`badge ${map[status] || 'badge-emerald'}`}>{status || 'active'}</span>;
}

// ─── Create Enrollment Modal ──────────────────────────────────────────────────
function CreateEnrollmentModal({ open, onClose, onCreated, classes, academicYears }) {
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [sections, setSections] = useState([]);
  const [loadingSections, setLoadingSections] = useState(false);

  const [form, setForm] = useState({
    student_id: '',
    academic_year_id: '',
    class_id: '',
    section_id: '',
    enrollment_date: new Date().toISOString().split('T')[0],
    status: 'active',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const { success, error: toastError } = useToast();

  useEffect(() => {
    if (!open) return;
    setErr('');
    setForm({
      student_id: '',
      academic_year_id: academicYears[0]?.id || '',
      class_id: classes[0]?.id || '',
      section_id: '',
      enrollment_date: new Date().toISOString().split('T')[0],
      status: 'active',
    });

    // Fetch students list
    async function loadStudents() {
      setLoadingStudents(true);
      try {
        const { data } = await api.get('/students?limit=100');
        if (data.success) {
          setStudents(data.data.students || data.data.items || data.data || []);
        }
      } catch (e) {
        console.error('Failed to load students:', e);
      } finally {
        setLoadingStudents(false);
      }
    }
    loadStudents();
  }, [open, academicYears, classes]);

  // Fetch sections when class changes
  useEffect(() => {
    if (!form.class_id) {
      setSections([]);
      return;
    }
    async function loadSections() {
      setLoadingSections(true);
      try {
        const { data } = await api.get(`/sections?class_id=${form.class_id}`);
        if (data.success) {
          const list = data.data.sections || data.data.items || data.data || [];
          setSections(list);
          if (list.length > 0) {
            setForm(prev => ({ ...prev, section_id: list[0].id }));
          } else {
            setForm(prev => ({ ...prev, section_id: '' }));
          }
        }
      } catch (e) {
        console.error('Failed to load sections:', e);
      } finally {
        setLoadingSections(false);
      }
    }
    loadSections();
  }, [form.class_id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.student_id) {
      setErr('Please select a student.');
      return;
    }
    if (!form.academic_year_id) {
      setErr('Please select an academic year.');
      return;
    }
    if (!form.class_id) {
      setErr('Please select a class.');
      return;
    }
    if (!form.section_id) {
      setErr('Please select a section for this class.');
      return;
    }

    setSaving(true);
    setErr('');
    try {
      const payload = {
        student_id: form.student_id,
        academic_year_id: form.academic_year_id,
        class_id: form.class_id,
        section_id: form.section_id,
        enrollment_date: form.enrollment_date,
        status: form.status,
      };
      const { data } = await api.post('/enrollments', payload);
      if (data.success) {
        success('Student enrolled successfully!');
        onCreated();
        onClose();
      }
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to create enrollment.';
      setErr(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">New Student Enrollment</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 24px 24px' }}>
          {err && (
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={15} /> {err}
            </div>
          )}

          <div>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 6 }}>
              Student *
            </label>
            <select
              className="form-input"
              value={form.student_id}
              onChange={e => setForm({ ...form, student_id: e.target.value })}
              required
            >
              <option value="">{loadingStudents ? 'Loading students...' : '-- Select Student --'}</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name} ({s.admission_number || s.id.slice(0, 8)})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 6 }}>
                Academic Year *
              </label>
              <select
                className="form-input"
                value={form.academic_year_id}
                onChange={e => setForm({ ...form, academic_year_id: e.target.value })}
                required
              >
                <option value="">-- Select Academic Year --</option>
                {academicYears.map(y => (
                  <option key={y.id} value={y.id}>{y.year_name || y.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 6 }}>
                Enrollment Date *
              </label>
              <input
                type="date"
                className="form-input"
                value={form.enrollment_date}
                onChange={e => setForm({ ...form, enrollment_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 6 }}>
                Target Class *
              </label>
              <select
                className="form-input"
                value={form.class_id}
                onChange={e => setForm({ ...form, class_id: e.target.value })}
                required
              >
                <option value="">-- Select Class --</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.class_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 6 }}>
                Section *
              </label>
              <select
                className="form-input"
                value={form.section_id}
                onChange={e => setForm({ ...form, section_id: e.target.value })}
                required
                disabled={loadingSections || sections.length === 0}
              >
                {loadingSections ? (
                  <option>Loading sections...</option>
                ) : sections.length === 0 ? (
                  <option value="">No sections found</option>
                ) : (
                  sections.map(s => (
                    <option key={s.id} value={s.id}>{s.section_name}</option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 6 }}>
              Initial Status
            </label>
            <select
              className="form-input"
              value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="transferred">Transferred</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? 'Enrolling...' : 'Confirm Enrollment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Transfer Student Modal ───────────────────────────────────────────────────
function TransferModal({ open, enrollment, onClose, onUpdated, classes }) {
  const [sections, setSections] = useState([]);
  const [loadingSections, setLoadingSections] = useState(false);
  const [form, setForm] = useState({ class_id: '', section_id: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const { success, error: toastError } = useToast();

  useEffect(() => {
    if (open && enrollment) {
      setForm({
        class_id: enrollment.class_id || classes[0]?.id || '',
        section_id: enrollment.section_id || '',
      });
      setErr('');
    }
  }, [open, enrollment, classes]);

  useEffect(() => {
    if (!form.class_id) {
      setSections([]);
      return;
    }
    async function loadSections() {
      setLoadingSections(true);
      try {
        const { data } = await api.get(`/sections?class_id=${form.class_id}`);
        if (data.success) {
          const list = data.data.sections || data.data.items || data.data || [];
          setSections(list);
          if (list.length > 0 && !list.some(s => s.id === form.section_id)) {
            setForm(prev => ({ ...prev, section_id: list[0].id }));
          }
        }
      } catch (e) {
        console.error('Failed to load sections:', e);
      } finally {
        setLoadingSections(false);
      }
    }
    loadSections();
  }, [form.class_id]);

  async function handleTransfer(e) {
    e.preventDefault();
    if (!form.class_id || !form.section_id) {
      setErr('Please select both class and section.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const { data } = await api.patch(`/enrollments/${enrollment.id}`, {
        class_id: form.class_id,
        section_id: form.section_id,
      });
      if (data.success) {
        success('Student transferred successfully!');
        onUpdated();
        onClose();
      }
    } catch (e) {
      const msg = e.response?.data?.message || 'Transfer failed.';
      setErr(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!open || !enrollment) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Transfer Student</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleTransfer} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 24px 24px' }}>
          {err && (
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={15} /> {err}
            </div>
          )}

          <div style={{ padding: '12px 14px', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Student</div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
              {enrollment.student_name || `${enrollment.first_name || ''} ${enrollment.last_name || ''}`.trim() || 'Student'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              Current: <strong>{enrollment.class_name}</strong> • Section {enrollment.section_name}
            </div>
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 6 }}>
              New Class *
            </label>
            <select
              className="form-input"
              value={form.class_id}
              onChange={e => setForm({ ...form, class_id: e.target.value })}
              required
            >
              <option value="">-- Select Class --</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.class_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 6 }}>
              New Section *
            </label>
            <select
              className="form-input"
              value={form.section_id}
              onChange={e => setForm({ ...form, section_id: e.target.value })}
              required
              disabled={loadingSections || sections.length === 0}
            >
              {loadingSections ? (
                <option>Loading sections...</option>
              ) : sections.length === 0 ? (
                <option value="">No sections found</option>
              ) : (
                sections.map(s => (
                  <option key={s.id} value={s.id}>{s.section_name}</option>
                ))
              )}
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? 'Transferring...' : 'Apply Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Status Update Modal ──────────────────────────────────────────────────────
function StatusModal({ open, enrollment, onClose, onUpdated }) {
  const [status, setStatus] = useState('active');
  const [saving, setSaving] = useState(false);
  const { success, error: toastError } = useToast();

  useEffect(() => {
    if (open && enrollment) {
      setStatus(enrollment.status || 'active');
    }
  }, [open, enrollment]);

  async function handleUpdate(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.patch(`/enrollments/${enrollment.id}`, { status });
      if (data.success) {
        success(`Enrollment status updated to ${status}!`);
        onUpdated();
        onClose();
      }
    } catch (e) {
      toastError(e.response?.data?.message || 'Failed to update status.');
    } finally {
      setSaving(false);
    }
  }

  if (!open || !enrollment) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Update Enrollment Status</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 24px 24px' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Updating status for <strong>{enrollment.student_name || `${enrollment.first_name || ''} ${enrollment.last_name || ''}`}</strong>:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { val: 'active', label: 'Active', desc: 'Attending regular classes' },
              { val: 'completed', label: 'Completed', desc: 'Graduated or finished academic term' },
              { val: 'transferred', label: 'Transferred', desc: 'Transferred out to another institute' },
              { val: 'withdrawn', label: 'Withdrawn', desc: 'Safely withdrawn from registration' },
            ].map(opt => (
              <label
                key={opt.val}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${status === opt.val ? 'var(--primary)' : 'var(--border)'}`,
                  backgroundColor: status === opt.val ? 'var(--primary-subtle, rgba(22, 101, 52, 0.05))' : 'var(--bg-surface)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="enrollment_status"
                  value={opt.val}
                  checked={status === opt.val}
                  onChange={() => setStatus(opt.val)}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{opt.label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? 'Updating...' : 'Save Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────
function DeleteModal({ open, enrollment, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const { success, error: toastError } = useToast();

  async function handleDelete() {
    setDeleting(true);
    try {
      const { data } = await api.delete(`/enrollments/${enrollment.id}`);
      if (data.success) {
        success('Enrollment removed successfully.');
        onDeleted();
        onClose();
      }
    } catch (e) {
      toastError(e.response?.data?.message || 'Failed to delete enrollment.');
    } finally {
      setDeleting(false);
    }
  }

  if (!open || !enrollment) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ color: 'var(--danger)' }}>Confirm Withdrawal / Deletion</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Are you sure you want to permanently delete the enrollment record for{' '}
            <strong>{enrollment.student_name || `${enrollment.first_name || ''} ${enrollment.last_name || ''}`}</strong> in{' '}
            <strong>{enrollment.class_name} • Section {enrollment.section_name}</strong>?
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={deleting}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete Enrollment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Enrollments Page ────────────────────────────────────────────────────
export default function EnrollmentsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [enrollments, setEnrollments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  // Modals state
  const [createOpen, setCreateOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Load classes & academic years for filters and modals
  useEffect(() => {
    async function loadMeta() {
      try {
        const [clsRes, ayRes] = await Promise.allSettled([
          api.get('/classes?limit=100'),
          api.get('/academic-years?limit=50'),
        ]);
        if (clsRes.status === 'fulfilled' && clsRes.value.data.success) {
          setClasses(clsRes.value.data.data.classes || clsRes.value.data.data.items || clsRes.value.data.data || []);
        }
        if (ayRes.status === 'fulfilled' && ayRes.value.data.success) {
          setAcademicYears(ayRes.value.data.data.academic_years || ayRes.value.data.data.items || ayRes.value.data.data || []);
        }
      } catch (err) {
        console.error('Failed to load filter metadata:', err);
      }
    }
    loadMeta();
  }, []);

  const fetchEnrollments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 12 });
      if (search) params.set('search', search);
      if (selectedClass) params.set('class_id', selectedClass);
      if (selectedStatus) params.set('status', selectedStatus);

      const { data } = await api.get(`/enrollments?${params}`);
      if (data.success) {
        setEnrollments(data.data.enrollments || data.data.items || data.data || []);
        setPagination(data.data.pagination || {});
      }
    } catch (err) {
      console.error('Failed to load enrollments:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedClass, selectedStatus]);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  const totalPages = pagination.totalPages || 1;
  const totalCount = pagination.total || enrollments.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Banner / Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>Enrollment Management</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 2 }}>
            Manage student registrations, section assignments, transfers, and academic statuses.
          </p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}>
            <PlusCircle size={15} /> New Enrollment
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-input-wrapper" style={{ flex: 1, minWidth: 200 }}>
            <Search size={15} />
            <input
              type="text"
              className="form-input"
              placeholder="Search by student name or ID..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ paddingLeft: 34 }}
            />
          </div>

          <select
            className="form-input"
            value={selectedClass}
            onChange={e => { setSelectedClass(e.target.value); setPage(1); }}
            style={{ minWidth: 160 }}
          >
            <option value="">All Classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.class_name}</option>
            ))}
          </select>

          <select
            className="form-input"
            value={selectedStatus}
            onChange={e => { setSelectedStatus(e.target.value); setPage(1); }}
            style={{ minWidth: 140 }}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="transferred">Transferred</option>
            <option value="withdrawn">Withdrawn</option>
          </select>

          {(search || selectedClass || selectedStatus) && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setSearch(''); setSelectedClass(''); setSelectedStatus(''); setPage(1); }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Table Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : enrollments.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No enrollments found"
            description="No student enrollments match the selected filters."
            actionText={isAdmin ? "Enroll First Student" : undefined}
            onAction={isAdmin ? () => setCreateOpen(true) : undefined}
          />
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Assigned Class</th>
                  <th>Section</th>
                  <th>Academic Session</th>
                  <th>Status</th>
                  <th>Enrollment Date</th>
                  {isAdmin && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {enrollments.map((e, idx) => (
                  <tr key={e.id || idx}>
                    <td>
                      <div>
                        <div className="td-main">
                          {e.student_name || `${e.first_name || ''} ${e.last_name || ''}`.trim() || `Student #${idx + 1}`}
                        </div>
                        {e.admission_number && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Adm: {e.admission_number}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>{e.class_name || '—'}</td>
                    <td><span className="badge badge-slate">{e.section_name || 'Sec A'}</span></td>
                    <td>{e.academic_year_name || '2026–2027'}</td>
                    <td><EnrollmentStatusPill status={e.status || 'active'} /></td>
                    <td>{e.enrollment_date ? new Date(e.enrollment_date).toLocaleDateString() : '—'}</td>
                    {isAdmin && (
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Transfer / Change Section"
                            onClick={() => setTransferTarget(e)}
                            style={{ padding: '4px 8px' }}
                          >
                            <ArrowRightLeft size={13} />
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Change Status"
                            onClick={() => setStatusTarget(e)}
                            style={{ padding: '4px 8px' }}
                          >
                            <UserCheck size={13} />
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Safe Delete / Withdraw"
                            onClick={() => setDeleteTarget(e)}
                            style={{ padding: '4px 8px', color: 'var(--danger)' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderTop: '1px solid var(--border)',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
          }}>
            <span>Showing page {page} of {totalPages} ({totalCount} total)</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateEnrollmentModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={fetchEnrollments}
        classes={classes}
        academicYears={academicYears}
      />

      <TransferModal
        open={!!transferTarget}
        enrollment={transferTarget}
        onClose={() => setTransferTarget(null)}
        onUpdated={fetchEnrollments}
        classes={classes}
      />

      <StatusModal
        open={!!statusTarget}
        enrollment={statusTarget}
        onClose={() => setStatusTarget(null)}
        onUpdated={fetchEnrollments}
      />

      <DeleteModal
        open={!!deleteTarget}
        enrollment={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={fetchEnrollments}
      />
    </div>
  );
}
