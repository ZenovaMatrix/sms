import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  UserPlus,
  Download,
  Filter,
  Eye,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Users,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import api from '../api/api';
import AddStudentModal from '../components/AddStudentModal';
import StudentProfileModal from '../components/StudentProfileModal';
import EmptyState from '../components/EmptyState';
import { TableSkeleton } from '../components/LoadingSkeleton';

function getInitials(first, last) {
  return `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase() || 'S';
}

function StatusPill({ status }) {
  const map = {
    active: 'badge-emerald',
    inactive: 'badge-red',
    graduated: 'badge-sky',
    suspended: 'badge-amber',
    transferred: 'badge-slate',
  };
  return <span className={`badge ${map[status] || 'badge-emerald'}`}>{status || 'active'}</span>;
}

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 12 });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);

      const { data } = await api.get(`/students?${params}`);
      if (data.success) {
        setStudents(data.data.students || []);
        setPagination(data.data.pagination || {});
      }
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  function handleOpenProfile(student) {
    setSelectedStudent(student);
    setIsProfileOpen(true);
  }

  const totalPages = pagination.totalPages || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Metric Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GraduationCap size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Students</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>{pagination.total ?? 2486}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--success-light)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Enrollments</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>2,412</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--secondary-light)', color: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>New Admissions</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>184</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Attendance Alert</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>18</div>
          </div>
        </div>
      </div>

      {/* Filter & Action Bar */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 10, flex: 1, minWidth: 260 }}>
            <div className="search-input-wrapper">
              <Search size={16} />
              <input
                className="form-input"
                placeholder="Search by student name, ID or email..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-secondary btn-sm">Search</button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <select
              className="form-select"
              style={{ width: 140 }}
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="graduated">Graduated</option>
              <option value="suspended">Suspended</option>
            </select>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setIsAddOpen(true)}
            >
              <UserPlus size={15} /> Add Student
            </button>
          </div>
        </div>
      </div>

      {/* Students Data Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : students.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No students found"
            description="No student records matched your search filters. You can clear your filters or register a new student."
            actionLabel="+ Register Student"
            onAction={() => setIsAddOpen(true)}
          />
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Student Info</th>
                  <th>Student ID</th>
                  <th>Class / Section</th>
                  <th>Gender</th>
                  <th>Status</th>
                  <th>Admission Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => {
                  const studentId = s.student_id || s.id?.substring(0, 8);
                  return (
                    <tr key={s.id} onClick={() => handleOpenProfile(s)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div className="avatar">
                            {getInitials(s.first_name, s.last_name)}
                          </div>
                          <div>
                            <div className="td-main">{s.first_name} {s.last_name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <code style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>
                          {studentId}
                        </code>
                      </td>
                      <td>
                        <span className="badge badge-slate">Grade 10 - A</span>
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>{s.gender || '—'}</td>
                      <td><StatusPill status={s.status} /></td>
                      <td>{s.enrollment_date ? new Date(s.enrollment_date).toLocaleDateString() : '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="icon-btn btn-sm"
                          style={{ width: 30, height: 30, display: 'inline-flex' }}
                          onClick={e => {
                            e.stopPropagation();
                            handleOpenProfile(s);
                          }}
                          title="View Profile"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
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
            <span>Showing page {page} of {totalPages}</span>
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

      {/* Profile & Add Modals */}
      <StudentProfileModal
        student={selectedStudent}
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      <AddStudentModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onCreated={fetchStudents}
      />
    </div>
  );
}
