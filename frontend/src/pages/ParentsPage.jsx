import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Search,
  Mail,
  Phone,
  Briefcase,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Eye,
  PlusCircle,
  Edit2,
  Trash2,
  Link,
  Unlink,
  X,
  UserCheck,
  UserX,
  CheckCircle,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  GraduationCap,
  Layers,
  RefreshCw,
  Heart,
  Key,
  Copy,
} from 'lucide-react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import EmptyState from '../components/EmptyState';
import { TableSkeleton } from '../components/LoadingSkeleton';

function getInitials(name) {
  if (!name) return 'P';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

export default function ParentsPage() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const isAdmin = user?.role === 'admin';

  // Master dropdown data for Class → Section → Student filter
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);

  // Filter states
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Table Data & Pagination
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [linkStudentModalOpen, setLinkStudentModalOpen] = useState(false);
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);

  // Selected item states
  const [selectedParent, setSelectedParent] = useState(null);
  const [newCredentials, setNewCredentials] = useState(null);

  // ─── 1. Load Classes on Mount ──────────────────────────────────────────────
  useEffect(() => {
    async function loadClasses() {
      try {
        const res = await api.get('/classes?limit=50');
        if (res.data?.success) {
          const list = res.data.data?.classes || res.data.data || [];
          setClasses(Array.isArray(list) ? list : []);
        }
      } catch (err) {
        console.error('Failed to load classes:', err);
      }
    }
    loadClasses();
  }, []);

  // ─── 2. Dependent Sections ──────────────────────────────────────────────────
  useEffect(() => {
    async function loadSections() {
      if (!selectedClass) {
        setSections([]);
        setSelectedSection('');
        return;
      }
      try {
        const res = await api.get(`/sections?class_id=${selectedClass}&limit=50`);
        if (res.data?.success) {
          const secs = res.data.data?.sections || res.data.data || [];
          setSections(Array.isArray(secs) ? secs : []);
        }
      } catch (err) {
        console.error('Failed to load sections:', err);
        setSections([]);
      }
    }
    loadSections();
  }, [selectedClass]);

  // ─── 3. Dependent Students ──────────────────────────────────────────────────
  useEffect(() => {
    async function loadStudents() {
      if (!selectedClass) {
        setStudents([]);
        setSelectedStudent('');
        return;
      }
      try {
        const params = new URLSearchParams({ class_id: selectedClass, limit: 100 });
        if (selectedSection) params.set('section_id', selectedSection);

        const res = await api.get(`/enrollments?${params}`);
        if (res.data?.success) {
          const enrollments = res.data.data?.enrollments || [];
          const studs = enrollments.map(e => ({
            id: e.student_id,
            name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Student',
            admission_id: e.student_id_number || e.admission_id || '',
          }));
          setStudents(studs);
        }
      } catch (err) {
        console.error('Failed to load students:', err);
        setStudents([]);
      }
    }
    loadStudents();
  }, [selectedClass, selectedSection]);

  // ─── 4. Fetch Parents List ──────────────────────────────────────────────────
  const fetchParents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 12 });
      if (search) params.set('search', search);
      if (selectedClass) params.set('class_id', selectedClass);
      if (selectedSection) params.set('section_id', selectedSection);
      if (selectedStudent) params.set('student_id', selectedStudent);

      const { data } = await api.get(`/parents?${params}`);
      if (data.success) {
        setParents(data.data.parents || []);
        setPagination(data.data.pagination || {});
      }
    } catch (err) {
      console.error('Failed to load parents:', err);
      setParents([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedClass, selectedSection, selectedStudent]);

  useEffect(() => {
    fetchParents();
  }, [fetchParents]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  function handleResetFilters() {
    setSelectedClass('');
    setSelectedSection('');
    setSelectedStudent('');
    setSearch('');
    setSearchInput('');
    setPage(1);
  }

  // Row / card click opens parent detail view
  function handleOpenDetail(parent) {
    setSelectedParent(parent);
    setDetailModalOpen(true);
  }

  // Open Edit Modal
  function handleOpenEdit(parent, e) {
    if (e) e.stopPropagation();
    setSelectedParent(parent);
    setEditModalOpen(true);
  }

  // Open Link Student Modal
  function handleOpenLinkStudent(parent, e) {
    if (e) e.stopPropagation();
    setSelectedParent(parent);
    setLinkStudentModalOpen(true);
  }

  // Toggle account active / inactive status
  async function handleToggleStatus(parent, e) {
    if (e) e.stopPropagation();
    const newStatus = parent.linked_user_status === 'inactive' ? 'active' : 'inactive';
    const confirmMsg =
      newStatus === 'inactive'
        ? `Are you sure you want to deactivate ${parent.full_name}'s portal account? Their relationship history will remain preserved.`
        : `Re-activate ${parent.full_name}'s account?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await api.patch(`/parents/${parent.id}`, { status: newStatus });
      if (res.data?.success) {
        success(`Parent account ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully.`);
        fetchParents();
        if (selectedParent?.id === parent.id) {
          setSelectedParent(prev => ({ ...prev, linked_user_status: newStatus }));
        }
      } else {
        toastError(res.data?.message || 'Status update failed.');
      }
    } catch (err) {
      toastError(err.response?.data?.message || err.message || 'Failed to update account status.');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={28} style={{ color: 'var(--primary)' }} />
            Parents & Guardians Management
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Manage parent directory, verified guardian-student links, contact profiles, and portal accounts.
          </p>
        </div>

        {isAdmin && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setCreateModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <PlusCircle size={16} /> Register Parent
          </button>
        )}
      </div>

      {/* ── Class → Section → Student Hierarchical Filter Bar ── */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', flex: 1 }}>
            {/* Class */}
            <div style={{ minWidth: 150 }}>
              <select
                className="form-select"
                value={selectedClass}
                onChange={e => {
                  setSelectedClass(e.target.value);
                  setSelectedSection('');
                  setSelectedStudent('');
                  setPage(1);
                }}
              >
                <option value="">All Classes</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.class_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Section */}
            <div style={{ minWidth: 140 }}>
              <select
                className="form-select"
                value={selectedSection}
                disabled={!selectedClass}
                onChange={e => {
                  setSelectedSection(e.target.value);
                  setSelectedStudent('');
                  setPage(1);
                }}
              >
                <option value="">All Sections</option>
                {sections.map(s => (
                  <option key={s.id} value={s.id}>
                    Section {s.section_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Student */}
            <div style={{ minWidth: 180 }}>
              <select
                className="form-select"
                value={selectedStudent}
                disabled={!selectedClass}
                onChange={e => {
                  setSelectedStudent(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Filter by Child / Student...</option>
                {students.map(st => (
                  <option key={st.id} value={st.id}>
                    {st.name} {st.admission_id ? `(${st.admission_id})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 6, minWidth: 220, flex: 1 }}>
              <div className="search-input-wrapper" style={{ flex: 1 }}>
                <Search size={15} />
                <input
                  className="form-input"
                  placeholder="Search parent by name, phone, email, or occupation..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-secondary btn-sm">
                Search
              </button>
            </form>
          </div>

          {(selectedClass || selectedSection || selectedStudent || search) && (
            <button
              className="btn btn-outline btn-sm"
              onClick={handleResetFilters}
              style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
            >
              <RefreshCw size={13} /> Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* ── Parents Table ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : parents.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No parents found"
            description="No parent records match your query. Try broadening your filters or click 'Register Parent' to add one."
          />
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Parent / Guardian Name</th>
                  <th>Contact Details</th>
                  <th>Occupation</th>
                  <th>Residential Address</th>
                  <th style={{ textAlign: 'center' }}>Linked Children</th>
                  <th style={{ textAlign: 'center' }}>Portal Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {parents.map(parent => (
                  <tr
                    key={parent.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleOpenDetail(parent)}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: 'var(--primary-light)',
                            color: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            flexShrink: 0,
                          }}
                        >
                          {getInitials(parent.full_name)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {parent.full_name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            User ID: {parent.user_id ? `${parent.user_id.slice(0, 8)}...` : 'N/A'}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {parent.email && (
                          <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <Mail size={13} style={{ color: 'var(--text-muted)' }} /> {parent.email}
                          </span>
                        )}
                        {parent.phone && (
                          <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <Phone size={13} style={{ color: 'var(--text-muted)' }} /> {parent.phone}
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {parent.occupation || '—'}
                      </span>
                    </td>

                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                      {parent.address || '—'}
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-sky" style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <GraduationCap size={13} /> {parent.linked_children_count || 0} Child(ren)
                      </span>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      {parent.linked_user_status === 'inactive' ? (
                        <span className="badge badge-red" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <UserX size={12} /> Inactive
                        </span>
                      ) : (
                        <span className="badge badge-emerald" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <UserCheck size={12} /> Active
                        </span>
                      )}
                    </td>

                    <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          className="btn btn-secondary btn-xs"
                          onClick={() => handleOpenDetail(parent)}
                          title="View Profile & Linked Students"
                        >
                          <Eye size={13} /> View
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              className="btn btn-outline btn-xs"
                              onClick={e => handleOpenLinkStudent(parent, e)}
                              title="Link Student"
                            >
                              <Link size={13} /> Link
                            </button>
                            <button
                              className="btn btn-outline btn-xs"
                              onClick={e => handleOpenEdit(parent, e)}
                              title="Edit Profile"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              className={`btn btn-xs ${parent.linked_user_status === 'inactive' ? 'btn-secondary' : 'btn-ghost'}`}
                              style={{ color: parent.linked_user_status === 'inactive' ? 'var(--success)' : 'var(--danger)' }}
                              onClick={e => handleToggleStatus(parent, e)}
                              title={parent.linked_user_status === 'inactive' ? 'Activate Account' : 'Deactivate Account'}
                            >
                              {parent.linked_user_status === 'inactive' ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination Footer ── */}
      {pagination.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
            Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total parents)
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn btn-outline btn-sm"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <button
              className="btn btn-outline btn-sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── MODALS ── */}
      {/* 1. Register Parent Modal */}
      {createModalOpen && (
        <CreateParentModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={credentials => {
            setCreateModalOpen(false);
            fetchParents();
            if (credentials) {
              setNewCredentials(credentials);
              setCredentialsModalOpen(true);
            } else {
              success('Parent registered successfully.');
            }
          }}
        />
      )}

      {/* 2. New Account Credentials Dialog */}
      {credentialsModalOpen && newCredentials && (
        <CredentialsDisplayModal
          open={credentialsModalOpen}
          credentials={newCredentials}
          onClose={() => {
            setCredentialsModalOpen(false);
            setNewCredentials(null);
          }}
        />
      )}

      {/* 3. Edit Parent Profile Modal */}
      {editModalOpen && selectedParent && (
        <EditParentModal
          open={editModalOpen}
          parent={selectedParent}
          onClose={() => {
            setEditModalOpen(false);
            setSelectedParent(null);
          }}
          onSuccess={() => {
            setEditModalOpen(false);
            setSelectedParent(null);
            fetchParents();
            success('Parent profile updated successfully.');
          }}
        />
      )}

      {/* 4. Link Student to Parent Modal */}
      {linkStudentModalOpen && selectedParent && (
        <LinkStudentModal
          open={linkStudentModalOpen}
          parent={selectedParent}
          onClose={() => {
            setLinkStudentModalOpen(false);
            setSelectedParent(null);
          }}
          onSuccess={() => {
            setLinkStudentModalOpen(false);
            setSelectedParent(null);
            fetchParents();
            success('Student linked to parent successfully.');
          }}
        />
      )}

      {/* 5. Parent Details & Linked Children Modal */}
      {detailModalOpen && selectedParent && (
        <ParentDetailModal
          open={detailModalOpen}
          parent={selectedParent}
          isAdmin={isAdmin}
          onClose={() => {
            setDetailModalOpen(false);
            setSelectedParent(null);
          }}
          onLinkStudent={() => {
            setDetailModalOpen(false);
            setLinkStudentModalOpen(true);
          }}
          onRefreshList={fetchParents}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Register Parent Modal
// ─────────────────────────────────────────────────────────────────────────────
function CreateParentModal({ open, onClose, onSuccess }) {
  const { error: toastError } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [occupation, setOccupation] = useState('');
  const [address, setAddress] = useState('');
  const [customPassword, setCustomPassword] = useState('Password@123');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      toastError('Full name and email address are required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
        occupation: occupation.trim() || null,
        address: address.trim() || null,
        password: customPassword.trim() || 'Password@123',
      };

      const res = await api.post('/parents', payload);
      if (res.data?.success) {
        onSuccess({
          email: payload.email,
          password: payload.password,
          name: payload.full_name,
        });
      } else {
        toastError(res.data?.message || 'Failed to create parent account.');
      }
    } catch (err) {
      toastError(err.response?.data?.message || err.message || 'Parent registration failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={20} style={{ color: 'var(--primary)' }} />
            Register Parent & Guardian
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Creates a parent profile and an authenticated user login account atomically.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              className="form-input"
              placeholder="e.g. Ramesh Kumar"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input
                type="email"
                className="form-input"
                placeholder="ramesh@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                className="form-input"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Occupation / Profession</label>
            <input
              className="form-input"
              placeholder="e.g. Software Engineer, Doctor, Business"
              value={occupation}
              onChange={e => setOccupation(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Residential Address</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="Flat / House No, Street, City, Pincode"
              value={address}
              onChange={e => setAddress(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Initial Account Password *</label>
            <input
              type="text"
              className="form-input"
              value={customPassword}
              onChange={e => setCustomPassword(e.target.value)}
              required
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              The parent can use this password to sign in to EduManage.
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
              {submitting ? 'Registering...' : 'Register Parent Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Credentials Display Modal (Shown Once after Creation)
// ─────────────────────────────────────────────────────────────────────────────
function CredentialsDisplayModal({ open, credentials, onClose }) {
  const { success } = useToast();

  function copyCredentials() {
    const text = `EduManage Portal Login:\nEmail: ${credentials.email}\nPassword: ${credentials.password}`;
    navigator.clipboard.writeText(text);
    success('Login credentials copied to clipboard.');
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle size={20} /> Parent Account Created
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Please share these login credentials securely with <strong>{credentials.name}</strong>.
        </p>

        <div style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Login Email:</span>
            <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{credentials.email}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Temporary Password:</span>
            <strong style={{ fontFamily: 'monospace', fontSize: '0.95rem', color: 'var(--primary)' }}>
              {credentials.password}
            </strong>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <button className="btn btn-outline btn-sm" onClick={copyCredentials} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Copy size={14} /> Copy Details
          </button>
          <button className="btn btn-primary btn-sm" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Edit Parent Profile Modal
// ─────────────────────────────────────────────────────────────────────────────
function EditParentModal({ open, parent, onClose, onSuccess }) {
  const { error: toastError } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [fullName, setFullName] = useState(parent.full_name || '');
  const [email, setEmail] = useState(parent.email || '');
  const [phone, setPhone] = useState(parent.phone || '');
  const [occupation, setOccupation] = useState(parent.occupation || '');
  const [address, setAddress] = useState(parent.address || '');

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        full_name: fullName.trim() || undefined,
        email: email.trim() || null,
        phone: phone.trim() || null,
        occupation: occupation.trim() || null,
        address: address.trim() || null,
      };

      const res = await api.patch(`/parents/${parent.id}`, payload);
      if (res.data?.success) onSuccess();
      else toastError(res.data?.message || 'Update failed.');
    } catch (err) {
      toastError(err.response?.data?.message || err.message || 'Failed to update parent profile.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Edit2 size={20} style={{ color: 'var(--primary)' }} />
            Edit Parent Profile
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              className="form-input"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                className="form-input"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Occupation</label>
            <input
              className="form-input"
              value={occupation}
              onChange={e => setOccupation(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Residential Address</label>
            <textarea
              className="form-input"
              rows={2}
              value={address}
              onChange={e => setAddress(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Link Student to Parent Modal
// ─────────────────────────────────────────────────────────────────────────────
function LinkStudentModal({ open, parent, onClose, onSuccess }) {
  const { error: toastError } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [allStudents, setAllStudents] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [relationship, setRelationship] = useState('father');
  const [isPrimary, setIsPrimary] = useState(true);
  const [isEmergency, setIsEmergency] = useState(false);
  const [searchStudent, setSearchStudent] = useState('');

  useEffect(() => {
    async function loadStudents() {
      try {
        const res = await api.get('/students?limit=100');
        if (res.data?.success) {
          const list = res.data.data?.students || res.data.data || [];
          setAllStudents(list);
          if (list[0]) setStudentId(list[0].id);
        }
      } catch (err) {
        console.error('Failed to load students:', err);
      }
    }
    loadStudents();
  }, []);

  const filteredStudents = useMemo(() => {
    if (!searchStudent.trim()) return allStudents;
    const q = searchStudent.toLowerCase();
    return allStudents.filter(
      s =>
        `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase().includes(q) ||
        (s.student_id && s.student_id.toLowerCase().includes(q))
    );
  }, [allStudents, searchStudent]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!studentId) {
      toastError('Please select a student.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        relationship,
        is_primary_contact: isPrimary ? 1 : 0,
        is_emergency_contact: isEmergency ? 1 : 0,
      };

      const res = await api.post(`/parents/${parent.id}/students/${studentId}`, payload);
      if (res.data?.success) onSuccess();
      else toastError(res.data?.message || 'Failed to link student.');
    } catch (err) {
      toastError(err.response?.data?.message || err.message || 'Link failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link size={20} style={{ color: 'var(--primary)' }} />
            Link Child / Student to Guardian
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-muted)', marginBottom: 14, fontSize: '0.85rem' }}>
          Parent: <strong>{parent.full_name}</strong> ({parent.email || parent.phone || 'No contact'})
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Find Student *</label>
            <input
              className="form-input"
              placeholder="Filter student list..."
              value={searchStudent}
              onChange={e => setSearchStudent(e.target.value)}
              style={{ marginBottom: 6 }}
            />
            <select
              className="form-select"
              value={studentId}
              onChange={e => setStudentId(e.target.value)}
              required
              size={5}
              style={{ height: 120 }}
            >
              {filteredStudents.map(st => (
                <option key={st.id} value={st.id}>
                  {st.first_name} {st.last_name} {st.student_id ? `(${st.student_id})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Relationship to Student *</label>
            <select
              className="form-select"
              value={relationship}
              onChange={e => setRelationship(e.target.value)}
              required
            >
              <option value="father">Father</option>
              <option value="mother">Mother</option>
              <option value="guardian">Legal Guardian</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 20, marginTop: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={e => setIsPrimary(e.target.checked)}
              />
              Primary Contact
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isEmergency}
                onChange={e => setIsEmergency(e.target.checked)}
              />
              Emergency Contact
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
              {submitting ? 'Linking...' : 'Confirm Relationship Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Parent Details & Linked Children Modal
// ─────────────────────────────────────────────────────────────────────────────
function ParentDetailModal({ open, parent, isAdmin, onClose, onLinkStudent, onRefreshList }) {
  const { success, error: toastError } = useToast();
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchChildren = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/parents/${parent.id}/students`);
      if (res.data?.success) {
        setChildren(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load linked students:', err);
    } finally {
      setLoading(false);
    }
  }, [parent.id]);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  // Safe Unlink relationship
  async function handleUnlink(studentId, studentName) {
    if (!window.confirm(`Are you sure you want to unlink ${studentName} from ${parent.full_name}? The student's academic and financial records will remain completely intact.`)) {
      return;
    }

    try {
      const res = await api.delete(`/parents/${parent.id}/students/${studentId}`);
      if (res.data?.success) {
        success(`${studentName} unlinked successfully.`);
        fetchChildren();
        onRefreshList();
      } else {
        toastError(res.data?.message || 'Unlink failed.');
      }
    } catch (err) {
      toastError(err.response?.data?.message || err.message || 'Failed to unlink relationship.');
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 660, padding: 24 }} onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.1rem',
              }}
            >
              {getInitials(parent.full_name)}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  {parent.full_name}
                </h2>
                {parent.linked_user_status === 'inactive' ? (
                  <span className="badge badge-red">Inactive</span>
                ) : (
                  <span className="badge badge-emerald">Active Portal</span>
                )}
              </div>
              <p style={{ margin: '3px 0 0', color: 'var(--text-secondary)', fontSize: '0.825rem' }}>
                {parent.occupation || 'Guardian'} · {parent.email || 'No email provided'}
              </p>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Profile Card Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-muted)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Phone Number
            </span>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
              {parent.phone || 'Not available'}
            </div>
          </div>

          <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-muted)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Linked Children
            </span>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)', marginTop: 2 }}>
              {children.length} Enrolled Student(s)
            </div>
          </div>

          <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-muted)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Residential City
            </span>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {parent.address ? parent.address.split(',')[0] : 'Not specified'}
            </div>
          </div>
        </div>

        {/* Linked Children Section */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <GraduationCap size={18} style={{ color: 'var(--primary)' }} />
              Verified Linked Children & Enrollment Status
            </h3>
            {isAdmin && (
              <button className="btn btn-secondary btn-xs" onClick={onLinkStudent} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Link size={13} /> Link Another Child
              </button>
            )}
          </div>

          {loading ? (
            <TableSkeleton rows={3} cols={4} />
          ) : children.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              No children are currently linked to this parent profile.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {children.map(child => (
                <div
                  key={child.student_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-surface)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: 'var(--primary-subtle)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                      }}
                    >
                      {child.first_name?.[0] || 'S'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {child.first_name} {child.last_name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {child.class_name ? `${child.class_name}` : 'Class'} {child.section_name ? `· Sec ${child.section_name}` : ''}
                        {child.student_admission_id ? ` · ID: ${child.student_admission_id}` : ''}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      <span className="badge badge-subtle" style={{ textTransform: 'capitalize', fontSize: '0.75rem' }}>
                        {child.relationship || 'Guardian'}
                      </span>
                      {child.is_primary_contact === 1 && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--success)', fontWeight: 600 }}>
                          Primary Contact
                        </span>
                      )}
                    </div>

                    {isAdmin && (
                      <button
                        className="btn btn-ghost btn-xs"
                        style={{ color: 'var(--danger)', padding: 6 }}
                        onClick={() => handleUnlink(child.student_id, `${child.first_name} ${child.last_name}`)}
                        title="Unlink Relationship"
                      >
                        <Unlink size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-outline btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
