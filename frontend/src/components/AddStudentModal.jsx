import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, ArrowRight, ArrowLeft, User, Users, GraduationCap, Phone, ShieldCheck } from 'lucide-react';
import api from '../api/api';
import { useToast } from '../context/ToastContext';

const STEPS = [
  { id: 1, title: 'Personal Info', icon: User },
  { id: 2, title: 'Parent / Guardian', icon: Users },
  { id: 3, title: 'Academic Setup', icon: GraduationCap },
  { id: 4, title: 'Contact Details', icon: Phone },
  { id: 5, title: 'Review & Submit', icon: ShieldCheck },
];

export default function AddStudentModal({ isOpen, onClose, onCreated }) {
  const toast = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    gender: 'male',
    dob: '',
    bloodGroup: 'O+',
    parentName: '',
    parentEmail: '',
    parentPhone: '',
    parentRelation: 'Father',
    gradeLevel: 'Grade 10',
    section: 'A',
    admissionDate: new Date().toISOString().split('T')[0],
    email: '',
    phone: '',
    address: '',
    emergencyContact: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  function handleChange(field, val) {
    setFormData(prev => ({ ...prev, [field]: val }));
  }

  function handleNext(e) {
    e.preventDefault();
    if (currentStep < 5) {
      setCurrentStep(s => s + 1);
    }
  }

  function handlePrev() {
    if (currentStep > 1) {
      setCurrentStep(s => s - 1);
    }
  }

  async function handleSubmit() {
    setLoading(true);
    setError('');
    try {
      const payload = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        gender: formData.gender,
        date_of_birth: formData.dob || undefined,
        phone: formData.phone || undefined,
        address: formData.address || undefined,
        email: formData.email,
        blood_group: formData.bloodGroup,
        enrollment_date: formData.admissionDate,
      };

      await api.post('/students', payload);
      toast.success(`Student ${formData.firstName} registered successfully!`);

      if (onCreated) onCreated();
      onClose();
      setCurrentStep(1);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to register student. Please check the information.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div
        className="modal-card"
        style={{ maxWidth: 680 }}
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
      >
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Student Admission Registration</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Step {currentStep} of 5: {STEPS[currentStep - 1].title}</p>
          </div>
          <button type="button" className="icon-btn btn-sm" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        {/* Wizard Step Progression Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-muted)',
        }}>
          {STEPS.map((step) => {
            const isDone = currentStep > step.id;
            const isCurrent = currentStep === step.id;
            const StepIcon = step.icon;

            return (
              <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: isCurrent || isDone ? 1 : 0.5 }}>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  backgroundColor: isDone ? 'var(--success)' : isCurrent ? 'var(--primary)' : 'var(--border)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}>
                  {isDone ? <Check size={14} /> : <StepIcon size={13} />}
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: isCurrent ? 700 : 500, color: 'var(--text-primary)', display: window.innerWidth < 640 ? 'none' : 'inline' }}>
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>

        <div className="modal-body">
          {error && (
            <div style={{
              padding: '10px 14px',
              backgroundColor: 'var(--danger-light)',
              color: 'var(--danger)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8rem',
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {currentStep === 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">First Name *</label>
                <input
                  required
                  className="form-input"
                  placeholder="e.g. Rahul"
                  value={formData.firstName}
                  onChange={e => handleChange('firstName', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name *</label>
                <input
                  required
                  className="form-input"
                  placeholder="e.g. Sharma"
                  value={formData.lastName}
                  onChange={e => handleChange('lastName', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Gender</label>
                <select
                  className="form-select"
                  value={formData.gender}
                  onChange={e => handleChange('gender', e.target.value)}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date of Birth</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.dob}
                  onChange={e => handleChange('dob', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Blood Group</label>
                <select
                  className="form-select"
                  value={formData.bloodGroup}
                  onChange={e => handleChange('bloodGroup', e.target.value)}
                >
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Student Email *</label>
                <input
                  type="email"
                  required
                  className="form-input"
                  placeholder="student@school.edu"
                  value={formData.email}
                  onChange={e => handleChange('email', e.target.value)}
                />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Guardian Full Name *</label>
                <input
                  required
                  className="form-input"
                  placeholder="e.g. Vikram Sharma"
                  value={formData.parentName}
                  onChange={e => handleChange('parentName', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Relationship</label>
                <select
                  className="form-select"
                  value={formData.parentRelation}
                  onChange={e => handleChange('parentRelation', e.target.value)}
                >
                  <option value="Father">Father</option>
                  <option value="Mother">Mother</option>
                  <option value="Guardian">Legal Guardian</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Guardian Email</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="parent@example.com"
                  value={formData.parentEmail}
                  onChange={e => handleChange('parentEmail', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Guardian Phone *</label>
                <input
                  type="tel"
                  required
                  className="form-input"
                  placeholder="+1 (555) 019-2834"
                  value={formData.parentPhone}
                  onChange={e => handleChange('parentPhone', e.target.value)}
                />
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Grade / Class</label>
                <select
                  className="form-select"
                  value={formData.gradeLevel}
                  onChange={e => handleChange('gradeLevel', e.target.value)}
                >
                  <option value="Grade 6">Grade 6</option>
                  <option value="Grade 7">Grade 7</option>
                  <option value="Grade 8">Grade 8</option>
                  <option value="Grade 9">Grade 9</option>
                  <option value="Grade 10">Grade 10</option>
                  <option value="Grade 11">Grade 11</option>
                  <option value="Grade 12">Grade 12</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Section / Division</label>
                <select
                  className="form-select"
                  value={formData.section}
                  onChange={e => handleChange('section', e.target.value)}
                >
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                  <option value="C">Section C</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Admission Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.admissionDate}
                  onChange={e => handleChange('admissionDate', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Academic Year</label>
                <input
                  disabled
                  className="form-input"
                  value="2026–2027 Session"
                  style={{ opacity: 0.7 }}
                />
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Student Phone</label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="+1 (555) 234-5678"
                  value={formData.phone}
                  onChange={e => handleChange('phone', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Emergency Contact Number</label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="+1 (555) 999-0000"
                  value={formData.emergencyContact}
                  onChange={e => handleChange('emergencyContact', e.target.value)}
                />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Residential Address</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Street address, city, state, postal code"
                  value={formData.address}
                  onChange={e => handleChange('address', e.target.value)}
                />
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 14 }}>Review Summary</h4>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                backgroundColor: 'var(--bg-muted)',
                padding: 16,
                borderRadius: 'var(--radius-lg)',
              }}>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Student Name</span>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formData.firstName} {formData.lastName || '—'}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Class & Section</span>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formData.gradeLevel} - {formData.section}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Email</span>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formData.email || '—'}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Guardian</span>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formData.parentName || '—'} ({formData.parentRelation})</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Gender & Blood</span>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{formData.gender} • {formData.bloodGroup}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Admission Date</span>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formData.admissionDate}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {currentStep > 1 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handlePrev}
            >
              <ArrowLeft size={14} /> Back
            </button>
          )}

          {currentStep < 5 ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleNext}
            >
              Continue <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={loading}
              onClick={handleSubmit}
            >
              {loading ? 'Submitting Registration…' : 'Complete Admission'}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
