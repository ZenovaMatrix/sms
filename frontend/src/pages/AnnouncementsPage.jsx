import { useState, useEffect, useCallback } from 'react';
import {
  Bell, Calendar, Clock, User, Tag, PlusCircle, X, Save,
  AlertTriangle, Megaphone, RefreshCcw, ChevronLeft, ChevronRight, Search,
  Edit2, Trash2, Archive, CheckCircle,
} from 'lucide-react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import EmptyState from '../components/EmptyState';
import { CardSkeleton } from '../components/LoadingSkeleton';

const TARGET_OPTS = [
  { value: 'all', label: 'Everyone (All Users)' },
  { value: 'teachers', label: 'Teachers Only' },
  { value: 'students', label: 'Students Only' },
  { value: 'parents', label: 'Parents Only' },
  { value: 'class', label: 'Specific Class' },
  { value: 'section', label: 'Specific Section' },
];

const STATUS_OPTS = [
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'expired', label: 'Expired / Archived' },
];

const CAT_COLORS = {
  all: 'badge-emerald',
  teachers: 'badge-sky',
  students: 'badge-amber',
  parents: 'badge-slate',
  class: 'badge-violet',
  section: 'badge-violet',
};

// ─── Create / Edit Announcement Modal ───────────────────────────────────────
function AnnouncementFormModal({ open, onClose, onSaved, classes, editData }) {
  const [form, setForm] = useState({
    title: '',
    message: '',
    target_type: 'all',
    class_id: '',
    section_id: '',
    status: 'published',
    publish_date: new Date().toISOString().split('T')[0],
    expiry_date: '',
  });
  const [sections, setSections] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const { success, error: toastError } = useToast();

  useEffect(() => {
    if (open) {
      if (editData) {
        setForm({
          title: editData.title || '',
          message: editData.message || '',
          target_type: editData.target_type || 'all',
          class_id: editData.class_id || '',
          section_id: editData.section_id || '',
          status: editData.status || 'published',
          publish_date: editData.publish_date ? new Date(editData.publish_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          expiry_date: editData.expiry_date ? new Date(editData.expiry_date).toISOString().split('T')[0] : '',
        });
      } else {
        setForm({
          title: '',
          message: '',
          target_type: 'all',
          class_id: '',
          section_id: '',
          status: 'published',
          publish_date: new Date().toISOString().split('T')[0],
          expiry_date: '',
        });
      }
      setErr('');
    }
  }, [open, editData]);

  // Fetch sections when class_id changes
  useEffect(() => {
    if (form.class_id) {
      api.get(`/sections?class_id=${form.class_id}&limit=50`)
        .then(({ data }) => {
          if (data.success) {
            setSections(data.data.sections || data.data.items || data.data || []);
          }
        })
        .catch(() => setSections([]));
    } else {
      setSections([]);
    }
  }, [form.class_id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) { setErr('Title is required.'); return; }
    if (!form.message.trim()) { setErr('Message body is required.'); return; }
    if (form.target_type === 'class' && !form.class_id) {
      setErr('Please select a target class.');
      return;
    }
    if (form.target_type === 'section' && (!form.class_id || !form.section_id)) {
      setErr('Please select both target class and section.');
      return;
    }

    setSaving(true);
    setErr('');
    try {
      const payload = {
        title: form.title.trim(),
        message: form.message.trim(),
        target_type: form.target_type,
        class_id: (form.target_type === 'class' || form.target_type === 'section') && form.class_id ? form.class_id : null,
        section_id: form.target_type === 'section' && form.section_id ? form.section_id : null,
        status: form.status,
        publish_date: form.publish_date || new Date().toISOString().split('T')[0],
        expiry_date: form.expiry_date || null,
      };

      if (editData) {
        const { data } = await api.patch(`/announcements/${editData.id}`, payload);
        if (data.success) {
          success('Announcement updated successfully!');
          onSaved();
          onClose();
        }
      } else {
        const { data } = await api.post('/announcements', payload);
        if (data.success) {
          success('Announcement published successfully!');
          onSaved();
          onClose();
        }
      }
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to save announcement.';
      setErr(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{editData ? 'Edit Announcement' : 'New Announcement'}</h2>
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
              Announcement Title *
            </label>
            <input
              className="form-input"
              placeholder="e.g. Annual Sports Meet, Parent-Teacher Meeting, Exam Schedule..."
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 6 }}>
              Message Body *
            </label>
            <textarea
              className="form-input"
              style={{ resize: 'vertical', minHeight: 110 }}
              placeholder="Write the full announcement message here..."
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 6 }}>
                Target Audience *
              </label>
              <select
                className="form-input"
                value={form.target_type}
                onChange={e => setForm(f => ({ ...f, target_type: e.target.value, class_id: '', section_id: '' }))}
              >
                {TARGET_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 6 }}>
                Status
              </label>
              <select
                className="form-input"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              >
                {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {(form.target_type === 'class' || form.target_type === 'section') && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 6 }}>
                  Target Class *
                </label>
                <select
                  className="form-input"
                  value={form.class_id}
                  onChange={e => setForm(f => ({ ...f, class_id: e.target.value, section_id: '' }))}
                  required
                >
                  <option value="">-- Select Class --</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                </select>
              </div>
              {form.target_type === 'section' && (
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 6 }}>
                    Target Section *
                  </label>
                  <select
                    className="form-input"
                    value={form.section_id}
                    onChange={e => setForm(f => ({ ...f, section_id: e.target.value }))}
                    required
                    disabled={!form.class_id || sections.length === 0}
                  >
                    <option value="">-- Select Section --</option>
                    {sections.map(s => <option key={s.id} value={s.id}>{s.section_name}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 6 }}>
                Publish Date *
              </label>
              <input
                type="date"
                className="form-input"
                value={form.publish_date}
                onChange={e => setForm(f => ({ ...f, publish_date: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 6 }}>
                Expiry Date (Optional)
              </label>
              <input
                type="date"
                className="form-input"
                value={form.expiry_date}
                onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              <Save size={14} /> {saving ? 'Saving...' : editData ? 'Update Announcement' : 'Publish Announcement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Announcement Modal ──────────────────────────────────────────────
function DeleteAnnouncementModal({ open, announcement, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const { success, error: toastError } = useToast();

  async function handleDelete() {
    setDeleting(true);
    try {
      const { data } = await api.delete(`/announcements/${announcement.id}`);
      if (data.success) {
        success('Announcement deleted successfully.');
        onDeleted();
        onClose();
      }
    } catch (e) {
      toastError(e.response?.data?.message || 'Failed to delete announcement.');
    } finally {
      setDeleting(false);
    }
  }

  if (!open || !announcement) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ color: 'var(--danger)' }}>Delete Announcement</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Are you sure you want to permanently delete the announcement <strong>"{announcement.title}"</strong>? This will remove it from all student, teacher, and parent portals.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={deleting}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete Permanently'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Announcement Card ──────────────────────────────────────────────────────
function AnnouncementCard({ item, isAdmin, onEdit, onDelete, onArchive }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = (item.message || '').length > 200;

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, borderLeft: '3px solid var(--primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Bell size={16} />
          </div>
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{item.title}</h4>
            <div style={{ display: 'flex', gap: 12, fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><User size={11} /> {item.creator_name || 'Admin'}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={11} /> {formatDate(item.publish_date)}</span>
              {item.expiry_date && <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--warning)' }}><Calendar size={11} /> Expires: {formatDate(item.expiry_date)}</span>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className={`badge ${CAT_COLORS[item.target_type] || 'badge-slate'}`}><Tag size={10} /> {item.target_type}</span>
          <span className={`badge ${item.status === 'published' ? 'badge-emerald' : item.status === 'draft' ? 'badge-amber' : 'badge-slate'}`}>{item.status}</span>
          {isAdmin && (
            <div style={{ display: 'flex', gap: 4, marginLeft: 6 }}>
              <button
                className="btn btn-secondary btn-sm"
                title="Edit Announcement"
                style={{ padding: '3px 7px' }}
                onClick={() => onEdit(item)}
              >
                <Edit2 size={12} />
              </button>
              {item.status !== 'expired' && (
                <button
                  className="btn btn-secondary btn-sm"
                  title="Archive / Expire"
                  style={{ padding: '3px 7px' }}
                  onClick={() => onArchive(item)}
                >
                  <Archive size={12} />
                </button>
              )}
              <button
                className="btn btn-secondary btn-sm"
                title="Delete Announcement"
                style={{ padding: '3px 7px', color: 'var(--danger)' }}
                onClick={() => onDelete(item)}
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
        {isLong && !expanded ? `${item.message.slice(0, 180)}…` : item.message}
      </p>
      {isLong && (
        <button type="button" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }} onClick={() => setExpanded(v => !v)}>
          {expanded ? 'Show less' : 'Read more →'}
        </button>
      )}
      {(item.class_name || item.section_name) && (
        <div style={{ display: 'flex', gap: 6, fontSize: '0.77rem', color: 'var(--text-muted)' }}>
          {item.class_name && <span>Class: <strong>{item.class_name}</strong></span>}
          {item.section_name && <span>Section: <strong>{item.section_name}</strong></span>}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function AnnouncementsPage() {
  const { user } = useAuth();
  const isAdmin = (user?.role || '').toLowerCase() === 'admin';
  const { success, error: toastError } = useToast();

  const [announcements, setAnnouncements] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 10 });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const { data } = await api.get(`/announcements?${params}`);
      if (data.success) {
        setAnnouncements(data.data.announcements || []);
        const pag = data.data.pagination || {};
        setTotalPages(pag.totalPages || 1);
        setTotal(pag.total || 0);
      }
    } catch (err) {
      console.error('Failed to load announcements:', err);
    } finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);

  // Load classes for the form
  useEffect(() => {
    api.get('/classes?limit=50').then(({ data }) => {
      if (data.success) setClasses(data.data.classes || data.data.items || data.data || []);
    }).catch(() => {});
  }, []);

  function handleSearchSubmit(e) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  async function handleArchive(item) {
    try {
      const { data } = await api.patch(`/announcements/${item.id}`, { status: 'expired' });
      if (data.success) {
        success('Announcement archived.');
        fetchAnnouncements();
      }
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to archive announcement.');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Modals */}
      <AnnouncementFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTarget(null); }}
        onSaved={fetchAnnouncements}
        classes={classes}
        editData={editTarget}
      />

      <DeleteAnnouncementModal
        open={!!deleteTarget}
        announcement={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={fetchAnnouncements}
      />

      {/* Header Card */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>Announcements & Bulletins</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 2 }}>
            Broadcast news, notices, and exam alerts to students, teachers, or parents across portals.
          </p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary btn-sm" onClick={() => { setEditTarget(null); setFormOpen(true); }}>
            <PlusCircle size={15} /> New Announcement
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <form onSubmit={handleSearchSubmit} style={{ flex: 1, minWidth: 220, display: 'flex', gap: 8 }}>
            <div className="search-input-wrapper" style={{ flex: 1 }}>
              <Search size={15} />
              <input
                className="form-input"
                placeholder="Search announcements..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                style={{ paddingLeft: 34 }}
              />
            </div>
            <button type="submit" className="btn btn-secondary btn-sm">Search</button>
          </form>

          <select
            className="form-input"
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            style={{ minWidth: 150 }}
          >
            <option value="">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="expired">Expired / Archived</option>
          </select>

          {(search || statusFilter) && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setSearch(''); setSearchInput(''); setStatusFilter(''); setPage(1); }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <CardSkeleton count={3} />
      ) : announcements.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No announcements found"
          description={search ? "No announcements match your search criteria." : "No announcements have been published yet."}
          actionText={isAdmin ? "Create First Announcement" : undefined}
          onAction={isAdmin ? () => { setEditTarget(null); setFormOpen(true); } : undefined}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {announcements.map(item => (
            <AnnouncementCard
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              onEdit={it => { setEditTarget(it); setFormOpen(true); }}
              onDelete={it => setDeleteTarget(it)}
              onArchive={handleArchive}
            />
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span>Page {page} of {totalPages} ({total} announcements)</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                  <ChevronLeft size={13} /> Prev
                </button>
                <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  Next <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
