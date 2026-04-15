import { RouterProvider } from 'react-router';
import { Toaster }        from 'sonner';
import { AuthProvider }   from './context/AuthContext.jsx';
import { SitesProvider }  from './context/SitesContext.jsx';
import { ToastProvider }  from './context/ToastContext.jsx';
import { ErrorBoundary }  from './components/ErrorBoundary.jsx';
import { router }         from './router.jsx';

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
      <AuthProvider>
        <SitesProvider>
          <RouterProvider router={router} />
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background:   'var(--bg-surface)',
                border:       '1px solid var(--border-default)',
                color:        'var(--text-primary)',
                fontSize:     '13px',
              },
            }}
          />
        </SitesProvider>
      </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
