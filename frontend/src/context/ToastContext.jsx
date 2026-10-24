import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const ICONS = {
  success: <CheckCircle2 size={18} style={{ color: 'var(--success)', flexShrink: 0 }} />,
  error:   <XCircle size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />,
  warning: <AlertTriangle size={18} style={{ color: 'var(--warning)', flexShrink: 0 }} />,
  info:    <Info size={18} style={{ color: 'var(--info)', flexShrink: 0 }} />,
};

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(prev =>
      prev.map(t => t.id === id ? { ...t, removing: true } : t)
    );
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 350);
  }, []);

  const toast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++idCounter;
    setToasts(prev => [...prev, { id, message, type, removing: false }]);
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  const success = useCallback((msg, d) => toast(msg, 'success', d), [toast]);
  const error   = useCallback((msg, d) => toast(msg, 'error', d), [toast]);
  const warning = useCallback((msg, d) => toast(msg, 'warning', d), [toast]);
  const info    = useCallback((msg, d) => toast(msg, 'info', d), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info, dismiss }}>
      {children}
      {/* Toast container */}
      <div className="toast-container">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`toast toast-${t.type} ${t.removing ? 'removing' : ''}`}
            role="alert"
            aria-live="polite"
          >
            {ICONS[t.type]}
            <span style={{ flex: 1, lineHeight: 1.4 }}>{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: '2px',
                display: 'flex',
                borderRadius: '4px',
                flexShrink: 0,
              }}
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
