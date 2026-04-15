/**
 * Toast context — thin wrapper around sonner's toast API.
 * Components call useToast() to show notifications.
 */
import { createContext, useContext } from 'react';
import { toast as sonnerToast } from 'sonner';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const toast = {
    success: (msg, opts) => sonnerToast.success(msg, opts),
    error:   (msg, opts) => sonnerToast.error(msg, opts),
    info:    (msg, opts) => sonnerToast.info(msg, opts),
    warn:    (msg, opts) => sonnerToast.warning(msg, opts),
    loading: (msg, opts) => sonnerToast.loading(msg, opts),
    dismiss: (id)        => sonnerToast.dismiss(id),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
