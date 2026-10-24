import { useState, useEffect, useCallback } from 'react';
import {
  CheckSquare, Calendar, Filter, CheckCircle, XCircle, Clock,
  HelpCircle, Save, CheckCheck, Users, AlertCircle, Search,
  PlusCircle, RefreshCcw, X, Edit2, ChevronLeft, ChevronRight,
  ShieldCheck, Lock, Unlock, Settings, FileText, AlertTriangle,
} from 'lucide-react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import EmptyState from '../components/EmptyState';
import { TableSkeleton } from '../components/LoadingSkeleton';

function AttendancePill({ status }) {
  const map = {
    present: { cls: 'badge-emerald', icon: <CheckCircle size={11} />, label: 'Present' },
    absent: { cls: 'badge-red', icon: <XCircle size={11} />, label: 'Absent' },
    late: { cls: 'badge-amber', icon: <Clock size={11} />, label: 'Late' },
    excused: { cls: 'badge-sky', icon: <HelpCircle size={11} />, label: 'Excused' },
  };
  const info = map[status] || map.present;
  return (
    <span className={`badge ${info.cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {info.icon} {info.label}
    </span>
  );
}

function StatusToggleGroup({ current, onChange, disabled = false }) {
  const options = [
    { key: 'present', label: 'P', cls: 'badge-emerald', title: 'Present' },
    { key: 'absent', label: 'A', cls: 'badge-red', title: 'Absent' },
    { key: 'late', label: 'L', cls: 'badge-amber', title: 'Late' },
    { key: 'excused', label: 'E', cls: 'badge-sky', title: 'Excused' },
  ];
  return (
    <div style={{ display: 'inline-flex', gap: 4 }}>
      {options.map(opt => (
        <button
          key={opt.key}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.key)}
          className={`badge ${current === opt.key ? opt.cls : 'badge-slate'}`}
          style={{
            cursor: disabled ? 'not-allowed' : 'pointer',
            border: current === opt.key ? '1px solid currentColor' : '1px solid transparent',
            fontWeight: 700,
            fontSize: '0.72rem',
            padding: '3px 8px',
            opacity: disabled ? 0.4 : (current === opt.key ? 1 : 0.45),
            transition: 'all 0.15s ease',
          }}
          title={opt.title}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Modal to Take New Attendance / Roll Call ─────────────────────────────────
function TakeAttendanceModal({
  open,
  onClose,
  onSaved,
  classes,
  defaultClassId,
  defaultSectionId,
  defaultDate,
  isLocked,
  onOpenCorrection,
}) {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const [classId, setClassId] = useState(defaultClassId || '');
  const [sectionId, setSectionId] = useState(defaultSectionId || '');
  const [sessionDate, setSessionDate] = useState(defaultDate || new Date().toISOString().split('T')[0]);
  const [sections, setSections] = useState([]);
  const [windowStatus, setWindowStatus] = useState(null);

  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [records, setRecords] = useState({});
  const [remarks, setRemarks] = useState({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // Update defaults when modal opens
  useEffect(() => {
    if (open) {
      setClassId(defaultClassId || (classes[0]?.id || ''));
      setSessionDate(defaultDate || new Date().toISOString().split('T')[0]);
      setErr('');
    }
  }, [open, defaultClassId, defaultDate, classes]);

  // Check window status for selected date
  useEffect(() => {
    if (!open || !sessionDate) return;
    api.get(`/deadlines/attendance-window?date=${sessionDate}`)
      .then(({ data }) => {
        if (data.success) {
          setWindowStatus(data.data);
        }
      })
      .catch(() => setWindowStatus(null));
  }, [open, sessionDate]);

  // Load sections when classId changes
  useEffect(() => {
    if (!classId) {
      setSections([]);
      setSectionId('');
      return;
    }
    api.get(`/sections?class_id=${classId}&limit=50`)
      .then(({ data }) => {
        if (data.success) {
          const list = data.data.sections || data.data.items || data.data || [];
          setSections(list);
          if (list.length > 0) {
            setSectionId(list[0].id);
          } else {
            setSectionId('');
          }
        }
      })
      .catch(() => setSections([]));
  }, [classId]);

  // Load enrolled students for the selected section
  useEffect(() => {
    if (!sectionId) {
      setStudents([]);
      setRecords({});
      return;
    }
    setLoadingStudents(true);
    setErr('');
    api.get(`/enrollments?section_id=${sectionId}&limit=100`)
      .then(({ data }) => {
        if (data.success) {
          const list = data.data.enrollments || data.data.items || data.data || [];
          setStudents(list);
          const initial = {};
          list.forEach(st => {
            initial[st.student_id] = 'present';
          });
          setRecords(initial);
        }
      })
      .catch(e => {
        console.error('Failed to load enrolled students:', e);
        setStudents([]);
      })
      .finally(() => setLoadingStudents(false));
  }, [sectionId]);

  function handleMarkAll(status) {
    const updated = {};
    students.forEach(st => {
      updated[st.student_id] = status;
    });
    setRecords(updated);
  }

  const isTeacher = (user?.role || '').toLowerCase() === 'teacher';
  const editingBlocked = isTeacher && windowStatus && !windowStatus.isOpen;

  async function handleSubmit(e) {
    e.preventDefault();
    if (editingBlocked) {
      setErr('Attendance window is locked. You must submit a Correction Request.');
      return;
    }
    if (!classId || !sectionId) {
      setErr('Please select both class and section.');
      return;
    }
    if (students.length === 0) {
      setErr('No enrolled students found in this section to take attendance for.');
      return;
    }

    setSaving(true);
    setErr('');
    try {
      // 1. Find teacher assignment for this class & section
      const taRes = await api.get(`/teacher-assignments?class_id=${classId}&section_id=${sectionId}&limit=1`);
      let assignment = taRes.data.data?.assignments?.[0] || taRes.data.data?.[0];

      if (!assignment) {
        const allTa = await api.get(`/teacher-assignments?limit=100`);
        const list = allTa.data.data?.assignments || allTa.data.data || [];
        assignment = list.find(a => a.section_id === sectionId || a.class_id === classId) || list[0];
      }

      if (!assignment) {
        throw new Error('No teacher curriculum assignment found for this class & section.');
      }

      // 2. Check or create attendance session
      let sessionId = null;
      const sessRes = await api.get(`/attendance/sessions?section_id=${sectionId}&session_date=${sessionDate}&limit=1`);
      const existingSession = sessRes.data.data?.sessions?.[0] || sessRes.data.data?.[0];

      if (existingSession) {
        sessionId = existingSession.id;
      } else {
        const newSess = await api.post('/attendance/sessions', {
          teacher_assignment_id: assignment.id,
          session_date: sessionDate,
          start_time: '09:00:00',
          end_time: '09:45:00',
        });
        sessionId = newSess.data.data?.id;
      }

      if (!sessionId) {
        throw new Error('Failed to resolve or create attendance session.');
      }

      // 3. Save bulk attendance records
      const bulkPayload = {
        attendance_session_id: sessionId,
        records: students.map(st => ({
          student_id: st.student_id,
          status: records[st.student_id] || 'present',
          remarks: remarks[st.student_id] || null,
        })),
      };

      await api.post('/attendance/bulk', bulkPayload);

      success(`Attendance successfully recorded for ${students.length} student(s)!`);
      onSaved();
      onClose();
    } catch (e) {
      const msg = e.response?.data?.message || e.message || 'Failed to save attendance.';
      setErr(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Record Daily Attendance Roll Call</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 24px 24px' }}>
          {/* Window status indicator */}
          {windowStatus && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: windowStatus.isOpen ? 'rgba(22, 101, 52, 0.08)' : 'rgba(220, 38, 38, 0.08)',
              color: windowStatus.isOpen ? 'var(--primary)' : 'var(--danger)',
              border: `1px solid ${windowStatus.isOpen ? 'rgba(22, 101, 52, 0.2)' : 'rgba(220, 38, 38, 0.2)'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {windowStatus.isOpen ? <Unlock size={15} /> : <Lock size={15} />}
                <span>
                  <strong>{windowStatus.isOpen ? 'Window Open' : 'Deadline Locked'}:</strong>{' '}
                  {windowStatus.reason}
                </span>
              </div>
              {!windowStatus.isOpen && isTeacher && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                  onClick={() => { onClose(); onOpenCorrection(); }}
                >
                  Request Correction
                </button>
              )}
            </div>
          )}

          {err && (
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={15} /> {err}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 6 }}>
                Class *
              </label>
              <select
                className="form-input"
                value={classId}
                onChange={e => setClassId(e.target.value)}
                required
              >
                <option value="">-- Select Class --</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
              </select>
            </div>

            <div>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 6 }}>
                Section *
              </label>
              <select
                className="form-input"
                value={sectionId}
                onChange={e => setSectionId(e.target.value)}
                required
                disabled={!classId || sections.length === 0}
              >
                <option value="">-- Select Section --</option>
                {sections.map(s => <option key={s.id} value={s.id}>{s.section_name}</option>)}
              </select>
            </div>

            <div>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 6 }}>
                Session Date *
              </label>
              <input
                type="date"
                className="form-input"
                value={sessionDate}
                onChange={e => setSessionDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Student roll call roster */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                Enrolled Students ({students.length})
              </span>
              {students.length > 0 && !editingBlocked && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                    onClick={() => handleMarkAll('present')}
                  >
                    Mark All Present
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                    onClick={() => handleMarkAll('absent')}
                  >
                    Mark All Absent
                  </button>
                </div>
              )}
            </div>

            {loadingStudents ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                Loading enrolled students...
              </p>
            ) : students.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
                <Users size={28} style={{ color: 'var(--text-muted)', margin: '0 auto 8px', display: 'block' }} />
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  No students currently enrolled in this section.
                </div>
              </div>
            ) : (
              <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
                {students.map((st, idx) => {
                  const studentName = st.student_name || `${st.first_name || ''} ${st.last_name || ''}`.trim() || `Student #${idx + 1}`;
                  const currentStatus = records[st.student_id] || 'present';
                  return (
                    <div
                      key={st.student_id || idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        backgroundColor: 'var(--bg-muted)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                          {studentName}
                        </div>
                        {st.admission_number && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            ID: {st.admission_number}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <StatusToggleGroup
                          current={currentStatus}
                          disabled={editingBlocked}
                          onChange={stKey => setRecords(prev => ({ ...prev, [st.student_id]: stKey }))}
                        />
                        <input
                          type="text"
                          placeholder="Note (optional)"
                          className="form-input"
                          disabled={editingBlocked}
                          value={remarks[st.student_id] || ''}
                          onChange={e => setRemarks(prev => ({ ...prev, [st.student_id]: e.target.value }))}
                          style={{ width: 130, padding: '4px 8px', fontSize: '0.75rem' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            {editingBlocked ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => { onClose(); onOpenCorrection(); }}
              >
                Submit Correction Request
              </button>
            ) : (
              <button type="submit" className="btn btn-primary" disabled={saving || students.length === 0}>
                {saving ? 'Saving Roll Call...' : 'Save Attendance Roll Call'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal for Requesting Attendance Correction (Teacher) ─────────────────────
function RequestCorrectionModal({ open, onClose, classes }) {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const [classId, setClassId] = useState(classes[0]?.id || '');
  const [sectionId, setSectionId] = useState('');
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [proposedStatus, setProposedStatus] = useState('present');
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!classId) {
      setSections([]);
      setSectionId('');
      return;
    }
    api.get(`/sections?class_id=${classId}&limit=50`).then(({ data }) => {
      if (data.success) {
        const list = data.data.sections || data.data.items || data.data || [];
        setSections(list);
        if (list.length > 0) setSectionId(list[0].id);
      }
    });
  }, [classId]);

  useEffect(() => {
    if (!sectionId) {
      setStudents([]);
      setStudentId('');
      return;
    }
    api.get(`/enrollments?section_id=${sectionId}&limit=100`).then(({ data }) => {
      if (data.success) {
        const list = data.data.enrollments || data.data.items || data.data || [];
        setStudents(list);
        if (list.length > 0) setStudentId(list[0].student_id);
      }
    });
  }, [sectionId]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!reason.trim()) {
      setErr('Please provide a detailed reason for the correction request.');
      return;
    }
    if (!studentId) {
      setErr('Please select a student.');
      return;
    }

    setSubmitting(true);
    setErr('');
    try {
      // Find session or assignment
      const sessRes = await api.get(`/attendance/sessions?section_id=${sectionId}&session_date=${sessionDate}&limit=1`);
      const targetSession = sessRes.data.data?.sessions?.[0] || null;

      const payload = {
        request_type: 'attendance',
        class_id: classId,
        section_id: sectionId,
        target_id: targetSession ? targetSession.id : null,
        target_date: sessionDate,
        proposed_changes: [
          {
            student_id: studentId,
            status: proposedStatus,
            remarks: remarks.trim() || null,
          },
        ],
        reason: reason.trim(),
      };

      const { data } = await api.post('/correction-requests', payload);
      if (data.success) {
        success('Correction request submitted for administrator review.');
        onClose();
      }
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to submit correction request.';
      setErr(msg);
      toastError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Request Attendance Record Correction</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '20px 24px 24px' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
            Because the daily roll call deadline has closed, attendance modifications require admin review and an audit trail.
          </p>

          {err && (
            <div style={{ padding: '8px 12px', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
              {err}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Class *</label>
              <select className="form-input" value={classId} onChange={e => setClassId(e.target.value)} required>
                {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Section *</label>
              <select className="form-input" value={sectionId} onChange={e => setSectionId(e.target.value)} required>
                {sections.map(s => <option key={s.id} value={s.id}>{s.section_name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Date *</label>
              <input type="date" className="form-input" value={sessionDate} onChange={e => setSessionDate(e.target.value)} required />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Proposed Status *</label>
              <select className="form-input" value={proposedStatus} onChange={e => setProposedStatus(e.target.value)}>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
                <option value="excused">Excused</option>
              </select>
            </div>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Student *</label>
            <select className="form-input" value={studentId} onChange={e => setStudentId(e.target.value)} required>
              {students.map(st => (
                <option key={st.student_id} value={st.student_id}>
                  {st.student_name || `${st.first_name || ''} ${st.last_name || ''}`} ({st.admission_number || st.student_id?.slice(0, 8)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Reason for Correction *</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Explain why this record needs correction (e.g., student brought approved medical certificate)..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal for Admin to Configure Attendance Deadlines ───────────────────────
function ConfigureDeadlineModal({ open, onClose, onSaved }) {
  const { success, error: toastError } = useToast();
  const [deadlineTime, setDeadlineTime] = useState('14:00');
  const [pastDays, setPastDays] = useState(0);
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [isStrict, setIsStrict] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get('/deadlines').then(({ data }) => {
      if (data.success) {
        const attPolicy = data.data?.find(p => p.policy_type === 'attendance');
        if (attPolicy) {
          setDeadlineTime(attPolicy.daily_deadline_time ? attPolicy.daily_deadline_time.slice(0, 5) : '14:00');
          setPastDays(attPolicy.past_days_allowed || 0);
          setTimezone(attPolicy.timezone || 'Asia/Kolkata');
          setIsStrict(attPolicy.is_strict !== 0);
        }
      }
    });
  }, [open]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/deadlines/attendance', {
        daily_deadline_time: `${deadlineTime}:00`,
        past_days_allowed: Number(pastDays),
        timezone,
        is_strict: isStrict ? 1 : 0,
      });
      success('Attendance deadline policy updated.');
      onSaved();
      onClose();
    } catch (e) {
      toastError(e.response?.data?.message || 'Failed to update policy.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Configure Attendance Deadlines & Policies</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '20px 24px 24px' }}>
          <div>
            <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Daily Submission Cutoff Time *</label>
            <input
              type="time"
              className="form-input"
              value={deadlineTime}
              onChange={e => setDeadlineTime(e.target.value)}
              required
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Teachers must record or finalize attendance before this hour each day.
            </span>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Past Days Allowed for Direct Roll Call</label>
            <input
              type="number"
              min="0"
              max="7"
              className="form-input"
              value={pastDays}
              onChange={e => setPastDays(e.target.value)}
              required
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              0 = Today only. 1 = Yesterday allowed. Older dates are strictly locked.
            </span>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>School Timezone *</label>
            <select className="form-input" value={timezone} onChange={e => setTimezone(e.target.value)}>
              <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New_York (EST)</option>
              <option value="Europe/London">Europe/London (GMT)</option>
              <option value="Asia/Dubai">Asia/Dubai (GST)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <input
              type="checkbox"
              id="is_strict"
              checked={isStrict}
              onChange={e => setIsStrict(e.target.checked)}
            />
            <label htmlFor="is_strict" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
              Enforce strict backend deadline lock (rejects requests after deadline)
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Policy'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal for Reviewing Correction Requests ──────────────────────────────────
function ReviewCorrectionsModal({ open, onClose, onReviewed, isAdmin }) {
  const { success, error: toastError } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/correction-requests?request_type=attendance&limit=50');
      if (data.success) {
        setRequests(data.data?.requests || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchRequests();
  }, [open, fetchRequests]);

  async function handleReview(status) {
    if (!selectedReq) return;
    setProcessing(true);
    try {
      await api.patch(`/correction-requests/${selectedReq.id}/review`, {
        status,
        admin_notes: adminNotes.trim() || null,
      });
      success(`Correction request has been ${status}.`);
      setSelectedReq(null);
      setAdminNotes('');
      fetchRequests();
      onReviewed();
    } catch (e) {
      toastError(e.response?.data?.message || 'Review action failed.');
    } finally {
      setProcessing(false);
    }
  }

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 740 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Attendance Correction Requests & Audit Trail</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {loading ? (
            <p style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>Loading requests...</p>
          ) : requests.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No Attendance Correction Requests"
              description="All attendance records are up to date and in compliance with school deadlines."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 420, overflowY: 'auto' }}>
              {requests.map(req => {
                const isPending = req.status === 'pending';
                const changes = Array.isArray(req.proposed_changes) ? req.proposed_changes : [req.proposed_changes];

                return (
                  <div
                    key={req.id}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-muted)',
                      borderLeft: `4px solid ${req.status === 'approved' ? 'var(--primary)' : req.status === 'rejected' ? 'var(--danger)' : 'var(--amber-500)'}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 14,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span className={`badge ${req.status === 'approved' ? 'badge-emerald' : req.status === 'rejected' ? 'badge-red' : 'badge-amber'}`}>
                          {req.status}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {req.created_at ? new Date(req.created_at).toLocaleString() : ''}
                        </span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        Teacher: {req.teacher_first_name} {req.teacher_last_name} ({req.teacher_email})
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        Target Date: <strong>{req.target_date ? String(req.target_date).slice(0, 10) : 'Session'}</strong> • Class: {req.class_name || 'Assigned'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginTop: 6, fontStyle: 'italic' }}>
                        "{req.reason}"
                      </div>
                      {req.admin_notes && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          Admin Note: {req.admin_notes}
                        </div>
                      )}
                    </div>

                    {isAdmin && isPending && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          onClick={() => { setSelectedReq(req); handleReview('approved'); }}
                          disabled={processing}
                        >
                          Approve
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 10px', fontSize: '0.75rem', color: 'var(--danger)' }}
                          onClick={() => { setSelectedReq(req); handleReview('rejected'); }}
                          disabled={processing}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main AttendancePage Component ────────────────────────────────────────────
export default function AttendancePage() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const role = (user?.role || '').toLowerCase();
  const isTeacher = role === 'teacher';
  const isAdmin = role === 'admin';
  const isStaff = isAdmin || isTeacher;

  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [windowStatus, setWindowStatus] = useState(null);

  // Filters — DEFAULT TO EMPTY SO ALL RECORDS LOAD INITIALLY
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [search, setSearch] = useState('');

  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [policyModalOpen, setPolicyModalOpen] = useState(false);

  // Fetch Window Status
  const fetchWindowStatus = useCallback(async () => {
    try {
      const { data } = await api.get(`/deadlines/attendance-window?date=${selectedDate || new Date().toISOString().split('T')[0]}`);
      if (data.success) {
        setWindowStatus(data.data);
      }
    } catch (e) {
      console.error('Failed to load window status:', e);
    }
  }, [selectedDate]);

  // Load classes (scoped to teacher assignments if teacher)
  useEffect(() => {
    async function loadClasses() {
      try {
        if (isTeacher) {
          const { data } = await api.get('/teacher-assignments?limit=100');
          if (data.success) {
            const list = data.data.assignments || data.data.items || data.data || [];
            const uniqueMap = {};
            list.forEach(a => {
              if (a.class_id && !uniqueMap[a.class_id]) {
                uniqueMap[a.class_id] = { id: a.class_id, class_name: a.class_name };
              }
            });
            setClasses(Object.values(uniqueMap));
          }
        } else {
          const { data } = await api.get('/classes?limit=100');
          if (data.success) {
            setClasses(data.data.classes || data.data.items || data.data || []);
          }
        }
      } catch (err) {
        console.error('Failed to load classes:', err);
      }
    }
    loadClasses();
    fetchWindowStatus();
  }, [isTeacher, fetchWindowStatus]);

  // Load sections when class changes
  useEffect(() => {
    if (!selectedClassId) {
      setSections([]);
      setSelectedSectionId('');
      return;
    }
    api.get(`/sections?class_id=${selectedClassId}&limit=50`).then(({ data }) => {
      if (data.success) {
        setSections(data.data.sections || data.data.items || data.data || []);
      }
    }).catch(console.error);
  }, [selectedClassId]);

  // Fetch attendance records from database
  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 100 });
      if (selectedClassId) params.set('class_id', selectedClassId);
      if (selectedSectionId) params.set('section_id', selectedSectionId);
      if (selectedDate) params.set('date', selectedDate);
      if (selectedStatus) params.set('status', selectedStatus);

      const { data } = await api.get(`/attendance?${params}`);
      if (data.success) {
        setAttendance(data.data.attendance || data.data.items || data.data || []);
      }
    } catch (err) {
      console.error('Failed to load attendance:', err);
      setAttendance([]);
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, selectedSectionId, selectedDate, selectedStatus]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  function handleStatusChange(id, newStatus) {
    setAttendance(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
  }

  function handleMarkAllPresent() {
    setAttendance(prev => prev.map(a => ({ ...a, status: 'present' })));
  }

  async function handleBatchSave() {
    if (!attendance.length) return;
    setSaving(true);
    try {
      await Promise.all(attendance.map(a =>
        api.patch(`/attendance/${a.id}`, { status: a.status }).catch(() => {})
      ));
      success('Attendance changes saved successfully!');
      setEditMode(false);
      fetchAttendance();
    } catch (e) {
      toastError('Failed to save some attendance changes.');
    } finally {
      setSaving(false);
    }
  }

  // Filter attendance by client search (student name, roll)
  const filteredAttendance = attendance.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = `${a.student_first_name || ''} ${a.student_last_name || ''} ${a.student_name || ''}`.toLowerCase();
    const roll = `${a.student_number || a.student_code || a.roll_number || ''}`.toLowerCase();
    return name.includes(q) || roll.includes(q);
  });

  // Calculate live statistics
  const stats = {
    total: attendance.length,
    present: attendance.filter(a => a.status === 'present').length,
    absent: attendance.filter(a => a.status === 'absent').length,
    late: attendance.filter(a => a.status === 'late').length,
    excused: attendance.filter(a => a.status === 'excused').length,
  };
  const presentPct = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Banner & Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Attendance Management
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 2 }}>
            {isTeacher
              ? 'Record daily roll calls for assigned classes within configured school windows.'
              : 'Track daily class roll calls, configure deadlines, and review teacher correction audits.'}
          </p>
        </div>

        {isStaff && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setReviewModalOpen(true)}
              title="View correction requests and audit logs"
            >
              <FileText size={15} /> Correction Requests
            </button>

            {isAdmin && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPolicyModalOpen(true)}
                title="Configure daily submission deadlines and timezone"
              >
                <Settings size={15} /> Deadlines Policy
              </button>
            )}

            {isTeacher && windowStatus && !windowStatus.isOpen && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setCorrectionModalOpen(true)}
                title="Submit correction request for closed records"
                style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
              >
                <AlertCircle size={15} /> Request Correction
              </button>
            )}

            <button
              className="btn btn-primary btn-sm"
              onClick={() => setModalOpen(true)}
            >
              <PlusCircle size={15} /> Take Roll Call
            </button>
          </div>
        )}
      </div>

      {/* Deadline Window Status Banner */}
      {windowStatus && (
        <div style={{
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: windowStatus.isOpen ? 'rgba(22, 101, 52, 0.08)' : 'rgba(220, 38, 38, 0.08)',
          border: `1px solid ${windowStatus.isOpen ? 'rgba(22, 101, 52, 0.25)' : 'rgba(220, 38, 38, 0.25)'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {windowStatus.isOpen ? <Unlock size={18} color="var(--primary)" /> : <Lock size={18} color="var(--danger)" />}
            <div>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {windowStatus.isOpen ? 'Attendance Editing Window Open' : 'Attendance Editing Window Locked'}
              </span>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {windowStatus.reason}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Server Time: <strong>{windowStatus.currentTime}</strong> ({windowStatus.timezone})
            </span>
            {!windowStatus.isOpen && isTeacher && (
              <button
                className="btn btn-secondary btn-sm"
                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                onClick={() => setCorrectionModalOpen(true)}
              >
                Request Correction
              </button>
            )}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
        {[
          { label: 'Total Marked', value: stats.total, icon: <Users size={20} />, bg: 'var(--primary-light)', fg: 'var(--primary)', valColor: 'var(--text-primary)' },
          { label: 'Present', value: stats.present, icon: <CheckCircle size={20} />, bg: 'var(--success-light)', fg: 'var(--success)', valColor: 'var(--success)' },
          { label: 'Absent', value: stats.absent, icon: <XCircle size={20} />, bg: 'var(--danger-light)', fg: 'var(--danger)', valColor: 'var(--danger)' },
          { label: 'Late / Excused', value: stats.late + stats.excused, icon: <Clock size={20} />, bg: 'var(--warning-light)', fg: 'var(--warning)', valColor: 'var(--warning)' },
          { label: 'Attendance Rate', value: `${presentPct}%`, icon: <CheckSquare size={20} />, bg: 'var(--primary-light)', fg: 'var(--primary)', valColor: presentPct >= 80 ? 'var(--success)' : 'var(--warning)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', backgroundColor: s.bg, color: s.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {s.icon}
            </div>
            <div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</span>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: s.valColor }}>{s.value}</div>
            </div>
          </div>
        ))}
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
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 34 }}
            />
          </div>

          <select
            className="form-input"
            value={selectedClassId}
            onChange={e => { setSelectedClassId(e.target.value); setSelectedSectionId(''); }}
            style={{ minWidth: 150 }}
          >
            <option value="">{isTeacher ? 'My Classes (All)' : 'All Classes'}</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
          </select>

          <select
            className="form-input"
            value={selectedSectionId}
            onChange={e => setSelectedSectionId(e.target.value)}
            style={{ minWidth: 140 }}
            disabled={!selectedClassId || sections.length === 0}
          >
            <option value="">All Sections</option>
            {sections.map(s => <option key={s.id} value={s.id}>{s.section_name}</option>)}
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="date"
              className="form-input"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={{ minWidth: 140 }}
              title="Filter by session date"
            />
            {selectedDate && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedDate('')}
                title="Clear date filter to view all records"
                style={{ padding: '6px 10px', fontSize: '0.75rem' }}
              >
                All Dates
              </button>
            )}
          </div>

          <select
            className="form-input"
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            style={{ minWidth: 130 }}
          >
            <option value="">All Statuses</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="late">Late</option>
            <option value="excused">Excused</option>
          </select>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSelectedClassId('');
              setSelectedSectionId('');
              setSelectedDate('');
              setSelectedStatus('');
              setSearch('');
            }}
            title="Reset Filters"
          >
            <RefreshCcw size={14} />
          </button>
        </div>
      </div>

      {/* Main Table / Data View */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              Attendance Records
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 8 }}>
              Showing {filteredAttendance.length} of {attendance.length} record(s)
            </span>
          </div>

          {isStaff && attendance.length > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              {editMode ? (
                <>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleMarkAllPresent}
                    disabled={saving}
                  >
                    <CheckCheck size={14} /> Mark All Present
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleBatchSave}
                    disabled={saving}
                  >
                    <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setEditMode(false); fetchAttendance(); }}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setEditMode(true)}
                  disabled={isTeacher && windowStatus && !windowStatus.isOpen}
                  title={isTeacher && windowStatus && !windowStatus.isOpen ? 'Window locked' : 'Edit statuses inline'}
                >
                  <Edit2 size={14} /> Quick Edit
                </button>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ padding: 20 }}>
            <TableSkeleton rows={8} />
          </div>
        ) : filteredAttendance.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="No Attendance Records Found"
            description="No roll calls recorded matching your selected filters. Click 'Take Roll Call' to record class attendance."
            actionText={isStaff ? 'Take Roll Call' : undefined}
            onAction={isStaff ? () => setModalOpen(true) : undefined}
          />
        ) : (
          <div className="table-responsive">
            <table className="table" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: 220 }}>Student</th>
                  <th style={{ width: 130 }}>Admission No.</th>
                  <th style={{ width: 160 }}>Class / Section</th>
                  <th style={{ width: 130 }}>Session Date</th>
                  <th style={{ width: 160 }}>Status</th>
                  <th style={{ width: 110 }}>Recorded At</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttendance.map((a, idx) => {
                  const firstName = a.student_first_name || '';
                  const lastName  = a.student_last_name  || '';
                  const fullName  = `${firstName} ${lastName}`.trim() || a.student_name || 'Unknown';
                  const initials  = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || '?';
                  const admNo     = a.student_number || a.admission_number || a.student_code || null;
                  const sessionDt = a.session_date ? String(a.session_date).slice(0, 10) : null;
                  const recordedAt = a.marked_at
                    ? new Date(a.marked_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : null;

                  const avatarColors = [
                    ['#e0f2fe', '#0369a1'], ['#fce7f3', '#be185d'],
                    ['#dcfce7', '#15803d'], ['#fef3c7', '#b45309'],
                    ['#ede9fe', '#7c3aed'], ['#fee2e2', '#b91c1c'],
                  ];
                  const [avatarBg, avatarFg] = avatarColors[idx % avatarColors.length];

                  return (
                    <tr key={a.id} style={{ transition: 'background 0.12s' }}>
                      {/* Student */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            backgroundColor: avatarBg, color: avatarFg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.72rem', fontWeight: 800, flexShrink: 0,
                          }}>
                            {initials}
                          </div>
                          <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                            {fullName}
                          </span>
                        </div>
                      </td>

                      {/* Admission No */}
                      <td>
                        {admNo ? (
                          <span style={{
                            display: 'inline-block',
                            fontSize: '0.78rem', fontWeight: 600,
                            color: 'var(--text-secondary)',
                            backgroundColor: 'var(--bg-muted)',
                            padding: '2px 8px', borderRadius: 4,
                            fontFamily: 'monospace',
                          }}>
                            {admNo}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      {/* Class / Section */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                            {a.class_name || '—'}
                          </span>
                          {a.section_name && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              Section {a.section_name}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Session Date */}
                      <td>
                        {sessionDt ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                              {new Date(sessionDt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {new Date(sessionDt).toLocaleDateString('en-IN', { weekday: 'short' })}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td>
                        {editMode ? (
                          <StatusToggleGroup
                            current={a.status}
                            onChange={st => handleStatusChange(a.id, st)}
                          />
                        ) : (
                          <AttendancePill status={a.status} />
                        )}
                      </td>

                      {/* Recorded At */}
                      <td>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {recordedAt || '—'}
                        </span>
                      </td>

                      {/* Remarks */}
                      <td>
                        <span style={{
                          fontSize: '0.78rem',
                          color: a.remarks ? 'var(--text-secondary)' : 'var(--text-muted)',
                          fontStyle: a.remarks ? 'italic' : 'normal',
                        }}>
                          {a.remarks || '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <TakeAttendanceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={fetchAttendance}
        classes={classes}
        defaultClassId={selectedClassId}
        defaultSectionId={selectedSectionId}
        defaultDate={selectedDate}
        isLocked={windowStatus && !windowStatus.isOpen}
        onOpenCorrection={() => setCorrectionModalOpen(true)}
      />

      <RequestCorrectionModal
        open={correctionModalOpen}
        onClose={() => setCorrectionModalOpen(false)}
        classes={classes}
      />

      <ConfigureDeadlineModal
        open={policyModalOpen}
        onClose={() => setPolicyModalOpen(false)}
        onSaved={fetchWindowStatus}
      />

      <ReviewCorrectionsModal
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        onReviewed={fetchAttendance}
        isAdmin={isAdmin}
      />
    </div>
  );
}
