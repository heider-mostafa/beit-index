import * as React from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { Button, Input } from '@/src/components/ui';
import {
  Send,
  Trash2,
  Mail,
  Clock,
  Check,
  Loader2,
  AlertCircle,
  Users,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface AdminInvite {
  id: string;
  email: string;
  token: string;
  invited_by: string;
  expires_at: string;
  consumed_at: string | null;
  consumed_by: string | null;
  created_at: string;
  inviter?: { full_name: string; email: string };
  consumer?: { full_name: string; email: string };
}

export function InvitesPage() {
  const { session } = useAuth();
  const [invites, setInvites] = React.useState<AdminInvite[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [newEmail, setNewEmail] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [showConsumed, setShowConsumed] = React.useState(false);

  // Load invites
  const loadInvites = React.useCallback(async () => {
    if (!session?.access_token) return;

    try {
      const res = await fetch('/api/admin/invites', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setInvites(data);
      }
    } catch (err) {
      console.error('Error loading invites:', err);
    }
    setLoading(false);
  }, [session]);

  React.useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token || !newEmail.trim()) return;

    setSending(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email: newEmail.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setSuccess(`Invite sent to ${newEmail}`);
        setNewEmail('');
        loadInvites();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to send invite');
      }
    } catch (err) {
      setError('Failed to send invite');
    }

    setSending(false);
  };

  const handleRevoke = async (id: string) => {
    if (!session?.access_token) return;
    if (!confirm('Are you sure you want to revoke this invite?')) return;

    try {
      const res = await fetch(`/api/admin/invites/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        loadInvites();
      }
    } catch (err) {
      console.error('Error revoking invite:', err);
    }
  };

  const pendingInvites = invites.filter((i) => !i.consumed_at);
  const consumedInvites = invites.filter((i) => i.consumed_at);

  return (
    <div className="min-h-screen bg-cream-100">
      <div className="max-w-4xl mx-auto px-5 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-h2 text-ink-600 mb-2">Admin invites</h1>
          <p className="text-body-m text-ink-400">
            Invite new administrators to the platform
          </p>
        </div>

        {/* Invite form */}
        <div className="bg-cream-50 rounded-lg border-hairline p-6 mb-8">
          <h2 className="text-body-m font-medium text-ink-600 mb-4">Invite a new admin</h2>

          <form onSubmit={handleSendInvite} className="flex gap-4">
            <div className="flex-1">
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="admin@example.com"
                required
              />
            </div>
            <Button type="submit" disabled={sending || !newEmail.trim()}>
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send invite
            </Button>
          </form>

          {error && (
            <div className="mt-4 flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-sm text-[13px] text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mt-4 flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-sm text-[13px] text-emerald-700">
              <Check className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}
        </div>

        {/* Pending invites */}
        <div className="bg-cream-50 rounded-lg border-hairline overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-ink-100">
            <h2 className="text-body-m font-medium text-ink-600">
              Pending invites
              {pendingInvites.length > 0 && (
                <span className="ml-2 text-ink-400">({pendingInvites.length})</span>
              )}
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
            </div>
          ) : pendingInvites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-ink-400">
              <Mail className="h-10 w-10 mb-3 text-ink-200" />
              <p className="text-body-s">No pending invites</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-ink-100">
                  <th className="px-6 py-3 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">
                    Invited by
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">
                    Sent
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">
                    Expires
                  </th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {pendingInvites.map((invite) => {
                  const isExpired = new Date(invite.expires_at) < new Date();
                  return (
                    <tr key={invite.id} className={isExpired ? 'opacity-50' : ''}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-ink-300" />
                          <span className="text-body-s text-ink-600">{invite.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-body-s text-ink-400">
                          {invite.inviter?.full_name || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-body-s text-ink-400">
                          {new Date(invite.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-body-s ${isExpired ? 'text-red-600' : 'text-ink-400'}`}>
                          {isExpired ? 'Expired' : new Date(invite.expires_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleRevoke(invite.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Consumed invites */}
        {consumedInvites.length > 0 && (
          <div className="bg-cream-50 rounded-lg border-hairline overflow-hidden">
            <button
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-cream-100 transition-colors"
              onClick={() => setShowConsumed(!showConsumed)}
            >
              <h2 className="text-body-m font-medium text-ink-600">
                Accepted invites
                <span className="ml-2 text-ink-400">({consumedInvites.length})</span>
              </h2>
              {showConsumed ? (
                <ChevronDown className="h-4 w-4 text-ink-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-ink-400" />
              )}
            </button>

            {showConsumed && (
              <table className="w-full border-t border-ink-100">
                <thead>
                  <tr className="border-b border-ink-100">
                    <th className="px-6 py-3 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">
                      Accepted by
                    </th>
                    <th className="px-6 py-3 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">
                      Accepted at
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {consumedInvites.map((invite) => (
                    <tr key={invite.id}>
                      <td className="px-6 py-4">
                        <span className="text-body-s text-ink-600">{invite.email}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-body-s text-ink-400">
                          {invite.consumer?.full_name || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-body-s text-ink-400">
                          {invite.consumed_at ? new Date(invite.consumed_at).toLocaleDateString() : '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default InvitesPage;
