import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CreditCard, Settings, LogOut, User, ChevronDown, Menu, X, LayoutDashboard, Receipt, Sparkles, CalendarDays } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePlaidLink } from 'react-plaid-link';
import { createPlaidLinkToken, demoPlaidImport, exchangePlaidPublicToken, PLAID_DEMO_DIRECT_IMPORT_ENABLED } from '../lib/api';

export function Header() {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
  const [plaidToken, setPlaidToken] = useState<string | null>(null);
  const [isPreparingPlaid, setIsPreparingPlaid] = useState(false);
  const [shouldOpenPlaid, setShouldOpenPlaid] = useState(false);
  const { logout, user, avatarColor } = useAuth();
  const displayName = user?.name || 'Student';
  const displayEmail = user?.email || '';

  const { open: openPlaid, ready: plaidReady } = usePlaidLink({
    token: plaidToken,
    onSuccess: async (publicToken) => {
      try {
        const result = await exchangePlaidPublicToken(publicToken);
        const summary = result.importSummary;
        alert(
          `Plaid account linked. Imported ${summary.created} new, ${summary.updated} updated, ${summary.removed} removed, ${summary.skipped} skipped transactions.`,
        );
        window.dispatchEvent(new Event('bw:plaid-sync'));
        window.location.reload();
      } catch (error: any) {
        alert(error?.message || 'Failed to import transactions from Plaid.');
      } finally {
        setPlaidToken(null);
        setShouldOpenPlaid(false);
      }
    },
    onExit: () => {
      setShouldOpenPlaid(false);
      setPlaidToken(null);
    },
  });

  useEffect(() => {
    if (plaidReady && shouldOpenPlaid) {
      openPlaid();
    }
  }, [openPlaid, plaidReady, shouldOpenPlaid]);

  const handleAddCreditCard = async () => {
    setIsMobileMenuOpen(false);

    try {
      setIsPreparingPlaid(true);

      if (PLAID_DEMO_DIRECT_IMPORT_ENABLED) {
        const result = await demoPlaidImport();
        const summary = result.importSummary;
        alert(
          `Plaid account linked. Imported ${summary.created} new, ${summary.updated} updated, ${summary.removed} removed, ${summary.skipped} skipped transactions.`,
        );
        window.dispatchEvent(new Event('bw:plaid-sync'));
        window.location.reload();
        return;
      }

      const data = await createPlaidLinkToken();
      setPlaidToken(data.linkToken);
      setShouldOpenPlaid(true);
    } catch (error: any) {
      alert(error?.message || 'Failed to initialize Plaid Sandbox link.');
    } finally {
      setIsPreparingPlaid(false);
    }
  };

  const handleSignOut = () => {
    setIsUserMenuOpen(false);
    setIsMobileMenuOpen(false);
    logout();
  };

  return (
    <header className="bg-white shadow-md border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo/Brand and Navigation Dropdown */}
          <div className="flex items-center gap-4">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
                <CreditCard className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">BudgetTracker</h1>
                <p className="text-xs text-gray-500">Student Edition</p>
              </div>
            </div>

            {/* Navigation Dropdown */}
            <div className="relative hidden md:block">
              <button
                onClick={() => setIsNavMenuOpen(!isNavMenuOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Menu className="w-4 h-4" />
                <span className="font-medium text-gray-900">Menu</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isNavMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isNavMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsNavMenuOpen(false)}
                  />
                  <div className="absolute left-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
                    <Link
                      href="/"
                      onClick={() => setIsNavMenuOpen(false)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <LayoutDashboard className="w-5 h-5 text-indigo-600" />
                      <div className="text-left">
                        <div className="font-medium text-gray-900">Dashboard</div>
                        <div className="text-xs text-gray-500">Overview and analytics</div>
                      </div>
                    </Link>
                    <Link
                      href="/budget-creator"
                      onClick={() => setIsNavMenuOpen(false)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <Sparkles className="w-5 h-5 text-purple-600" />
                      <div className="text-left">
                        <div className="font-medium text-gray-900">AI Budget Creator</div>
                        <div className="text-xs text-gray-500">Create optimized budget</div>
                      </div>
                    </Link>
                    <Link
                      href="/expenses"
                      onClick={() => setIsNavMenuOpen(false)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <Receipt className="w-5 h-5 text-green-600" />
                      <div className="text-left">
                        <div className="font-medium text-gray-900">Transactions</div>
                        <div className="text-xs text-gray-500">Track all transactions</div>
                      </div>
                    </Link>

                    <Link
                      href="/calendar"
                      onClick={() => setIsNavMenuOpen(false)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <CalendarDays className="w-5 h-5 text-blue-600" />
                      <div className="text-left">
                        <div className="font-medium text-gray-900">Calendar</div>
                        <div className="text-xs text-gray-500">View by day</div>
                      </div>
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={handleAddCreditCard}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              disabled={isPreparingPlaid}
            >
              <CreditCard className="w-4 h-4" />
              <span>{isPreparingPlaid ? 'Preparing Plaid...' : 'Link with Plaid'}</span>
            </button>

            {/* User Menu Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: avatarColor }}
                >
                  <User className="w-5 h-5 text-white" />
                </div>
                <span className="font-medium text-gray-900">{displayName}</span>
                <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isUserMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="font-medium text-gray-900">{displayName}</div>
                      <div className="text-sm text-gray-500">{displayEmail}</div>
                    </div>
                    <Link
                      href="/settings"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <Settings className="w-5 h-5 text-gray-600" />
                      <span className="text-gray-900">Settings</span>
                    </Link>
                    <div className="border-t border-gray-100 mt-2 pt-2">
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition-colors text-red-600"
                      >
                        <LogOut className="w-5 h-5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6 text-gray-900" />
            ) : (
              <Menu className="w-6 h-6 text-gray-900" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-4 pt-4 border-t border-gray-200">
            <div className="space-y-2">
              {/* User Info */}
              <div className="px-4 py-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: avatarColor }}
                  >
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{displayName}</div>
                    <div className="text-sm text-gray-500">{displayEmail}</div>
                  </div>
                </div>
              </div>

              {/* Navigation Links */}
<div className="space-y-2">
  <p className="px-4 text-sm font-medium text-gray-500">Navigation</p>
  <Link
    href="/"
    onClick={() => setIsMobileMenuOpen(false)}
    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-lg transition-colors"
  >
    <LayoutDashboard className="w-5 h-5 text-indigo-600" />
    <div className="text-left">
      <div className="font-medium text-gray-900">Dashboard</div>
      <div className="text-xs text-gray-500">Overview and analytics</div>
    </div>
  </Link>

  <Link
    href="/budget-creator"
    onClick={() => setIsMobileMenuOpen(false)}
    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-lg transition-colors"
  >
    <Sparkles className="w-5 h-5 text-purple-600" />
    <div className="text-left">
      <div className="font-medium text-gray-900">AI Budget Creator</div>
      <div className="text-xs text-gray-500">Create optimized budget</div>
    </div>
  </Link>

  <Link
    href="/expenses"
    onClick={() => setIsMobileMenuOpen(false)}
    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-lg transition-colors"
  >
    <Receipt className="w-5 h-5 text-green-600" />
    <div className="text-left">
      <div className="font-medium text-gray-900">Transactions</div>
      <div className="text-xs text-gray-500">Track all transactions</div>
    </div>
  </Link>

  <Link
    href="/calendar"
    onClick={() => setIsMobileMenuOpen(false)}
    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-lg transition-colors"
  >
    <CalendarDays className="w-5 h-5 text-blue-600" />
    <div className="text-left">
      <div className="font-medium text-gray-900">Calendar</div>
      <div className="text-xs text-gray-500">View by day</div>
    </div>
  </Link>
</div>

              {/* Link with Plaid */}
              <div className="space-y-2">
                <p className="px-4 text-sm font-medium text-gray-500">Link with Plaid</p>
                <button
                  onClick={handleAddCreditCard}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-lg transition-colors"
                  disabled={isPreparingPlaid}
                >
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900">
                      {isPreparingPlaid ? 'Preparing Plaid...' : 'Link with Plaid'}
                    </div>
                    <div className="text-xs text-gray-500">Connect your account via Plaid</div>
                  </div>
                </button>
              </div>

              {/* Settings & Sign Out */}
              <div className="pt-2 border-t border-gray-200 space-y-2">
                <Link
                  href="/settings"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <Settings className="w-5 h-5 text-gray-600" />
                  <span className="text-gray-900">Settings</span>
                </Link>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 rounded-lg transition-colors text-red-600"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
