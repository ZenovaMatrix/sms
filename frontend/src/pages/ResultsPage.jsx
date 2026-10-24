import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Award, TrendingUp, Search, Filter, CheckCircle, Download,
  ChevronLeft, ChevronRight, XCircle, PlusCircle, Edit2, Trash2,
  X, Save, AlertTriangle, Layers, BookOpen, Calendar, HelpCircle,
  FileSpreadsheet, ArrowUpDown, LayoutGrid, List, Check, Clock,
  Lock, Unlock, ShieldCheck, Settings, FileText,
} from 'lucide-react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import EmptyState from '../components/EmptyState';
import { TableSkeleton, CardSkeleton } from '../components/LoadingSkeleton';

function GradePill({ grade, isPass }) {
  const g = (grade || '').toUpperCase();
  const pass = isPass !== undefined ? (isPass === true || isPass === 'pass') : g !== 'F';

  if (!pass || g === 'F') {
    return (
      <span className="badge badge-red" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <XCircle size={11} /> Grade F (Fail)
      </span>
    );
  }

  const map = {
    'A+': 'badge-emerald',
    'A': 'badge-emerald',
    'B+': 'badge-sky',
    'B': 'badge-sky',
    'C+': 'badge-amber',
    'C': 'badge-amber',
    'D': 'badge-amber',
  };

  return (
    <span className={`badge ${map[g] || 'badge-emerald'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <CheckCircle size={11} /> {g || 'Pass'}
    </span>
  );
}

function calculateGrade(marks, total, passing) {
  if (total <= 0 || isNaN(marks)) return { grade: 'F', status: 'fail', pct: 0 };
  const pct = Math.round((marks / total) * 100);
  let grade = 'F';
  if (pct >= 90) grade = 'A+';
  else if (pct >= 80) grade = 'A';
  else if (pct >= 70) grade = 'B';
  else if (pct >= 60) grade = 'C';
  else if (pct >= 50) grade = 'D';

  const status = marks >= passing ? 'pass' : 'fail';
  return { grade, status, pct };
}

// ─── Modal for Requesting Mark Correction (Teacher) ───────────────────────────
function RequestMarkCorrectionModal({ open, result, onClose, onSubmitted }) {
  const { success, error: toastError } = useToast();
  const [marks, setMarks] = useState('');
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const maxMarks = Number(result?.total_marks || result?.max_marks || 100);
  const passingMarks = Number(result?.passing_marks || 40);

  useEffect(() => {
    if (open && result) {
      setMarks(result.marks_obtained !== undefined ? String(Number(result.marks_obtained)) : '');
      setRemarks(result.remarks || '');
      setReason('');
      setErr('');
    }
  }, [open, result]);

  const preview = useMemo(() => {
    const m = parseFloat(marks);
    if (isNaN(m)) return null;
    return calculateGrade(m, maxMarks, passingMarks);
  }, [marks, maxMarks, passingMarks]);

  async function handleSubmit(e) {
    e.preventDefault();
    const num = parseFloat(marks);
    if (isNaN(num) || num < 0 || num > maxMarks) {
      setErr(`Please enter a valid score between 0 and ${maxMarks}.`);
      return;
    }
    if (!reason.trim()) {
      setErr('Please provide a justification for this mark correction request.');
      return;
    }

    setSubmitting(true);
    setErr('');
    try {
      const payload = {
        request_type: 'result',
        target_id: result.id,
        class_id: result.class_id,
        subject_id: result.subject_id,
        proposed_changes: {
          marks_obtained: num,
          remarks: remarks.trim() || null,
        },
        reason: reason.trim(),
      };

      const { data } = await api.post('/correction-requests', payload);
      if (data.success) {
        success('Mark correction request submitted for admin review.');
        if (onSubmitted) onSubmitted();
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

  if (!open || !result) return null;

  const studentName = result.student_name || `${result.student_first_name || ''} ${result.student_last_name || ''}`.trim() || 'Student';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Request Mark Correction</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '20px 24px 24px' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
            Because the examination grading window has closed, modifications to published scores require admin review and an audit trail.
          </p>

          {err && (
            <div style={{ padding: '8px 12px', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
              {err}
            </div>
          )}

          <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
              {studentName} ({result.student_number || result.student_id?.slice(0, 8)})
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              {result.exam_name} • Subject: <strong>{result.subject_name}</strong>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Current Score: <strong>{result.marks_obtained}</strong> / {maxMarks} (Grade {result.grade})
            </div>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
              Proposed New Marks * (Max: {maxMarks})
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              max={maxMarks}
              className="form-input"
              value={marks}
              onChange={e => setMarks(e.target.value)}
              required
            />
          </div>

          {preview && (
            <div style={{ padding: '8px 12px', backgroundColor: preview.status === 'pass' ? 'rgba(22, 101, 52, 0.08)' : 'rgba(220, 38, 38, 0.08)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>Recalculated Grade: <strong>{preview.grade}</strong> ({preview.pct}%)</span>
              <span style={{ textTransform: 'uppercase', fontWeight: 700, color: preview.status === 'pass' ? 'var(--primary)' : 'var(--danger)' }}>
                {preview.status}
              </span>
            </div>
          )}

          <div>
            <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
              Reason for Correction *
            </label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Explain the reason (e.g., clerical error during paper totaling, re-evaluation request)..."
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

// ─── Modal for Admin to Review Mark Corrections ───────────────────────────────
function ReviewMarkCorrectionsModal({ open, onClose, onReviewed, isAdmin }) {
  const { success, error: toastError } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/correction-requests?request_type=result&limit=50');
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

  async function handleReview(id, status) {
    setProcessing(true);
    try {
      await api.patch(`/correction-requests/${id}/review`, {
        status,
        admin_notes: `Mark change ${status} by administrator.`,
      });
      success(`Mark correction request has been ${status}.`);
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
          <h2 className="modal-title">Examination Gradebook Correction Requests</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {loading ? (
            <p style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>Loading requests...</p>
          ) : requests.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No Mark Correction Requests"
              description="No score modifications are currently pending admin review."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 420, overflowY: 'auto' }}>
              {requests.map(req => {
                const isPending = req.status === 'pending';
                const changes = req.proposed_changes || {};

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
                        Class: <strong>{req.class_name || 'Assigned'}</strong> • Subject: <strong>{req.subject_name || 'General'}</strong>
                      </div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>
                        Proposed Marks: <span style={{ color: 'var(--primary)' }}>{changes.marks_obtained}</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginTop: 4, fontStyle: 'italic' }}>
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
                          onClick={() => handleReview(req.id, 'approved')}
                          disabled={processing}
                        >
                          Approve & Recalculate
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 10px', fontSize: '0.75rem', color: 'var(--danger)' }}
                          onClick={() => handleReview(req.id, 'rejected')}
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

// ─── Modal for Admin to Configure Grading Window Deadlines ────────────────────
function ConfigureGradingDeadlineModal({ open, onClose, onSaved }) {
  const { success, error: toastError } = useToast();
  const [windowDays, setWindowDays] = useState(14);
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [isStrict, setIsStrict] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get('/deadlines').then(({ data }) => {
      if (data.success) {
        const policy = data.data?.find(p => p.policy_type === 'grading');
        if (policy) {
          setWindowDays(policy.grading_window_days || 14);
          setTimezone(policy.timezone || 'Asia/Kolkata');
          setIsStrict(policy.is_strict !== 0);
        }
      }
    });
  }, [open]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/deadlines/grading', {
        grading_window_days: Number(windowDays),
        timezone,
        is_strict: isStrict ? 1 : 0,
      });
      success('Grading window deadline policy updated.');
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
          <h2 className="modal-title">Configure Examination Grading Window</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '20px 24px 24px' }}>
          <div>
            <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
              Grading Window Days (After Exam End Date) *
            </label>
            <input
              type="number"
              min="1"
              max="90"
              className="form-input"
              value={windowDays}
              onChange={e => setWindowDays(e.target.value)}
              required
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Number of days teachers have to submit marks after an exam concludes.
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
              id="strict_grading"
              checked={isStrict}
              onChange={e => setIsStrict(e.target.checked)}
            />
            <label htmlFor="strict_grading" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
              Enforce strict backend closure (locks marks after deadline)
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

// ─── Edit Single Result Modal ─────────────────────────────────────────────────
function EditResultModal({ open, result, onClose, onSaved, isLocked, onOpenCorrection, isTeacher }) {
  const { success, error: toastError } = useToast();
  const [marks, setMarks] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const maxMarks = Number(result?.total_marks || result?.max_marks || 100);
  const passingMarks = Number(result?.passing_marks || 40);

  useEffect(() => {
    if (open && result) {
      setMarks(result.marks_obtained !== undefined ? String(Number(result.marks_obtained)) : '');
      setRemarks(result.remarks || '');
      setErr('');
    }
  }, [open, result]);

  const preview = useMemo(() => {
    const m = parseFloat(marks);
    if (isNaN(m)) return null;
    return calculateGrade(m, maxMarks, passingMarks);
  }, [marks, maxMarks, passingMarks]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (isTeacher && isLocked) {
      setErr('Grading window is locked. Please submit a Correction Request.');
      return;
    }

    const num = parseFloat(marks);
    if (isNaN(num) || num < 0 || num > maxMarks) {
      setErr(`Please enter a valid non-negative score not exceeding ${maxMarks}.`);
      return;
    }

    setSaving(true);
    setErr('');
    try {
      const payload = {
        marks_obtained: num,
        remarks: remarks.trim() || null,
      };
      const { data } = await api.patch(`/results/${result.id}`, payload);
      if (data.success) {
        success('Result score updated successfully!');
        onSaved();
        onClose();
      }
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to update result.';
      setErr(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!open || !result) return null;

  const studentName = result.student_name || `${result.student_first_name || ''} ${result.student_last_name || ''}`.trim() || 'Student';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Edit Examination Result</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 24px 24px' }}>
          {isTeacher && isLocked && (
            <div style={{
              padding: '10px 14px',
              backgroundColor: 'rgba(220, 38, 38, 0.08)',
              color: 'var(--danger)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              border: '1px solid rgba(220, 38, 38, 0.25)',
            }}>
              <span>🔒 Grading window closed. Direct edit locked.</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                onClick={() => { onClose(); onOpenCorrection(result); }}
              >
                Request Correction
              </button>
            </div>
          )}

          {err && (
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={15} /> {err}
            </div>
          )}

          <div style={{ padding: '12px 14px', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Student & Examination</div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: 2, fontSize: '0.95rem' }}>
              {studentName} {result.student_number ? `(${result.student_number})` : ''}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
              <strong>{result.exam_name}</strong> • Subject: <strong>{result.subject_name}</strong>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Max Marks: {maxMarks} | Passing Marks: {passingMarks}
            </div>
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 6 }}>
              Marks Obtained * (Max: {maxMarks})
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              max={maxMarks}
              className="form-input"
              value={marks}
              disabled={isTeacher && isLocked}
              onChange={e => setMarks(e.target.value)}
              required
              autoFocus
            />
          </div>

          {preview && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: preview.status === 'pass' ? 'rgba(22, 101, 52, 0.08)' : 'var(--danger-light)', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Grade Preview:</span>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: preview.status === 'pass' ? 'var(--primary)' : 'var(--danger)' }}>
                  {preview.pct}% • Grade {preview.grade}
                </div>
              </div>
              <span className={`badge ${preview.status === 'pass' ? 'badge-emerald' : 'badge-red'}`} style={{ textTransform: 'uppercase' }}>
                {preview.status}
              </span>
            </div>
          )}

          <div>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 6 }}>
              Remarks (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Excellent conceptual grasp"
              className="form-input"
              disabled={isTeacher && isLocked}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            {isTeacher && isLocked ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => { onClose(); onOpenCorrection(result); }}
              >
                Submit Correction Request
              </button>
            ) : (
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Updating...' : 'Save Result Score'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal to Add / Enter Batch Results ────────────────────────────────────────
function AddResultModal({ open, exams, onClose, onSaved, isTeacher }) {
  const { success, error: toastError } = useToast();

  const [examId, setExamId] = useState('');
  const [examSubjects, setExamSubjects] = useState([]);
  const [selectedExamSubId, setSelectedExamSubId] = useState('');

  const [classId, setClassId] = useState('');
  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState('');

  const [students, setStudents] = useState([]);
  const [existingResults, setExistingResults] = useState({});
  const [marksState, setMarksState] = useState({});
  const [remarksState, setRemarksState] = useState({});

  const [loadingMeta, setLoadingMeta] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [windowStatus, setWindowStatus] = useState(null);

  useEffect(() => {
    if (open) {
      if ((Array.isArray(exams) ? exams : []).length > 0) {
        setExamId(exams[0].id);
      }
      setErr('');
    }
  }, [open, exams]);

  // Load exam subjects and exam class info when examId changes
  useEffect(() => {
    if (!examId) {
      setExamSubjects([]);
      setSelectedExamSubId('');
      setClassId('');
      setWindowStatus(null);
      return;
    }

    const currentExam = (Array.isArray(exams) ? exams : []).find(e => e.id === examId);
    if (currentExam) {
      setClassId(currentExam.class_id || '');
      // Check grading window
      api.get(`/deadlines/grading-window?exam_end_date=${currentExam.end_date || ''}`)
        .then(({ data }) => {
          if (data.success) setWindowStatus(data.data);
        })
        .catch(() => setWindowStatus(null));
    }

    api.get(`/exam-subjects?exam_id=${examId}&limit=50`)
      .then(({ data }) => {
        if (data.success) {
          const list = data.data.exam_subjects || data.data.items || data.data || [];
          setExamSubjects(list);
          if (list.length > 0) {
            setSelectedExamSubId(list[0].id);
          } else {
            setSelectedExamSubId('');
          }
        }
      })
      .catch(() => setExamSubjects([]));
  }, [examId, exams]);

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
          if (list.length > 0) setSectionId(list[0].id);
        }
      })
      .catch(() => setSections([]));
  }, [classId]);

  // Load students & existing results for selected section & exam subject
  useEffect(() => {
    if (!sectionId || !selectedExamSubId) {
      setStudents([]);
      setExistingResults({});
      setMarksState({});
      setRemarksState({});
      return;
    }

    setLoadingMeta(true);
    setErr('');
    Promise.allSettled([
      api.get(`/enrollments?section_id=${sectionId}&limit=100`),
      api.get(`/results?exam_subject_id=${selectedExamSubId}&section_id=${sectionId}&limit=100`),
    ]).then(([enrRes, resRes]) => {
      const enrolled = enrRes.status === 'fulfilled' && enrRes.value.data.success
        ? (enrRes.value.data.data.enrollments || enrRes.value.data.data.items || enrRes.value.data.data || [])
        : [];
      const recorded = resRes.status === 'fulfilled' && resRes.value.data.success
        ? (resRes.value.data.data.results || resRes.value.data.data.items || resRes.value.data.data || [])
        : [];

      setStudents(enrolled);

      const resultMap = {};
      const initialMarks = {};
      const initialRemarks = {};

      recorded.forEach(r => {
        resultMap[r.student_id] = r;
        initialMarks[r.student_id] = r.marks_obtained !== undefined ? String(Number(r.marks_obtained)) : '';
        initialRemarks[r.student_id] = r.remarks || '';
      });

      setExistingResults(resultMap);
      setMarksState(initialMarks);
      setRemarksState(initialRemarks);
    }).finally(() => setLoadingMeta(false));
  }, [sectionId, selectedExamSubId]);

  const selectedEs = (Array.isArray(examSubjects) ? examSubjects : []).find(es => es.id === selectedExamSubId);
  const maxMarks = Number(selectedEs?.total_marks || 100);
  const passingMarks = Number(selectedEs?.passing_marks || 40);

  async function handleBatchSubmit(e) {
    e.preventDefault();
    if (isTeacher && windowStatus && !windowStatus.isOpen) {
      setErr('Grading window is closed. Please submit a Correction Request.');
      return;
    }
    if (!selectedExamSubId) {
      setErr('Please select an exam subject paper.');
      return;
    }

    const records = [];
    for (const st of students) {
      const val = marksState[st.student_id];
      if (val !== undefined && val !== '') {
        const num = parseFloat(val);
        if (isNaN(num) || num < 0) {
          setErr(`Invalid score entered for ${st.student_name || 'student'}.`);
          return;
        }
        if (num > maxMarks) {
          setErr(`Marks scored for ${st.student_name || 'student'} (${num}) cannot exceed total marks (${maxMarks}).`);
          return;
        }
        records.push({
          student_id: st.student_id,
          marks_obtained: num,
          remarks: remarksState[st.student_id] || null,
        });
      }
    }

    if (records.length === 0) {
      setErr('Please enter marks for at least one student.');
      return;
    }

    setSaving(true);
    setErr('');
    try {
      // Use bulk results endpoint
      await api.post('/results/bulk', {
        exam_subject_id: selectedExamSubId,
        records,
      });

      success(`Successfully saved marks for ${records.length} student(s)!`);
      onSaved();
      onClose();
    } catch (e) {
      const msg = e.response?.data?.message || e.message || 'Failed to save marks.';
      setErr(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Enter & Record Examination Marks</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleBatchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 24px 24px' }}>
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
                <span><strong>{windowStatus.isOpen ? 'Grading Window Open' : 'Grading Window Closed'}:</strong> {windowStatus.reason}</span>
              </div>
            </div>
          )}

          {err && (
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={15} /> {err}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <div>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 6 }}>
                Examination *
              </label>
              <select
                className="form-input"
                value={examId}
                onChange={e => setExamId(e.target.value)}
                required
              >
                <option value="">-- Select Exam --</option>
                {(Array.isArray(exams) ? exams : []).map(e => <option key={e.id} value={e.id}>{e.exam_name}</option>)}
              </select>
            </div>

            <div>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 6 }}>
                Subject *
              </label>
              <select
                className="form-input"
                value={selectedExamSubId}
                onChange={e => setSelectedExamSubId(e.target.value)}
                required
                disabled={(Array.isArray(examSubjects) ? examSubjects : []).length === 0}
              >
                <option value="">-- Select Subject --</option>
                {(Array.isArray(examSubjects) ? examSubjects : []).map(es => (
                  <option key={es.id} value={es.id}>
                    {es.subject_name} ({es.subject_code || 'SUB'})
                  </option>
                ))}
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
                disabled={!classId || (Array.isArray(sections) ? sections : []).length === 0}
              >
                <option value="">-- Select Section --</option>
                {(Array.isArray(sections) ? sections : []).map(s => <option key={s.id} value={s.id}>{s.section_name}</option>)}
              </select>
            </div>
          </div>

          {selectedEs && (
            <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Paper: <strong>{selectedEs.subject_name}</strong></span>
              <span>Total Marks: <strong>{maxMarks}</strong> | Passing Marks: <strong>{passingMarks}</strong></span>
            </div>
          )}

          {/* Student Roster Marks Input */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                Enrolled Class Students ({students.length})
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Values autosave grade & pass status
              </span>
            </div>

            {loadingMeta ? (
              <p style={{ textAlign: 'center', padding: '20px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Loading students and existing scores...
              </p>
            ) : students.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  No students enrolled in this section.
                </div>
              </div>
            ) : (
              <div style={{ maxHeight: 290, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
                {(Array.isArray(students) ? students : []).map((st, idx) => {
                  const sName = st.student_name || `${st.first_name || ''} ${st.last_name || ''}`.trim() || `Student #${idx + 1}`;
                  const currentVal = marksState[st.student_id] || '';
                  const numVal = parseFloat(currentVal);
                  const preview = !isNaN(numVal) ? calculateGrade(numVal, maxMarks, passingMarks) : null;
                  const isExisting = !!existingResults[st.student_id];

                  return (
                    <div
                      key={st.student_id || idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.4fr 110px 90px 1.2fr',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 14px',
                        backgroundColor: 'var(--bg-muted)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                          {sName}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          ID: {st.admission_number || st.student_id?.slice(0, 8)} {isExisting ? '• (Recorded)' : ''}
                        </div>
                      </div>

                      <div>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max={maxMarks}
                          placeholder={`/ ${maxMarks}`}
                          className="form-input"
                          style={{ padding: '6px 8px', fontSize: '0.82rem' }}
                          value={currentVal}
                          onChange={e => setMarksState(prev => ({ ...prev, [st.student_id]: e.target.value }))}
                        />
                      </div>

                      <div>
                        {preview ? (
                          <span className={`badge ${preview.status === 'pass' ? 'badge-emerald' : 'badge-red'}`} style={{ fontSize: '0.72rem', padding: '3px 6px' }}>
                            {preview.grade} ({preview.pct}%)
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </div>

                      <div>
                        <input
                          type="text"
                          placeholder="Remarks..."
                          className="form-input"
                          style={{ padding: '6px 8px', fontSize: '0.78rem' }}
                          value={remarksState[st.student_id] || ''}
                          onChange={e => setRemarksState(prev => ({ ...prev, [st.student_id]: e.target.value }))}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving || students.length === 0 || (isTeacher && windowStatus && !windowStatus.isOpen)}>
              <Save size={14} /> {saving ? 'Saving...' : 'Save Examination Results'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Results Page ────────────────────────────────────────────────────────
export default function ResultsPage() {
  const { user } = useAuth();
  const role = (user?.role || '').toLowerCase();
  const isTeacher = role === 'teacher';
  const isAdmin = role === 'admin';
  const isStaff = isAdmin || isTeacher;

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [windowPolicy, setWindowPolicy] = useState(null);

  // Filter options loaded from database
  const [academicYears, setAcademicYears] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);

  // Active filters
  const [selectedAy, setSelectedAy] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // View & Sorting & Pagination
  const [viewMode, setViewMode] = useState('table');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);

  // Modals state
  const [enterMarksOpen, setEnterMarksOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [correctionTarget, setCorrectionTarget] = useState(null);
  const [reviewCorrectionsOpen, setReviewCorrectionsOpen] = useState(false);
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { success, error: toastError } = useToast();

  // Load grading window policy
  const fetchGradingWindow = useCallback(async () => {
    try {
      const { data } = await api.get('/deadlines/grading-window');
      if (data.success) {
        setWindowPolicy(data.data);
      }
    } catch (e) {
      console.error('Failed to load grading window policy:', e);
    }
  }, []);

  // Fetch Filter Dropdowns metadata
  useEffect(() => {
    async function loadFilterMetadata() {
      try {
        const [ayRes, clsRes, exRes, subRes] = await Promise.allSettled([
          api.get('/academic-years?limit=20'),
          isTeacher ? api.get('/teacher-assignments?limit=100') : api.get('/classes?limit=50'),
          api.get('/examinations?limit=50'),
          api.get('/subjects?limit=100'),
        ]);

        if (ayRes.status === 'fulfilled' && ayRes.value.data.success) {
          setAcademicYears(ayRes.value.data.data.academic_years || ayRes.value.data.data.items || ayRes.value.data.data || []);
        }

        if (clsRes.status === 'fulfilled' && clsRes.value.data.success) {
          if (isTeacher) {
            const list = clsRes.value.data.data.assignments || clsRes.value.data.data.items || clsRes.value.data.data || [];
            const uniqueClasses = {};
            list.forEach(a => {
              if (a.class_id && !uniqueClasses[a.class_id]) {
                uniqueClasses[a.class_id] = { id: a.class_id, class_name: a.class_name };
              }
            });
            setClasses(Object.values(uniqueClasses));
          } else {
            setClasses(clsRes.value.data.data.classes || clsRes.value.data.data.items || clsRes.value.data.data || []);
          }
        }

        if (exRes.status === 'fulfilled' && exRes.value.data.success) {
          setExams(exRes.value.data.data.examinations || exRes.value.data.data.items || exRes.value.data.data || []);
        }

        if (subRes.status === 'fulfilled' && subRes.value.data.success) {
          setSubjects(subRes.value.data.data.subjects || subRes.value.data.data.items || subRes.value.data.data || []);
        }
      } catch (err) {
        console.error('Failed to load filter metadata:', err);
      }
    }
    loadFilterMetadata();
    fetchGradingWindow();
  }, [isTeacher, fetchGradingWindow]);

  // Load sections when class filter changes
  useEffect(() => {
    if (!selectedClass) {
      setSections([]);
      setSelectedSection('');
      return;
    }
    api.get(`/sections?class_id=${selectedClass}&limit=50`)
      .then(({ data }) => {
        if (data.success) {
          setSections(data.data.sections || data.data.items || data.data || []);
        }
      })
      .catch(() => setSections([]));
  }, [selectedClass]);

  // Fetch Results from database
  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });

      if (selectedAy) params.set('academic_year_id', selectedAy);
      if (selectedClass) params.set('class_id', selectedClass);
      if (selectedSection) params.set('section_id', selectedSection);
      if (selectedExam) params.set('exam_id', selectedExam);
      if (selectedSubject) params.set('subject_id', selectedSubject);
      if (selectedStatus) params.set('result_status', selectedStatus);
      if (search) params.set('search', search);

      const { data } = await api.get(`/results?${params}`);
      if (data.success) {
        setResults(data.data.results || data.data.items || data.data || []);
        setTotal(data.data.pagination?.total || data.data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load examination results:', err);
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, selectedAy, selectedClass, selectedSection, selectedExam, selectedSubject, selectedStatus, search]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Delete result handler
  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data } = await api.delete(`/results/${deleteTarget.id}`);
      if (data.success) {
        success('Result record deleted successfully.');
        setDeleteTarget(null);
        fetchResults();
      }
    } catch (e) {
      toastError(e.response?.data?.message || 'Failed to delete result record.');
    } finally {
      setDeleting(false);
    }
  }

  // Sorting
  const sortedResults = useMemo(() => {
    const list = [...results];
    return list.sort((a, b) => {
      let aVal = '';
      let bVal = '';

      if (sortBy === 'name') {
        aVal = a.student_name || `${a.student_first_name || ''} ${a.student_last_name || ''}`.trim();
        bVal = b.student_name || `${b.student_first_name || ''} ${b.student_last_name || ''}`.trim();
      } else if (sortBy === 'marks') {
        aVal = Number(a.marks_obtained || 0);
        bVal = Number(b.marks_obtained || 0);
      } else if (sortBy === 'pct') {
        aVal = (Number(a.marks_obtained || 0) / (Number(a.total_marks || 100))) * 100;
        bVal = (Number(b.marks_obtained || 0) / (Number(b.total_marks || 100))) * 100;
      } else if (sortBy === 'grade') {
        aVal = a.grade || '';
        bVal = b.grade || '';
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [results, sortBy, sortDir]);

  function toggleSort(field) {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  }

  // Dynamic Statistics
  const stats = useMemo(() => {
    const count = results.length;
    if (count === 0) return { count: 0, avgMarks: 0, passed: 0, failed: 0, passPct: 0 };

    let totalMarks = 0;
    let totalMax = 0;
    let passCount = 0;
    let failCount = 0;

    results.forEach(r => {
      const m = Number(r.marks_obtained || 0);
      const mx = Number(r.total_marks || 100);
      totalMarks += m;
      totalMax += mx;
      if (r.result_status === 'pass') passCount++;
      else failCount++;
    });

    const avgMarks = Math.round((totalMarks / count) * 10) / 10;
    const avgPct = totalMax > 0 ? Math.round((totalMarks / totalMax) * 100) : 0;
    const passPct = Math.round((passCount / count) * 100);

    return { count, avgMarks, avgPct, passed: passCount, failed: failCount, passPct };
  }, [results]);

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Results & Gradebook
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 2 }}>
            {isTeacher
              ? 'Enter, calculate, and review examination grades for your assigned curriculum subjects.'
              : 'Track school examination marks, auto-compute grades, enforce grading deadlines, and review correction requests.'}
          </p>
        </div>

        {isStaff && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setReviewCorrectionsOpen(true)}
              title="Review mark change requests with audit trail"
            >
              <FileText size={15} /> Correction Requests
            </button>

            {isAdmin && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPolicyModalOpen(true)}
                title="Configure post-exam grading deadline policy"
              >
                <Settings size={15} /> Grading Window Policy
              </button>
            )}

            <button
              className="btn btn-primary btn-sm"
              onClick={() => setEnterMarksOpen(true)}
            >
              <PlusCircle size={15} /> Enter Marks
            </button>
          </div>
        )}
      </div>

      {/* Grading Window Policy Banner */}
      {windowPolicy && (
        <div style={{
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'rgba(2, 132, 199, 0.08)',
          border: '1px solid rgba(2, 132, 199, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Award size={18} color="var(--sky-600, #0284c7)" />
            <div>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                School Grading Policy: {windowPolicy.windowDays || 14}-Day Window ({windowPolicy.timezone || 'Asia/Kolkata'})
              </span>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Teachers enter scores within {windowPolicy.windowDays || 14} days of exam completion. Published scores after closure require admin correction approval.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="badge badge-sky">Audit Trail Enabled</span>
          </div>
        </div>
      )}

      {/* KPI Dynamic Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
        {[
          { label: 'Total Results', value: total, icon: <Award size={20} />, bg: 'var(--primary-light)', fg: 'var(--primary)', valColor: 'var(--text-primary)' },
          { label: 'Passed Students', value: stats.passed, icon: <CheckCircle size={20} />, bg: 'var(--success-light)', fg: 'var(--success)', valColor: 'var(--success)' },
          { label: 'Failed Students', value: stats.failed, icon: <XCircle size={20} />, bg: 'var(--danger-light)', fg: 'var(--danger)', valColor: 'var(--danger)' },
          { label: 'Average Score', value: `${stats.avgMarks} pts`, icon: <TrendingUp size={20} />, bg: 'var(--warning-light)', fg: 'var(--warning)', valColor: 'var(--warning)' },
          { label: 'Pass Rate', value: `${stats.passPct}%`, icon: <Check size={20} />, bg: 'var(--primary-light)', fg: 'var(--primary)', valColor: stats.passPct >= 80 ? 'var(--success)' : 'var(--warning)' },
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

      {/* Filter and Control Bar */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div className="search-input-wrapper" style={{ flex: 1, minWidth: 240 }}>
            <Search size={15} />
            <input
              type="text"
              className="form-input"
              placeholder="Search student name, roll number, admission ID..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              style={{ paddingLeft: 34 }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '5px 8px' }}
              onClick={() => setViewMode('table')}
              title="Table Spreadsheet View"
            >
              <List size={14} />
            </button>
            <button
              type="button"
              className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '5px 8px' }}
              onClick={() => setViewMode('cards')}
              title="Card Report Cards View"
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>

        {/* Dynamic Filters Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, alignItems: 'center' }}>
          <select
            className="form-input"
            value={selectedAy}
            onChange={e => { setSelectedAy(e.target.value); setPage(1); }}
          >
            <option value="">All Academic Years</option>
            {(Array.isArray(academicYears) ? academicYears : []).map(ay => (
              <option key={ay.id} value={ay.id}>{ay.year_name || ay.name}</option>
            ))}
          </select>

          <select
            className="form-input"
            value={selectedClass}
            onChange={e => { setSelectedClass(e.target.value); setSelectedSection(''); setPage(1); }}
          >
            <option value="">{isTeacher ? 'My Classes (All)' : 'All Classes'}</option>
            {(Array.isArray(classes) ? classes : []).map(c => (
              <option key={c.id} value={c.id}>{c.class_name}</option>
            ))}
          </select>

          <select
            className="form-input"
            value={selectedSection}
            onChange={e => { setSelectedSection(e.target.value); setPage(1); }}
            disabled={!selectedClass || (Array.isArray(sections) ? sections : []).length === 0}
          >
            <option value="">All Sections</option>
            {(Array.isArray(sections) ? sections : []).map(s => (
              <option key={s.id} value={s.id}>{s.section_name}</option>
            ))}
          </select>

          <select
            className="form-input"
            value={selectedExam}
            onChange={e => { setSelectedExam(e.target.value); setPage(1); }}
          >
            <option value="">All Examinations</option>
            {(Array.isArray(exams) ? exams : []).map(e => (
              <option key={e.id} value={e.id}>{e.exam_name}</option>
            ))}
          </select>

          <select
            className="form-input"
            value={selectedSubject}
            onChange={e => { setSelectedSubject(e.target.value); setPage(1); }}
          >
            <option value="">All Subjects</option>
            {(Array.isArray(subjects) ? subjects : []).map(s => (
              <option key={s.id} value={s.id}>{s.subject_name}</option>
            ))}
          </select>

          <select
            className="form-input"
            value={selectedStatus}
            onChange={e => { setSelectedStatus(e.target.value); setPage(1); }}
          >
            <option value="">All Statuses</option>
            <option value="pass">Passed</option>
            <option value="fail">Failed</option>
          </select>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSelectedAy('');
              setSelectedClass('');
              setSelectedSection('');
              setSelectedExam('');
              setSelectedSubject('');
              setSelectedStatus('');
              setSearchInput('');
              setSearch('');
              setPage(1);
            }}
            title="Reset Filters"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Main Results Data Table / Cards */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              Database Examination Results
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 8 }}>
              Showing {sortedResults.length} of {total} records
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 20 }}>
            <TableSkeleton rows={8} />
          </div>
        ) : sortedResults.length === 0 ? (
          <EmptyState
            icon={Award}
            title="No Examination Results Found"
            description={
              search || selectedClass || selectedExam || selectedSubject
                ? "No result records match your selected filter criteria. Try clearing filters or entering new student scores."
                : "No examination results published yet. Click below to enter results for an examination."
            }
            actionText={isStaff ? "Enter Examination Marks" : undefined}
            onAction={isStaff ? () => setEnterMarksOpen(true) : undefined}
          />
        ) : viewMode === 'table' ? (
          <>
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('name')}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        Student Name {sortBy === 'name' && <ArrowUpDown size={12} />}
                      </span>
                    </th>
                    <th>Roll / ID</th>
                    <th>Class & Section</th>
                    <th>Examination</th>
                    <th>Subject</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('marks')}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        Marks Scored {sortBy === 'marks' && <ArrowUpDown size={12} />}
                      </span>
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('pct')}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        Percentage {sortBy === 'pct' && <ArrowUpDown size={12} />}
                      </span>
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('grade')}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        Grade {sortBy === 'grade' && <ArrowUpDown size={12} />}
                      </span>
                    </th>
                    {isStaff && <th style={{ textAlign: 'right' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(sortedResults) ? sortedResults : []).map((r, idx) => {
                    const studentName = r.student_name || `${r.student_first_name || ''} ${r.student_last_name || ''}`.trim() || `Student #${idx + 1}`;
                    const marks = Number(r.marks_obtained ?? r.marks ?? 0);
                    const max = Number(r.total_marks ?? r.max_marks ?? 100);
                    const pct = max > 0 ? Math.round((marks / max) * 100) : 0;
                    const roll = r.student_number || r.student_id?.slice(0, 8) || '—';
                    const classInfo = `${r.class_name || 'Class'} ${r.section_name ? `• Sec ${r.section_name}` : ''}`;

                    return (
                      <tr key={r.id || idx}>
                        <td>
                          <div className="td-main">{studentName}</div>
                        </td>
                        <td>
                          <code style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.78rem' }}>{roll}</code>
                        </td>
                        <td style={{ fontSize: '0.82rem' }}>{classInfo}</td>
                        <td style={{ fontSize: '0.82rem' }}>{r.exam_name || '—'}</td>
                        <td>
                          <span className="badge badge-slate">{r.subject_name || 'General'}</span>
                        </td>
                        <td style={{ fontWeight: 700 }}>
                          {marks} <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.75rem' }}>/ {max}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, backgroundColor: 'var(--bg-muted)', borderRadius: 3, overflow: 'hidden', minWidth: 60 }}>
                              <div
                                style={{
                                  width: `${pct}%`,
                                  height: '100%',
                                  backgroundColor: pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)',
                                  transition: 'width 0.5s ease',
                                }}
                              />
                            </div>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, minWidth: 32 }}>{pct}%</span>
                          </div>
                        </td>
                        <td>
                          <GradePill grade={r.grade} isPass={r.result_status === 'pass'} />
                        </td>
                        {isStaff && (
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                title="Edit Result Score"
                                style={{ padding: '3px 7px' }}
                                onClick={() => setEditTarget(r)}
                              >
                                <Edit2 size={12} />
                              </button>
                              {isTeacher && (
                                <button
                                  className="btn btn-secondary btn-sm"
                                  title="Request Mark Correction via Admin Audit"
                                  style={{ padding: '3px 7px', color: 'var(--primary)' }}
                                  onClick={() => setCorrectionTarget(r)}
                                >
                                  <AlertTriangle size={12} />
                                </button>
                              )}
                              {isAdmin && (
                                <button
                                  className="btn btn-secondary btn-sm"
                                  title="Delete Result Record"
                                  style={{ padding: '3px 7px', color: 'var(--danger)' }}
                                  onClick={() => setDeleteTarget(r)}
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>Showing page {page} of {totalPages} ({total} result records)</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft size={14} /> Prev
                  </button>
                  <button className="btn btn-secondary btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Cards / Grid View */
          <div style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {(Array.isArray(sortedResults) ? sortedResults : []).map((r, idx) => {
                const sName = r.student_name || `${r.student_first_name || ''} ${r.student_last_name || ''}`.trim() || `Student #${idx + 1}`;
                const marks = Number(r.marks_obtained ?? r.marks ?? 0);
                const max = Number(r.total_marks ?? r.max_marks ?? 100);
                const pct = max > 0 ? Math.round((marks / max) * 100) : 0;
                const roll = r.student_number || r.student_id?.slice(0, 8) || '—';

                return (
                  <div
                    key={r.id || idx}
                    className="card"
                    style={{
                      padding: '16px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      borderLeft: `4px solid ${r.result_status === 'pass' ? 'var(--primary)' : 'var(--danger)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>{sName}</h4>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          ID: {roll} • {r.class_name} {r.section_name ? `(${r.section_name})` : ''}
                        </div>
                      </div>
                      <GradePill grade={r.grade} isPass={r.result_status === 'pass'} />
                    </div>

                    <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{r.exam_name}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        Paper: <strong>{r.subject_name}</strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Score</span>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {marks} <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400 }}>/ {max}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Percentage</span>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: pct >= 50 ? 'var(--primary)' : 'var(--danger)' }}>
                          {pct}%
                        </div>
                      </div>
                    </div>

                    {isStaff && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                          onClick={() => setEditTarget(r)}
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                        {isTeacher && (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem', padding: '4px 8px', color: 'var(--primary)' }}
                            onClick={() => setCorrectionTarget(r)}
                          >
                            <AlertTriangle size={12} /> Request Fix
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem', padding: '4px 8px', color: 'var(--danger)' }}
                            onClick={() => setDeleteTarget(r)}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddResultModal
        open={enterMarksOpen}
        exams={exams}
        onClose={() => setEnterMarksOpen(false)}
        onSaved={fetchResults}
        isTeacher={isTeacher}
      />

      <EditResultModal
        open={!!editTarget}
        result={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={fetchResults}
        isLocked={windowPolicy && !windowPolicy.isOpen}
        isTeacher={isTeacher}
        onOpenCorrection={(res) => setCorrectionTarget(res)}
      />

      <RequestMarkCorrectionModal
        open={!!correctionTarget}
        result={correctionTarget}
        onClose={() => setCorrectionTarget(null)}
        onSubmitted={fetchResults}
      />

      <ReviewMarkCorrectionsModal
        open={reviewCorrectionsOpen}
        onClose={() => setReviewCorrectionsOpen(false)}
        onReviewed={fetchResults}
        isAdmin={isAdmin}
      />

      <ConfigureGradingDeadlineModal
        open={policyModalOpen}
        onClose={() => setPolicyModalOpen(false)}
        onSaved={fetchGradingWindow}
      />

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Confirm Result Record Deletion</h2>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Are you sure you want to delete the result record for{' '}
                <strong>{deleteTarget.student_name || `${deleteTarget.student_first_name || ''} ${deleteTarget.student_last_name || ''}`}</strong>{' '}
                in <strong>{deleteTarget.subject_name}</strong>? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                  Cancel
                </button>
                <button className="btn btn-primary" style={{ backgroundColor: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={handleDeleteConfirm} disabled={deleting}>
                  {deleting ? 'Deleting...' : 'Delete Result Record'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
