import Sidebar from './Sidebar';
import Header from './Header';
import { MobileSidebarProvider, useMobileSidebar } from '../context/MobileSidebarContext';

function LayoutInner({ children }) {
  const { open, close } = useMobileSidebar();
  return (
    <div className="app-shell">
      {/* Mobile overlay backdrop */}
      <div
        className={`sidebar-overlay ${open ? 'open' : ''}`}
        onClick={close}
        aria-hidden="true"
      />
      <Sidebar />
      <div className="main-wrapper">
        <Header />
        <main className="page-content page-enter">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function Layout({ children }) {
  return (
    <MobileSidebarProvider>
      <LayoutInner>{children}</LayoutInner>
    </MobileSidebarProvider>
  );
}
