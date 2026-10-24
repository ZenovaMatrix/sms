import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCheck, CreditCard, Calendar, UserPlus, AlertCircle, X } from 'lucide-react';

const NOTIFICATIONS = [
  {
    id: 1,
    title: 'New Admission Registered',
    desc: 'Aarav Patel has enrolled in Grade 10-A.',
    time: '10m ago',
    unread: true,
    icon: UserPlus,
    color: 'var(--primary)',
  },
  {
    id: 2,
    title: 'Fee Payment Received',
    desc: '$1,250 tuition fee received from Sophia Rodriguez.',
    time: '45m ago',
    unread: true,
    icon: CreditCard,
    color: 'var(--success)',
  },
  {
    id: 3,
    title: 'Grade 10 Midterms Scheduled',
    desc: 'Mathematics exam set for Oct 15, 2026 in Room 302.',
    time: '2h ago',
    unread: false,
    icon: Calendar,
    color: 'var(--secondary)',
  },
  {
    id: 4,
    title: 'Low Attendance Alert',
    desc: 'Class 8-B attendance is below 85% this week.',
    time: '1d ago',
    unread: false,
    icon: AlertCircle,
    color: 'var(--danger)',
  },
];

export default function NotificationDropdown({ isOpen, onClose }) {
  const [list, setList] = useState(NOTIFICATIONS);

  const unreadCount = list.filter(n => n.unread).length;

  function markAllRead() {
    setList(prev => prev.map(n => ({ ...n, unread: false })));
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 35 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: 360,
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-xl)',
              zIndex: 40,
              overflow: 'hidden',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Notifications</span>
                {unreadCount > 0 && (
                  <span className="badge badge-emerald" style={{ fontSize: '0.7rem' }}>
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={markAllRead}
                    style={{ fontSize: '0.75rem', padding: '4px 8px', color: 'var(--primary)' }}
                  >
                    <CheckCheck size={14} /> Mark read
                  </button>
                )}
                <button
                  type="button"
                  className="icon-btn btn-sm"
                  onClick={onClose}
                  style={{ width: 26, height: 26 }}
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            <div style={{ maxHeight: 340, overflowY: 'auto' }}>
              {list.map(n => {
                const NIcon = n.icon;
                return (
                  <div
                    key={n.id}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex',
                      gap: 12,
                      backgroundColor: n.unread ? 'var(--primary-light)' : 'transparent',
                      transition: 'var(--transition-fast)',
                    }}
                  >
                    <div style={{
                      width: 34,
                      height: 34,
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: n.color,
                      flexShrink: 0,
                    }}>
                      <NIcon size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h5 style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{n.title}</h5>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{n.time}</span>
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.3 }}>
                        {n.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{
              padding: '10px',
              textAlign: 'center',
              borderTop: '1px solid var(--border)',
              backgroundColor: 'var(--bg-muted)',
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                School Notification Center
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
