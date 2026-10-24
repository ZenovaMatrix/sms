import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  LayoutDashboard,
  Users,
  GraduationCap,
  Calendar,
  Layers,
  BookOpen,
  ClipboardList,
  CheckSquare,
  FileSpreadsheet,
  Award,
  CreditCard,
  Settings,
  Bell,
  X,
} from 'lucide-react';

const SEARCH_ITEMS = [
  { title: 'Dashboard', category: 'Navigation', icon: LayoutDashboard, path: '/' },
  { title: 'Students Directory', category: 'Academics', icon: GraduationCap, path: '/students' },
  { title: 'Teachers & Faculty', category: 'Academics', icon: Users, path: '/teachers' },
  { title: 'Classes & Sections', category: 'Academics', icon: Layers, path: '/classes' },
  { title: 'Curriculum Subjects', category: 'Academics', icon: BookOpen, path: '/subjects' },
  { title: 'Academic Years', category: 'Academics', icon: Calendar, path: '/academic-years' },
  { title: 'Student Enrollments', category: 'Academics', icon: ClipboardList, path: '/enrollments' },
  { title: 'Daily Attendance', category: 'Operations', icon: CheckSquare, path: '/attendance' },
  { title: 'Examinations Schedule', category: 'Operations', icon: FileSpreadsheet, path: '/examinations' },
  { title: 'Results & Gradebook', category: 'Operations', icon: Award, path: '/results' },
  { title: 'Fee Management', category: 'Finance', icon: CreditCard, path: '/fees' },
  { title: 'Parents & Guardians', category: 'People', icon: Users, path: '/parents' },
  { title: 'Announcements', category: 'Communication', icon: Bell, path: '/announcements' },
  { title: 'System Settings', category: 'Admin', icon: Settings, path: '/settings' },
];

export default function CommandPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        onClose(prev => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        onClose(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filtered = query.trim() === ''
    ? SEARCH_ITEMS
    : SEARCH_ITEMS.filter(item =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.category.toLowerCase().includes(query.toLowerCase())
      );

  function handleSelect(path) {
    navigate(path);
    onClose(false);
    setQuery('');
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="modal-backdrop" onClick={() => onClose(false)}>
          <motion.div
            className="modal-card"
            style={{ maxWidth: 540, overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <Search size={20} color="var(--text-muted)" />
              <input
                autoFocus
                placeholder="Search pages, students, modules (e.g. Attendance)..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '0.95rem',
                  color: 'var(--text-primary)',
                }}
              />
              <button
                type="button"
                className="icon-btn btn-sm"
                onClick={() => onClose(false)}
                style={{ width: 28, height: 28 }}
              >
                <X size={14} />
              </button>
            </div>

            <div style={{ maxHeight: 360, overflowY: 'auto', padding: '10px 14px' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No results found for "{query}"
                </div>
              ) : (
                filtered.map((item, idx) => {
                  const ItemIcon = item.icon;
                  return (
                    <div
                      key={idx}
                      onClick={() => handleSelect(item.path)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        transition: 'var(--transition-fast)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--primary-light)',
                          color: 'var(--primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <ItemIcon size={16} />
                        </div>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {item.title}
                        </span>
                      </div>
                      <span className="badge badge-slate" style={{ fontSize: '0.7rem' }}>
                        {item.category}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{
              padding: '10px 20px',
              borderTop: '1px solid var(--border)',
              backgroundColor: 'var(--bg-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
            }}>
              <span>Navigation shortcut: <kbd style={{ padding: '2px 4px', background: 'var(--bg-surface)', borderRadius: 4, border: '1px solid var(--border)' }}>Ctrl + K</kbd></span>
              <span>Press <kbd style={{ padding: '2px 4px', background: 'var(--bg-surface)', borderRadius: 4, border: '1px solid var(--border)' }}>Esc</kbd> to exit</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
