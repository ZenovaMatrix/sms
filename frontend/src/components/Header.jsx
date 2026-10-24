import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useMobileSidebar } from '../context/MobileSidebarContext';
import {
  Search,
  Bell,
  Sun,
  Moon,
  Calendar,
  LogOut,
  ChevronDown,
  Menu,
} from 'lucide-react';
import CommandPalette from './CommandPalette';
import NotificationDropdown from './NotificationDropdown';

const PAGE_TITLES = {
  '/': { title: 'Dashboard Overview', subtitle: 'Academic metrics, admissions & operational status' },
  '/students': { title: 'Student Directory', subtitle: 'Manage student enrollments, profiles & records' },
  '/teachers': { title: 'Faculty & Teachers', subtitle: 'Academic staff, department allocations & qualifications' },
  '/parents': { title: 'Parents & Guardians', subtitle: 'Parent profiles, emergency contacts & linked wards' },
  '/academic-years': { title: 'Academic Years', subtitle: 'Calendar terms, sessions & scheduling periods' },
  '/classes': { title: 'Classes & Sections', subtitle: 'Grade levels, divisions & class teachers' },
  '/subjects': { title: 'Curriculum & Subjects', subtitle: 'Course subjects, credit hours & department mappings' },
  '/enrollments': { title: 'Class Enrollments', subtitle: 'Student class registration & term transfers' },
  '/attendance': { title: 'Attendance Log', subtitle: 'Daily student attendance records & rate summaries' },
  '/examinations': { title: 'Examinations', subtitle: 'Exam timetables, schedules & invigilation rosters' },
  '/results': { title: 'Results & Gradebook', subtitle: 'Scorecards, performance ranking & grade analysis' },
  '/fees': { title: 'Fee & Financial Management', subtitle: 'Tuition fee structures, collection records & receipts' },
  '/announcements': { title: 'Notice Board', subtitle: 'School announcements, circulars & communication' },
  '/settings': { title: 'System Settings', subtitle: 'Institution profile, academic policies & role permissions' },
};

export default function Header() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toggle: toggleMobileSidebar } = useMobileSidebar();

  const [commandOpen, setCommandOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const pathKey = Object.keys(PAGE_TITLES).find(k =>
    k === '/' ? location.pathname === '/' : location.pathname.startsWith(k)
  ) || '/';

  const { title, subtitle } = PAGE_TITLES[pathKey] || { title: 'EduManage', subtitle: '' };

  const initials = user
    ? ((user.firstName || user.name || user.email || 'U').charAt(0)).toUpperCase()
    : 'A';

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          {/* Hamburger – visible only on mobile */}
          <button
            type="button"
            className="icon-btn"
            onClick={toggleMobileSidebar}
            title="Toggle navigation"
            style={{ display: 'none' }}
            id="mobile-menu-btn"
          >
            <Menu size={18} />
          </button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>{title}</h2>
              <div className="academic-badge">
                <Calendar size={12} />
                <span>2026–2027</span>
              </div>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 1 }}>{subtitle}</p>
          </div>
        </div>

        <div className="topbar-right">
          {/* Global Search Command Trigger */}
          <button
            type="button"
            className="command-trigger"
            onClick={() => setCommandOpen(true)}
          >
            <Search size={15} />
            <span>Search anything...</span>
            <kbd className="command-key">Ctrl K</kbd>
          </button>

          {/* Dark / Light Mode Switch */}
          <button
            type="button"
            className="icon-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {/* Notifications Popover */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setNotificationsOpen(prev => !prev)}
              title="Notifications"
            >
              <Bell size={17} />
              <span className="badge-dot" />
            </button>
            <NotificationDropdown
              isOpen={notificationsOpen}
              onClose={() => setNotificationsOpen(false)}
            />
          </div>

          {/* User Profile Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="user-profile-btn"
              onClick={() => setProfileMenuOpen(prev => !prev)}
            >
              <div className="avatar">{initials}</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingRight: 4 }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>
                  {user?.firstName || user?.name || user?.email?.split('@')[0] || 'Admin User'}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-brand)', textTransform: 'capitalize', fontWeight: 600 }}>
                  {user?.role || 'Administrator'}
                </span>
              </div>
              <ChevronDown size={14} color="var(--text-muted)" />
            </button>

            {profileMenuOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 35 }}
                  onClick={() => setProfileMenuOpen(false)}
                />
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: 220,
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-xl)',
                  zIndex: 40,
                  padding: '8px',
                }}>
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 4 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {user?.firstName || user?.email?.split('@')[0] || 'Admin'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {user?.email || 'admin@edumanage.com'}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--danger)', gap: 8 }}
                    onClick={() => {
                      setProfileMenuOpen(false);
                      logout();
                    }}
                  >
                    <LogOut size={15} /> Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Global Command Palette */}
      <CommandPalette isOpen={commandOpen} onClose={setCommandOpen} />
    </>
  );
}
