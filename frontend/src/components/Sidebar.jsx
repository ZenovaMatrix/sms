import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMobileSidebar } from '../context/MobileSidebarContext';
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  UserCheck,
  Calendar,
  Layers,
  BookOpen,
  ClipboardList,
  CheckSquare,
  FileSpreadsheet,
  Award,
  CreditCard,
  Bell,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

const NAV_GROUPS = [
  {
    group: 'MAIN',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    ],
  },
  {
    group: 'ACADEMICS',
    items: [
      { path: '/students', label: 'Students', icon: GraduationCap },
      { path: '/teachers', label: 'Teachers', icon: Users },
      { path: '/classes', label: 'Classes & Sections', icon: Layers },
      { path: '/subjects', label: 'Subjects', icon: BookOpen },
      { path: '/enrollments', label: 'Enrollments', icon: ClipboardList },
      { path: '/academic-years', label: 'Academic Years', icon: Calendar },
    ],
  },
  {
    group: 'OPERATIONS',
    items: [
      { path: '/attendance', label: 'Attendance', icon: CheckSquare },
      { path: '/examinations', label: 'Examinations', icon: FileSpreadsheet },
      { path: '/results', label: 'Results & Grades', icon: Award },
      { path: '/fees', label: 'Fee Management', icon: CreditCard },
      { path: '/parents', label: 'Parents & Guardians', icon: UserCheck },
    ],
  },
  {
    group: 'COMMUNICATION',
    items: [
      { path: '/announcements', label: 'Announcements', icon: Bell },
    ],
  },
  {
    group: 'SYSTEM',
    items: [
      { path: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

const ROLE_PERMISSIONS = {
  admin: null,
  teacher: ['Dashboard', 'Students', 'Classes & Sections', 'Subjects', 'Attendance', 'Examinations', 'Results & Grades', 'Announcements'],
  student: ['Dashboard', 'Enrollments', 'Attendance', 'Results & Grades', 'Announcements'],
  parent: ['Dashboard', 'Attendance', 'Results & Grades', 'Fee Management', 'Announcements'],
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { open, close } = useMobileSidebar();
  const [collapsed, setCollapsed] = useState(false);

  const role = user?.role || 'admin';
  const allowed = ROLE_PERMISSIONS[role];

  const filteredGroups = NAV_GROUPS.map(grp => ({
    ...grp,
    items: grp.items.filter(item => !allowed || allowed.includes(item.label)),
  })).filter(g => g.items.length > 0);

  const handleNavClick = () => {
    // Close mobile sidebar when a nav item is clicked
    close();
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${open ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        <NavLink to="/" className="sidebar-brand" onClick={handleNavClick}>
          <div className="brand-icon-box">
            <ShieldCheck size={22} />
          </div>
          {!collapsed && (
            <div className="brand-info">
              <span className="brand-title">EduManage</span>
              <span className="brand-subtitle">School System</span>
            </div>
          )}
        </NavLink>

        <button
          type="button"
          className="icon-btn btn-sm"
          onClick={() => setCollapsed(prev => !prev)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{ width: 28, height: 28, flexShrink: 0 }}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      {/* User Info */}
      {!collapsed && user && (
        <div style={{
          padding: '0 1rem 1rem',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '0.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'var(--primary-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.875rem',
              fontWeight: 700,
              color: 'var(--primary)',
              flexShrink: 0,
            }}>
              {user?.name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {user?.name || 'Administrator'}
              </div>
              <div style={{
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                textTransform: 'capitalize',
              }}>
                {user?.role || 'admin'}
              </div>
            </div>
          </div>
        </div>
      )}

      <nav className="sidebar-nav">
        {filteredGroups.map(({ group, items }) => (
          <div key={group} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {!collapsed && <div className="nav-group-title">{group}</div>}
            {items.map(({ path, label, icon: Icon, exact }) => (
              <NavLink
                key={path}
                to={path}
                end={exact}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                title={collapsed ? label : undefined}
                onClick={handleNavClick}
              >
                <Icon className="nav-icon" />
                {!collapsed && <span>{label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="nav-link"
          onClick={logout}
          style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--danger)' }}
          title={collapsed ? 'Sign Out' : undefined}
        >
          <LogOut className="nav-icon" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
