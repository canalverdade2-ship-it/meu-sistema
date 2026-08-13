import { lazy, Suspense, useEffect, useState } from 'react';

const App = lazy(() => import('../App'));

function Fallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
    </div>
  );
}

// Wrapper simples que garante renderização apenas no client-side
function ClientOnly({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return mounted ? <>{children}</> : <>{fallback}</>;
}

export function AppClientShell() {
  return (
    <ClientOnly fallback={<Fallback />}>
      <Suspense fallback={<Fallback />}>
        <App />
      </Suspense>
    </ClientOnly>
  );
}

export default AppClientShell;
