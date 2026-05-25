import * as React from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { Button } from '@/src/components/ui';
import {
  Loader2,
  FileText,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface AuditLogEntry {
  id: string;
  user_id: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  users?: { full_name: string; email: string } | null;
}

const ACTION_LABELS: Record<string, string> = {
  admin_override: 'Admin Override',
  verification_doc_viewed: 'Document Viewed',
  profile_approved: 'Profile Approved',
  profile_rejected: 'Profile Rejected',
  changes_requested: 'Changes Requested',
  admin_invited: 'Admin Invited',
  admin_invite_consumed: 'Invite Accepted',
};

export function AuditLogPage() {
  const { session } = useAuth();
  const [logs, setLogs] = React.useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [actionFilter, setActionFilter] = React.useState<string>('');

  const loadLogs = React.useCallback(async () => {
    if (!session?.access_token) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });
      if (actionFilter) params.set('action', actionFilter);

      const res = await fetch(`/api/admin/audit-log?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error('Error loading audit log:', err);
    }
    setLoading(false);
  }, [session, page, actionFilter]);

  React.useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const formatTarget = (entry: AuditLogEntry): string => {
    if (!entry.target_table) return '-';

    const metadata = entry.metadata as Record<string, string>;

    switch (entry.target_table) {
      case 'appraiser_profiles':
        return `Appraiser profile`;
      case 'verification_documents':
        return `Document: ${metadata?.storagePath?.split('/').pop() || 'unknown'}`;
      case 'admin_invites':
        return `Admin invite: ${metadata?.email || 'unknown'}`;
      default:
        return entry.target_table;
    }
  };

  return (
    <div className="min-h-screen bg-cream-100">
      <div className="max-w-7xl mx-auto px-5 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-h2 text-ink-600 mb-2">Audit log</h1>
            <p className="text-body-m text-ink-400">
              All administrative actions are logged here
            </p>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-ink-400" />
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-cream-50 border border-ink-200 rounded-md text-body-s focus:border-emerald-500 outline-none"
            >
              <option value="">All actions</option>
              {Object.entries(ACTION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-cream-50 rounded-lg border-hairline overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-ink-400">
              <FileText className="h-12 w-12 mb-4 text-ink-200" />
              <p>No audit log entries</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-ink-100">
                  <th className="px-6 py-4 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">
                    Admin
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">
                    Target
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">
                    IP Address
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {logs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-cream-100 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-body-s text-ink-600">
                        {new Date(entry.created_at).toLocaleString()}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-body-s text-ink-600">
                        {entry.users?.full_name || 'System'}
                      </p>
                      <p className="text-[11px] text-ink-400">
                        {entry.users?.email || '-'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <ActionBadge action={entry.action} />
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-body-s text-ink-600">{formatTarget(entry)}</p>
                      {entry.target_id && (
                        <p className="text-[11px] text-ink-400 font-mono">
                          {entry.target_id.slice(0, 8)}...
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-body-s text-ink-400 font-mono">
                        {entry.ip_address || '-'}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-ink-100 flex items-center justify-between">
              <p className="text-body-s text-ink-400">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const colors: Record<string, string> = {
    profile_approved: 'bg-emerald-100 text-emerald-800',
    profile_rejected: 'bg-red-100 text-red-800',
    changes_requested: 'bg-yellow-100 text-yellow-800',
    verification_doc_viewed: 'bg-blue-100 text-blue-800',
    admin_invited: 'bg-purple-100 text-purple-800',
    admin_invite_consumed: 'bg-purple-100 text-purple-800',
    admin_override: 'bg-ink-100 text-ink-600',
  };

  return (
    <span className={`inline-flex px-2 py-1 rounded-full text-[11px] font-medium ${colors[action] || colors.admin_override}`}>
      {ACTION_LABELS[action] || action}
    </span>
  );
}

export default AuditLogPage;
