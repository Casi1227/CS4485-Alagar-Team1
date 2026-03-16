import { Outlet } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';

export function AuthLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}