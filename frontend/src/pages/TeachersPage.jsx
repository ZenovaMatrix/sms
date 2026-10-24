import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Search,
  UserPlus,
  Mail,
  Phone,
  BookOpen,
  Award,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit2,
  Trash2,
  X,
  LayoutGrid,
  List,
  ArrowUpDown,
  Calendar,
  Building,
  GraduationCap,
  CheckCircle,
  AlertCircle,
  Power,
  Shield,
} from 'lucide-react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import EmptyState from '../components/EmptyState';
import { TableSkeleton, CardSkeleton } from '../components/LoadingSkeleton';

function getInitials(first, last) {
  return `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase() || 'T';
}

function StatusPill({ status }) {
  const map = {
    active: 'badge-emerald',
    inactive: 'badge-red',
    on_leave: 'badge-amber',
    retired: 'badge-slate',
  };
  const labelMap = {
    active: 'Active',
    inactive: 'Inactive / Archived',
    on_leave: 'On Leave',
    retired: 'Retired',
  };
  return (
    <span className={`badge ${map[status] || 'badge-emerald'}`}>
      {labelMap[status] || status || 'Active'}
    </span>
  );
}

export default function TeachersPage() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const isAdmin = (user?.role || '').toLowerCase() === 'admin';

  // Data states
  const [teachers, setTeachers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter / view states
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name'); // 'name' | 'employee_id' | 'department' | 'status'
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  // Modals
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [teacherDetails, setTeacherDetails] = useState(null);
  const [relevantStudents, setRelevantStudents] = useState([]);
  const [detailsTab, setDetailsTab] = useState('overview'); // 'overview' | 'assignments' | 'students'

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalTeacher, setEditModalTeacher] = useState(null);
  const [deleteConfirmTeacher, setDeleteConfirmTeacher] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    department_id: '',
    qualification: '',
    joining_date: new Date().toISOString().slice(0, 10),
    status: 'active',
    password: '',
  });

  // Fetch departments for dropdowns
  useEffect(() => {
    async function loadDepts() {
      try {
        const { data } = await api.get('/departments?limit=50');
        if (data.success) {
          setDepartments(data.data.departments || []);
        }
      } catch (err) {
        console.error('Failed to load departments:', err);
      }
    }
    loadDepts();
  }, []);

  // Fetch teachers
  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 12 });
      if (search) params.set('search', search);

      const { data } = await api.get(`/teachers?${params}`);
      if (data.success) {
        setTeachers(data.data.teachers || []);
        setPagination(data.data.pagination || {});
      }
    } catch (err) {
      console.error('Failed to load teachers:', err);
      toastError(err.response?.data?.message || 'Failed to load teachers.');
    } finally {
      setLoading(false);
    }
  }, [page, search, toastError]);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  // Load detailed profile including assignments and students
  const openTeacherDetails = async (teacher) => {
    setSelectedTeacher(teacher);
    setLoadingDetails(true);
    setDetailsTab('overview');
    setRelevantStudents([]);

    try {
      const { data } = await api.get(`/teachers/${teacher.id}`);
      if (data.success) {
        const detail = data.data;
        setTeacherDetails(detail);

        // If teacher has assigned sections, fetch students from first section
        if (detail.assignments && detail.assignments.length > 0) {
          const firstAssignment = detail.assignments[0];
          const res = await api.get(`/enrollments?class_id=${firstAssignment.class_id}&section_id=${firstAssignment.section_id}&limit=25`);
          if (res.data?.success) {
            setRelevantStudents(res.data.data.enrollments || []);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load teacher details:', err);
      setTeacherDetails(teacher);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Search submit
  function handleSearch(e) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  // Sorting and filtering
  const filteredTeachers = useMemo(() => {
    let list = [...teachers];
    if (statusFilter !== 'all') {
      list = list.filter(t => t.status === statusFilter);
    }

    list.sort((a, b) => {
      let valA = '';
      let valB = '';
      if (sortBy === 'name') {
        valA = `${a.first_name} ${a.last_name}`.toLowerCase();
        valB = `${b.first_name} ${b.last_name}`.toLowerCase();
      } else if (sortBy === 'employee_id') {
        valA = (a.employee_id || '').toLowerCase();
        valB = (b.employee_id || '').toLowerCase();
      } else if (sortBy === 'department') {
        valA = (a.department_name || '').toLowerCase();
        valB = (b.department_name || '').toLowerCase();
      } else if (sortBy === 'status') {
        valA = (a.status || '').toLowerCase();
        valB = (b.status || '').toLowerCase();
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [teachers, statusFilter, sortBy, sortOrder]);

  // Handle Add Teacher
  const handleCreateTeacher = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const payload = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        department_id: formData.department_id || undefined,
        qualification: formData.qualification.trim() || undefined,
        joining_date: formData.joining_date || undefined,
        password: formData.password || undefined,
      };

      const { data } = await api.post('/teachers', payload);
      if (data.success) {
        success('Faculty member added successfully!');
        setAddModalOpen(false);
        setFormData({
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
          department_id: '',
          qualification: '',
          joining_date: new Date().toISOString().slice(0, 10),
          status: 'active',
          password: '',
        });
        fetchTeachers();
      }
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to create teacher.');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (teacher) => {
    setEditModalTeacher(teacher);
    setFormData({
      first_name: teacher.first_name || '',
      last_name: teacher.last_name || '',
      email: teacher.linked_user_email || '',
      phone: teacher.phone || '',
      department_id: teacher.department_id || '',
      qualification: teacher.qualification || '',
      joining_date: teacher.joining_date ? teacher.joining_date.slice(0, 10) : '',
      status: teacher.status || 'active',
      password: '',
    });
  };

  // Handle Update Teacher
  const handleUpdateTeacher = async (e) => {
    e.preventDefault();
    if (!editModalTeacher) return;
    setActionLoading(true);
    try {
      const payload = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        phone: formData.phone.trim() || null,
        department_id: formData.department_id || null,
        qualification: formData.qualification.trim() || null,
        status: formData.status,
      };

      const { data } = await api.patch(`/teachers/${editModalTeacher.id}`, payload);
      if (data.success) {
        success('Teacher details updated successfully.');
        setEditModalTeacher(null);
        fetchTeachers();
        if (selectedTeacher?.id === editModalTeacher.id) {
          openTeacherDetails(data.data);
        }
      }
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to update teacher.');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle active/inactive quick status
  const handleToggleStatus = async (teacher) => {
    const newStatus = teacher.status === 'active' ? 'inactive' : 'active';
    try {
      const { data } = await api.patch(`/teachers/${teacher.id}`, { status: newStatus });
      if (data.success) {
        success(`Teacher status updated to ${newStatus}.`);
        fetchTeachers();
      }
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to update teacher status.');
    }
  };

  // Handle Delete / Archive
  const handleDeleteTeacher = async () => {
    if (!deleteConfirmTeacher) return;
    setActionLoading(true);
    try {
      const { data } = await api.delete(`/teachers/${deleteConfirmTeacher.id}`);
      if (data.success) {
        success(data.message || 'Teacher removed or archived successfully.');
        setDeleteConfirmTeacher(null);
        if (selectedTeacher?.id === deleteConfirmTeacher.id) {
          setSelectedTeacher(null);
        }
        fetchTeachers();
      }
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to delete/archive teacher.');
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = pagination.totalPages || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Metric Header Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Faculty</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>{pagination.total ?? teachers.length}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--secondary-light)', color: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Departments</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>{departments.length || 5}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--success-light)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Faculty</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success)' }}>
              {teachers.filter(t => t.status === 'active').length}
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Filters, Add Button, View Mode */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          {/* Search Form */}
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, flex: 1, minWidth: 260 }}>
            <div className="search-input-wrapper">
              <Search size={16} />
              <input
                className="form-input"
                placeholder="Search teachers by name, employee ID, qualification..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-secondary btn-sm">Search</button>
            {search && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}
              >
                Clear
              </button>
            )}
          </form>

          {/* Right Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Status Filter */}
            <select
              className="form-input"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.82rem' }}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="on_leave">On Leave</option>
              <option value="inactive">Inactive / Archived</option>
            </select>

            {/* Sort Dropdown */}
            <select
              className="form-input"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.82rem' }}
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
            >
              <option value="name">Sort by Name</option>
              <option value="employee_id">Sort by Employee ID</option>
              <option value="department">Sort by Department</option>
              <option value="status">Sort by Status</option>
            </select>

            <button
              type="button"
              className="icon-btn btn-sm"
              title={`Sort order: ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
              onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
            >
              <ArrowUpDown size={15} />
            </button>

            {/* Grid / Table Toggle */}
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <button
                type="button"
                className="icon-btn btn-sm"
                style={{
                  borderRadius: 0,
                  backgroundColor: viewMode === 'table' ? 'var(--primary-light)' : 'transparent',
                  color: viewMode === 'table' ? 'var(--primary)' : 'var(--text-muted)',
                }}
                onClick={() => setViewMode('table')}
                title="Table View"
              >
                <List size={16} />
              </button>
              <button
                type="button"
                className="icon-btn btn-sm"
                style={{
                  borderRadius: 0,
                  backgroundColor: viewMode === 'grid' ? 'var(--primary-light)' : 'transparent',
                  color: viewMode === 'grid' ? 'var(--primary)' : 'var(--text-muted)',
                }}
                onClick={() => setViewMode('grid')}
                title="Grid Cards View"
              >
                <LayoutGrid size={16} />
              </button>
            </div>

            {/* Add Faculty Button (Admin Only) */}
            {isAdmin && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setAddModalOpen(true)}
              >
                <UserPlus size={15} /> Add Faculty
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        viewMode === 'table' ? <TableSkeleton rows={6} cols={7} /> : <CardSkeleton count={6} />
      ) : filteredTeachers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No teachers found"
          description="Try clearing your search or status filters."
          action={isAdmin && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setAddModalOpen(true)}>
              <UserPlus size={15} /> Add Faculty Member
            </button>
          )}
        />
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Faculty Member</th>
                  <th>Employee ID</th>
                  <th>Department</th>
                  <th>Qualification</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map(t => (
                  <tr
                    key={t.id}
                    onClick={() => openTeacherDetails(t)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="avatar">
                          {getInitials(t.first_name, t.last_name)}
                        </div>
                        <div>
                          <div className="td-main">{t.first_name} {t.last_name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {t.linked_user_email || 'teacher@edumanage.com'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>
                        {t.employee_id}
                      </code>
                    </td>
                    <td>
                      <span className="badge badge-slate">{t.department_name || 'Academics'}</span>
                    </td>
                    <td>{t.qualification || 'M.Sc., B.Ed'}</td>
                    <td>
                      <div style={{ fontSize: '0.78rem' }}>{t.phone || '—'}</div>
                    </td>
                    <td>
                      <StatusPill status={t.status} />
                    </td>
                    <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          className="icon-btn btn-sm"
                          title="View Details"
                          onClick={() => openTeacherDetails(t)}
                        >
                          <Eye size={14} />
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              className="icon-btn btn-sm"
                              title="Edit Profile"
                              onClick={() => openEditModal(t)}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn btn-sm"
                              title={t.status === 'active' ? 'Deactivate' : 'Activate'}
                              onClick={() => handleToggleStatus(t)}
                            >
                              <Power size={14} color={t.status === 'active' ? 'var(--warning)' : 'var(--success)'} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn btn-sm"
                              title="Safely Archive / Delete"
                              style={{ color: 'var(--danger)' }}
                              onClick={() => setDeleteConfirmTeacher(t)}
                            >
                              <Trash2 size={14} />
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
              <span>Showing page {page} of {totalPages} ({pagination.total} total)</span>
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
      ) : (
        /* GRID VIEW */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filteredTeachers.map(t => (
            <div
              key={t.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: 18,
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onClick={() => openTeacherDetails(t)}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="avatar avatar-md">
                      {getInitials(t.first_name, t.last_name)}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 800 }}>{t.first_name} {t.last_name}</h4>
                      <code style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>{t.employee_id}</code>
                    </div>
                  </div>
                  <StatusPill status={t.status} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Building size={14} color="var(--primary)" />
                    <span>{t.department_name || 'Academics Department'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Award size={14} color="var(--secondary)" />
                    <span>{t.qualification || 'M.Sc., B.Ed'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Mail size={14} color="var(--text-muted)" />
                    <span style={{ fontSize: '0.75rem' }}>{t.linked_user_email || 'teacher@edumanage.com'}</span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 18,
                  paddingTop: 12,
                  borderTop: '1px solid var(--border)',
                }}
                onClick={e => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => openTeacherDetails(t)}
                >
                  <Eye size={14} /> Details
                </button>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="icon-btn btn-sm"
                      title="Edit"
                      onClick={() => openEditModal(t)}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn btn-sm"
                      title="Delete / Archive"
                      style={{ color: 'var(--danger)' }}
                      onClick={() => setDeleteConfirmTeacher(t)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── MODAL 1: TEACHER DETAILS MODAL ─────────────────────────────────── */}
      {selectedTeacher && (
        <div className="modal-backdrop" onClick={() => setSelectedTeacher(null)}>
          <div className="modal-card" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div className="avatar avatar-lg">
                  {getInitials(selectedTeacher.first_name, selectedTeacher.last_name)}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                      {selectedTeacher.first_name} {selectedTeacher.last_name}
                    </h3>
                    <StatusPill status={selectedTeacher.status} />
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    Employee Code: <strong>{selectedTeacher.employee_id}</strong> • Department: <strong>{selectedTeacher.department_name || 'General'}</strong>
                  </p>
                </div>
              </div>
              <button type="button" className="icon-btn btn-sm" onClick={() => setSelectedTeacher(null)}>
                <X size={16} />
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 20px', gap: 16 }}>
              {[
                { id: 'overview', label: 'Overview & Profile' },
                { id: 'assignments', label: `Teaching Assignments (${teacherDetails?.assignments?.length || 0})` },
                { id: 'students', label: 'Assigned Students' },
              ].map(tb => (
                <button
                  key={tb.id}
                  type="button"
                  style={{
                    padding: '12px 4px',
                    fontSize: '0.82rem',
                    fontWeight: detailsTab === tb.id ? 700 : 500,
                    color: detailsTab === tb.id ? 'var(--primary)' : 'var(--text-muted)',
                    borderBottom: detailsTab === tb.id ? '2px solid var(--primary)' : '2px solid transparent',
                    background: 'none',
                    cursor: 'pointer',
                  }}
                  onClick={() => setDetailsTab(tb.id)}
                >
                  {tb.label}
                </button>
              ))}
            </div>

            <div className="modal-body">
              {loadingDetails ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading teacher profile & assignments...
                </div>
              ) : detailsTab === 'overview' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="card" style={{ padding: 14 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Mail size={12} /> Institutional Email
                    </span>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 4, fontSize: '0.85rem' }}>
                      {teacherDetails?.linked_user_email || 'teacher@edumanage.com'}
                    </p>
                  </div>
                  <div className="card" style={{ padding: 14 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Phone size={12} /> Contact Number
                    </span>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 4, fontSize: '0.85rem' }}>
                      {teacherDetails?.phone || '+1 (555) 019-3829'}
                    </p>
                  </div>
                  <div className="card" style={{ padding: 14 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Building size={12} /> Department
                    </span>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 4, fontSize: '0.85rem' }}>
                      {teacherDetails?.department_name || 'Academics'} ({teacherDetails?.department_code || 'GEN'})
                    </p>
                  </div>
                  <div className="card" style={{ padding: 14 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Award size={12} /> Qualifications
                    </span>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 4, fontSize: '0.85rem' }}>
                      {teacherDetails?.qualification || 'Master of Science'}
                    </p>
                  </div>
                  <div className="card" style={{ padding: 14 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={12} /> Joining Date
                    </span>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 4, fontSize: '0.85rem' }}>
                      {teacherDetails?.joining_date ? new Date(teacherDetails.joining_date).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <div className="card" style={{ padding: 14 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Shield size={12} /> User Account Status
                    </span>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 4, fontSize: '0.85rem' }}>
                      {teacherDetails?.linked_user_status || 'Active Account'}
                    </p>
                  </div>
                </div>
              ) : detailsTab === 'assignments' ? (
                <div>
                  {!teacherDetails?.assignments || teacherDetails.assignments.length === 0 ? (
                    <EmptyState
                      icon={BookOpen}
                      title="No teaching assignments"
                      description="This teacher has not been assigned to any subject, class, or section yet."
                    />
                  ) : (
                    <div className="table-container">
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>Subject</th>
                            <th>Code</th>
                            <th>Class & Section</th>
                            <th>Academic Session</th>
                            <th>Students</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teacherDetails.assignments.map(a => (
                            <tr key={a.assignment_id}>
                              <td><strong>{a.subject_name}</strong></td>
                              <td><code>{a.subject_code}</code></td>
                              <td><span className="badge badge-emerald">{a.class_name} • Sec {a.section_name}</span></td>
                              <td>{a.year_name}</td>
                              <td><span className="badge badge-slate">{a.enrolled_students_count || 0} students</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {relevantStudents.length === 0 ? (
                    <EmptyState
                      icon={GraduationCap}
                      title="No students enrolled yet"
                      description="No active student enrollments found in this teacher's assigned sections."
                    />
                  ) : (
                    <div className="table-container">
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>Student</th>
                            <th>Class</th>
                            <th>Section</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {relevantStudents.map(st => (
                            <tr key={st.id}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div className="avatar avatar-sm">
                                    {getInitials(st.first_name, st.last_name)}
                                  </div>
                                  <div>
                                    <div className="td-main">{st.student_name || `${st.first_name} ${st.last_name}`}</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{st.email || 'student@edumanage.com'}</div>
                                  </div>
                                </div>
                              </td>
                              <td>{st.class_name}</td>
                              <td>{st.section_name}</td>
                              <td><span className="badge badge-emerald">{st.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                {isAdmin && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      const t = selectedTeacher;
                      setSelectedTeacher(null);
                      openEditModal(t);
                    }}
                  >
                    <Edit2 size={14} /> Edit Profile
                  </button>
                )}
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedTeacher(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: ADD TEACHER MODAL ──────────────────────────────────────── */}
      {addModalOpen && (
        <div className="modal-backdrop" onClick={() => !actionLoading && setAddModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <UserPlus size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Add New Faculty Member</h3>
              </div>
              <button type="button" className="icon-btn btn-sm" onClick={() => setAddModalOpen(false)}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateTeacher}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">First Name *</label>
                    <input
                      required
                      className="form-input"
                      placeholder="e.g. Meera"
                      value={formData.first_name}
                      onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name *</label>
                    <input
                      required
                      className="form-input"
                      placeholder="e.g. Joshi"
                      value={formData.last_name}
                      onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Email Address *</label>
                    <input
                      required
                      type="email"
                      className="form-input"
                      placeholder="meera@edumanage.com"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input
                      className="form-input"
                      placeholder="+1 (555) 019-2834"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <select
                      className="form-input"
                      value={formData.department_id}
                      onChange={e => setFormData({ ...formData, department_id: e.target.value })}
                    >
                      <option value="">Select Department...</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.department_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Qualification</label>
                    <input
                      className="form-input"
                      placeholder="e.g. M.Sc. Mathematics, B.Ed"
                      value={formData.qualification}
                      onChange={e => setFormData({ ...formData, qualification: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Joining Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.joining_date}
                      onChange={e => setFormData({ ...formData, joining_date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Initial Password</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Leave empty for auto-generated"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={actionLoading}
                  onClick={() => setAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Creating Teacher...' : 'Create Teacher Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: EDIT TEACHER MODAL ─────────────────────────────────────── */}
      {editModalTeacher && (
        <div className="modal-backdrop" onClick={() => !actionLoading && setEditModalTeacher(null)}>
          <div className="modal-card" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Edit Faculty Member</h3>
              <button type="button" className="icon-btn btn-sm" onClick={() => setEditModalTeacher(null)}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleUpdateTeacher}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">First Name *</label>
                    <input
                      required
                      className="form-input"
                      value={formData.first_name}
                      onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name *</label>
                    <input
                      required
                      className="form-input"
                      value={formData.last_name}
                      onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      className="form-input"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <select
                      className="form-input"
                      value={formData.department_id}
                      onChange={e => setFormData({ ...formData, department_id: e.target.value })}
                    >
                      <option value="">Select Department...</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.department_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Qualification</label>
                    <input
                      className="form-input"
                      value={formData.qualification}
                      onChange={e => setFormData({ ...formData, qualification: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Employment Status</label>
                    <select
                      className="form-input"
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="active">Active</option>
                      <option value="on_leave">On Leave</option>
                      <option value="inactive">Inactive / Archived</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={actionLoading}
                  onClick={() => setEditModalTeacher(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 4: DELETE / ARCHIVE CONFIRMATION MODAL ─────────────────────── */}
      {deleteConfirmTeacher && (
        <div className="modal-backdrop" onClick={() => !actionLoading && setDeleteConfirmTeacher(null)}>
          <div className="modal-card" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--danger)' }}>
                <AlertCircle size={20} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Safely Remove / Archive Teacher</h3>
              </div>
              <button type="button" className="icon-btn btn-sm" onClick={() => setDeleteConfirmTeacher(null)}>
                <X size={15} />
              </button>
            </div>

            <div className="modal-body" style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
              <p>
                Are you sure you want to remove <strong>{deleteConfirmTeacher.first_name} {deleteConfirmTeacher.last_name}</strong> ({deleteConfirmTeacher.employee_id})?
              </p>
              <div style={{
                marginTop: 12,
                padding: '10px 14px',
                backgroundColor: 'var(--bg-muted)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
              }}>
                ℹ️ <strong>Safe Architecture Rule:</strong> If this teacher has active subject or class assignments, their record will be <em>safely archived and deactivated</em> to preserve student attendance and exam grade history.
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={actionLoading}
                onClick={() => setDeleteConfirmTeacher(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={actionLoading}
                onClick={handleDeleteTeacher}
              >
                {actionLoading ? 'Processing...' : 'Confirm Remove / Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
