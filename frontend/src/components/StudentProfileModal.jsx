import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  User,
  GraduationCap,
  CalendarCheck,
  CreditCard,
  Award,
  Users,
  Mail,
  Phone,
  MapPin,
  Heart,
  Calendar,
  CheckCircle,
} from 'lucide-react';

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

export default function StudentProfileModal({ student, isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!isOpen || !student) return null;

  const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student Profile';
  const studentId = student.student_id || student.id?.substring(0, 8) || 'STU-2026-001';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div
        className="modal-card"
        style={{ maxWidth: 780 }}
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
      >
        {/* Profile Header */}
        <div style={{
          padding: '24px 28px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          background: 'linear-gradient(135deg, var(--primary-light), var(--bg-surface))',
        }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div className="avatar avatar-lg">
              {getInitials(student.first_name, student.last_name)}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{fullName}</h3>
                <StatusPill status={student.status} />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <code style={{ color: 'var(--primary)', fontWeight: 600 }}>{studentId}</code>
                <span>•</span>
                <span>Class 10 - Section A</span>
                <span>•</span>
                <span>Roll #14</span>
              </div>
            </div>
          </div>
          <button type="button" className="icon-btn btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{ padding: '0 24px', borderBottom: '1px solid var(--border)' }}>
          <div className="tabs-nav" style={{ marginBottom: 0 }}>
            {[
              { id: 'overview', label: 'Overview', icon: User },
              { id: 'academic', label: 'Academic', icon: GraduationCap },
              { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
              { id: 'fees', label: 'Fee Records', icon: CreditCard },
              { id: 'exams', label: 'Exams & Grades', icon: Award },
            ].map(tab => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <TabIcon size={15} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Body */}
        <div className="modal-body" style={{ maxHeight: 420, overflowY: 'auto' }}>
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 12 }}>
                  Personal Information
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                  <div className="card" style={{ padding: 14 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Mail size={12} /> Email Address
                    </span>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2, fontSize: '0.82rem' }}>
                      {student.email || 'aarav.patel@school.edu'}
                    </p>
                  </div>
                  <div className="card" style={{ padding: 14 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Phone size={12} /> Phone
                    </span>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2, fontSize: '0.82rem' }}>
                      {student.phone || '+1 (555) 019-4829'}
                    </p>
                  </div>
                  <div className="card" style={{ padding: 14 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={12} /> Date of Birth
                    </span>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2, fontSize: '0.82rem' }}>
                      {student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : '14 May 2011'}
                    </p>
                  </div>
                  <div className="card" style={{ padding: 14 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Heart size={12} /> Blood Group
                    </span>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2, fontSize: '0.82rem' }}>
                      {student.blood_group || 'O+ Positive'}
                    </p>
                  </div>
                  <div className="card" style={{ padding: 14 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CalendarCheck size={12} /> Enrolled Date
                    </span>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2, fontSize: '0.82rem' }}>
                      {student.enrollment_date ? new Date(student.enrollment_date).toLocaleDateString() : '01 Aug 2024'}
                    </p>
                  </div>
                  <div className="card" style={{ padding: 14 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={12} /> Residential Address
                    </span>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2, fontSize: '0.82rem' }}>
                      {student.address || '742 Evergreen Terrace, Springfield'}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 12 }}>
                  Guardian & Emergency Contact
                </h4>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'var(--secondary-light)', color: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Users size={18} />
                    </div>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>Mr. Rajesh Patel</span>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Father • Primary Contact</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>
                    <div style={{ fontWeight: 600 }}>+1 (555) 912-3847</div>
                    <div style={{ color: 'var(--text-muted)' }}>rajesh.patel@example.com</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'academic' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Current Academic Placement</h4>
                  <span className="badge badge-emerald">Enrolled</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, fontSize: '0.82rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Class / Grade</span>
                    <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Grade 10</p>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Section</span>
                    <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Section A</p>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Academic Session</span>
                    <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>2026–2027</p>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Class Teacher</span>
                    <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Dr. Amit Verma</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 10 }}>Registered Subjects</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { code: 'MATH-101', name: 'Advanced Mathematics', credits: 4 },
                    { code: 'SCI-201', name: 'Physics & Chemistry', credits: 4 },
                    { code: 'ENG-102', name: 'English Literature', credits: 3 },
                    { code: 'CS-301', name: 'Computer Science & AI', credits: 3 },
                  ].map(s => (
                    <div key={s.code} style={{
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg-muted)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{s.name}</span>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.code}</div>
                      </div>
                      <span className="badge badge-slate">{s.credits} Credits</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div className="card" style={{ textAlign: 'center', padding: 16 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Overall Rate</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)', marginTop: 4 }}>96.4%</div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Excellent Standing</span>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: 16 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Days Present</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', marginTop: 4 }}>135</div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total Sessions</span>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: 16 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Absences</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--danger)', marginTop: 4 }}>5</div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>3 Excused, 2 Unexcused</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'fees' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary-light)',
                border: '1px solid rgba(22, 101, 52, 0.2)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fee Account Balance</span>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)' }}>$0.00 (All Cleared)</div>
                </div>
                <span className="badge badge-emerald" style={{ padding: '6px 12px' }}>
                  <CheckCircle size={14} /> Paid Up To Date
                </span>
              </div>
            </div>
          )}

          {activeTab === 'exams' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Recent Term Examinations</h4>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>GPA: 3.85 / 4.0</span>
              </div>
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Exam Name</th>
                      <th>Subject</th>
                      <th>Marks</th>
                      <th>Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="td-main">Midterm Examination</td>
                      <td>Mathematics</td>
                      <td>94 / 100</td>
                      <td><span className="badge badge-emerald">A+</span></td>
                    </tr>
                    <tr>
                      <td className="td-main">Midterm Examination</td>
                      <td>Physics</td>
                      <td>88 / 100</td>
                      <td><span className="badge badge-emerald">A</span></td>
                    </tr>
                    <tr>
                      <td className="td-main">Midterm Examination</td>
                      <td>English Literature</td>
                      <td>91 / 100</td>
                      <td><span className="badge badge-emerald">A+</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
