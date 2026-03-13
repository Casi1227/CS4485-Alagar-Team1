import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from './providers';
import './globals.css';
import '../src/styles/fonts.css';
import '../src/styles/tailwind.css';
import '../src/styles/theme.css';

export const metadata = {
  title: 'BudgetTracker – Student Edition',
  description: 'Student financial forecasting & expense tracker (BudgetWise spec).',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

