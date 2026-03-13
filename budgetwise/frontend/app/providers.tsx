'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '../src/app/context/AuthContext';
import { Header } from '../src/app/components/Header';

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <Header />
      {children}
    </div>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
