import * as React from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { Button } from '@/src/components/ui';
import {
  MapPin,
  Check,
  X,
  Loader2,
  Inbox,
  ChevronDown,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';

interface AreaRequest {
  id: string;
  user_id: string;
  area_text: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  created_at: string;
  requester?: { full_name: string; email: string };
}

export function AreaRequestsPage() {
  const { session } = useAuth();
  const [requests, setRequests] = React.useState<AreaRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [showResolved, setShowResolved] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch('/api/admin/area-requests', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch (err) {
      console.error('Error loading area requests:', err);
    }
    setLoading(false);
  }, [session]);

  React.useEffect(() => {
    load();
  }, [load]);

  const resolve = async (id: string, status: AreaRequest['status']) => {
    if (!session?.access_token) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/area-requests/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) await load();
    } catch (err) {
      console.error('Error resolving area request:', err);
    }
    setBusyId(null);
  };

  const pending = requests.filter((r) => r.status === 'pending');
  const resolved = requests.filter((r) => r.status !== 'pending');

  return (
    <div className="min-h-screen bg-cream-100">
      <div className="max-w-4xl mx-auto px-5 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-h2 text-ink-600 mb-2">Area requests</h1>
          <p className="text-body-m text-ink-400">
            Coverage areas appraisers couldn't find in the list. Approving marks a
            request as reviewed — remember to also add the area to the gazetteer
            (cities / districts) so appraisers can select it.
          </p>
        </div>

        {/* Pending */}
        <div className="bg-cream-50 rounded-lg border-hairline overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-ink-100">
            <h2 className="text-body-m font-medium text-ink-600">
              Pending
              {pending.length > 0 && <span className="ml-2 text-ink-400">({pending.length})</span>}
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
            </div>
          ) : pending.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-ink-400">
              <Inbox className="h-10 w-10 mb-3 text-ink-200" />
              <p className="text-body-s">No pending requests</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-ink-100">
                  <th className="px-6 py-3 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">
                    Requested area
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">
                    Requested by
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {pending.map((r) => (
                  <tr key={r.id}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-ink-300 flex-shrink-0" />
                        <span className="text-body-s text-ink-600">{r.area_text}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-body-s text-ink-600">{r.requester?.full_name || '-'}</div>
                      <div className="text-[11px] text-ink-300">{r.requester?.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-body-s text-ink-400">
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          className="text-emerald-600 hover:text-emerald-700"
                          disabled={busyId === r.id}
                          onClick={() => resolve(r.id, 'approved')}
                        >
                          {busyId === r.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4 mr-1" />
                          )}
                          Approve
                        </Button>
                        <Button
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                          disabled={busyId === r.id}
                          onClick={() => resolve(r.id, 'rejected')}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Resolved */}
        {resolved.length > 0 && (
          <div className="bg-cream-50 rounded-lg border-hairline overflow-hidden">
            <button
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-cream-100 transition-colors"
              onClick={() => setShowResolved(!showResolved)}
            >
              <h2 className="text-body-m font-medium text-ink-600">
                Resolved
                <span className="ml-2 text-ink-400">({resolved.length})</span>
              </h2>
              {showResolved ? (
                <ChevronDown className="h-4 w-4 text-ink-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-ink-400" />
              )}
            </button>

            {showResolved && (
              <table className="w-full border-t border-ink-100">
                <thead>
                  <tr className="border-b border-ink-100">
                    <th className="px-6 py-3 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">
                      Requested area
                    </th>
                    <th className="px-6 py-3 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">
                      Requested by
                    </th>
                    <th className="px-6 py-3 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {resolved.map((r) => (
                    <tr key={r.id}>
                      <td className="px-6 py-4">
                        <span className="text-body-s text-ink-600">{r.area_text}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-body-s text-ink-400">{r.requester?.full_name || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            r.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="ghost"
                          className="text-ink-400 hover:text-ink-600"
                          disabled={busyId === r.id}
                          onClick={() => resolve(r.id, 'pending')}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Reopen
                        </Button>
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

export default AreaRequestsPage;
