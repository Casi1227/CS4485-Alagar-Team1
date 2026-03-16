import { useState } from 'react';
import { User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiJson } from '../lib/api';

export function Settings() {
  const { user, refreshUser } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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
            <div className="w-14 h-14 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-full flex items-center justify-center">
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
      </div>
    </div>
  );
}