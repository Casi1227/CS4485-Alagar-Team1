import { useState } from 'react';
import { User, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiJson } from '../lib/api';

const AVATAR_COLORS = ['#6366F1', '#7C3AED', '#DB2777', '#DC2626', '#D97706', '#16A34A', '#0891B2', '#334155'];

export function Settings() {
  const { user, refreshUser, logout, themeMode, setThemeMode, avatarColor, setAvatarColor } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  function openDeleteModal() {
    setDeletePassword('');
    setDeleteError('');
    setDeleteOpen(true);
  }

  function closeDeleteModal() {
    if (deleteLoading) return;
    setDeleteOpen(false);
    setDeletePassword('');
    setDeleteError('');
  }

  async function confirmDeleteAccount() {
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await apiJson('/api/settings/account', {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePassword }),
      });
      setDeleteOpen(false);
      logout();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account.');
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMessage('');
    setError('');

    try {
      const res = await apiJson('/api/settings/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name, email }),
      });

      setMessage('Profile updated successfully.');
      await refreshUser();
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  }

  const displayName = user?.name || 'Student';

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Account Settings
          </h1>
          <p className="text-gray-600">
            Manage your BudgetTracker student profile.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">

          <div className="flex items-center gap-4 mb-6">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ backgroundColor: avatarColor }}
            >
              <User className="w-8 h-8 text-white" />
            </div>

            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">
                Signed in as
              </div>

              <div className="text-xl font-semibold text-gray-900">
                {displayName}
              </div>

              {user?.email && (
                <div className="text-sm text-gray-600">
                  {user.email}
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4 border-t border-gray-100 pt-6">

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>

              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>

              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {message && (
              <p className="text-green-600 text-sm">{message}</p>
            )}

            {error && (
              <p className="text-red-600 text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>

          </form>

        </div>

        <div className="mt-8 bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Appearance</h2>
          <p className="text-sm text-gray-600 mb-4">
            Choose your app theme and avatar color.
          </p>

          <div className="mb-5">
            <p className="text-sm font-medium text-gray-700 mb-2">Theme</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setThemeMode('light')}
                className={`rounded-lg px-4 py-2 text-sm font-medium border transition-colors ${
                  themeMode === 'light'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => setThemeMode('dark')}
                className={`rounded-lg px-4 py-2 text-sm font-medium border transition-colors ${
                  themeMode === 'dark'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Dark
              </button>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Avatar color</p>
            <div className="flex flex-wrap gap-3">
              {AVATAR_COLORS.map((color) => {
                const selected = avatarColor.toLowerCase() === color.toLowerCase();
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAvatarColor(color)}
                    className={`h-9 w-9 rounded-full border-2 transition-transform ${
                      selected ? 'border-indigo-600 scale-105' : 'border-gray-200'
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Set avatar color ${color}`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-xl shadow-lg p-6 border border-red-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Danger zone</h2>
          <p className="text-sm text-gray-600 mb-4">
            Permanently delete your account and all associated data: transactions, budgets, goals, and
            saved profile information. This cannot be undone.
          </p>
          <button
            type="button"
            onClick={openDeleteModal}
            className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Delete account
          </button>
        </div>
      </div>

      {deleteOpen ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg rounded-xl border border-gray-100 bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={closeDeleteModal}
              className="absolute right-3 top-3 text-gray-500 hover:text-gray-700"
              aria-label="Cancel"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-lg font-semibold text-gray-900 mb-2">Delete account</h2>
            <p className="text-sm text-gray-600 mb-4">
              This removes all expenses, budget plans, and goals tied to your account. Enter your
              password to confirm.
            </p>

            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            {deleteError ? <p className="text-sm text-red-600 mb-3">{deleteError}</p> : null}

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleteLoading}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteAccount}
                disabled={deleteLoading || !deletePassword}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}