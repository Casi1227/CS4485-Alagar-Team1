import "./globals.css";
import type { Metadata } from "next";
import { AuthProvider } from "@/store/auth";

export const metadata: Metadata = {
  title: "BudgetWise",
  description: "Student Financial Forecasting & Expense Tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
