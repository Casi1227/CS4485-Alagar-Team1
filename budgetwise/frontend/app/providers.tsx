'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SWRConfig } from 'swr';
import { AuthProvider, useAuth } from '../src/app/context/AuthContext';
import { Header } from '../src/app/components/Header';
import { apiJson } from '../src/app/lib/api';

function AppShell({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password'];
  const isPublic = publicRoutes.includes(pathname);

  useEffect(() => {
    if (!isAuthenticated && !isPublic) {
      router.push('/login');
    }

    if (isAuthenticated && isPublic) {
      router.push('/');
    }
  }, [isAuthenticated, isPublic, router]);

  if (!isAuthenticated && !isPublic) {
    return null;
  }

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen app-shell-bg">
      <Header />
      {children}
    </div>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SWRConfig
        value={{
          fetcher: (key: string) => apiJson(key),
          dedupingInterval: 20_000,
          focusThrottleInterval: 30_000,
          revalidateOnFocus: false,
          revalidateIfStale: false,
          revalidateOnReconnect: true,
          shouldRetryOnError: false,
        }}
      >
        <AppShell>{children}</AppShell>
      </SWRConfig>
    </AuthProvider>
  );
}
