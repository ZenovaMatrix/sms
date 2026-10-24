import { createContext, useContext, useState, useCallback } from 'react';

const MobileSidebarContext = createContext({ open: false, toggle: () => {}, close: () => {} });

export function useMobileSidebar() {
  return useContext(MobileSidebarContext);
}

export function MobileSidebarProvider({ children }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen(v => !v), []);
  const close  = useCallback(() => setOpen(false), []);
  return (
    <MobileSidebarContext.Provider value={{ open, toggle, close }}>
      {children}
    </MobileSidebarContext.Provider>
  );
}
