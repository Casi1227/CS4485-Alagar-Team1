import { createBrowserRouter } from 'react-router-dom';
import { AuthLayout } from './layouts/AuthLayout';
import { Root } from './pages/Root';
import { Dashboard } from './pages/Dashboard';
import { Expenses } from './pages/Expenses';
import { BudgetCreator } from './pages/BudgetCreator';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { ForgotPassword } from './pages/ForgotPassword';

export const router = createBrowserRouter([
  {
    Component: AuthLayout,
    children: [
      {
        path: '/login',
        Component: Login,
      },
      {
        path: '/forgot-password',
        Component: ForgotPassword,
      },
      {
        path: '/',
        Component: Root,
        children: [
          { index: true, Component: Dashboard },
          { path: 'expenses', Component: Expenses },
          { path: 'budget-creator', Component: BudgetCreator },
          { path: 'settings', Component: Settings },
        ],
      },
    ],
  },
]);