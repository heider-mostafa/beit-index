import * as React from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { Button, Input } from '@/src/components/ui';
import {
  Building2,
  Send,
  Trash2,
  Mail,
  Loader2,
  AlertCircle,
  Check,
  Plus,
  Copy,
  Users,
  ChevronRight,
  X,
} from 'lucide-react';

interface BankAccount {
  id: string;
  name: string;
  name_ar: string | null;
  subscription_tier: string;
  monthly_query_limit: number;
  contact_email: string;
  contact_phone: string | null;
  created_at: string;
  bank_users?: { count: number }[];
}

interface BankMember {
  id: string;
  role: string;
  created_at: string;
  users: { email: string; full_name: string } | { email: string; full_name: string }[];
}

interface BankInvite {
  id: string;
  email: string;
  bank_role: string;
  expires_at: string;
  created_at: string;
}

const TIERS = ['trial', 'basic', 'pro', 'enterprise'];
const BANK_ROLES = ['viewer', 'analyst', 'admin'];

export function BanksPage() {
  const { session } = useAuth();
  const [banks, setBanks] = React.useState<BankAccount[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showCreate, setShowCreate] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(null);

  const token = session?.access_token;
  const authHeaders = React.useMemo(
    () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    [token]
  );

  const loadBanks = React.useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/banks', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setBanks(data.banks || []);
      }
    } catch (err) {
      console.error('Error loading banks:', err);
    }
    setLoading(false);
  }, [token]);

  React.useEffect(() => {
    loadBanks();
  }, [loadBanks]);

  return (
    <div className="min-h-screen bg-cream-100">
      <div className="max-w-5xl mx-auto px-5 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-h2 text-ink-600 mb-2">Banks</h1>
            <p className="text-body-m text-ink-400">Create bank accounts and invite their users</p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" /> New bank
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        ) : banks.length === 0 ? (
          <div className="bg-cream-50 rounded-lg border-hairline flex flex-col items-center justify-center py-16 text-ink-400">
            <Building2 className="h-12 w-12 mb-4 text-ink-200" />
            <p>No banks yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="bg-cream-50 rounded-lg border-hairline overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ink-100">
                  <th className="px-6 py-4 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">Bank</th>
                  <th className="px-6 py-4 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">Tier</th>
                  <th className="px-6 py-4 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">Members</th>
                  <th className="px-6 py-4 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {banks.map((bank) => (
                  <tr key={bank.id} className="hover:bg-cream-100 transition-colors cursor-pointer" onClick={() => setSelected(bank.id)}>
                    <td className="px-6 py-4">
                      <p className="text-body-s font-medium text-ink-600">{bank.name}</p>
                      {bank.name_ar && <p className="text-[11px] text-ink-400" dir="rtl">{bank.name_ar}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2 py-1 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700 capitalize">
                        {bank.subscription_tier}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-body-s text-ink-400">{bank.bank_users?.[0]?.count ?? 0}</td>
                    <td className="px-6 py-4 text-body-s text-ink-400">{bank.contact_email}</td>
                    <td className="px-6 py-4 text-right">
                      <ChevronRight className="h-4 w-4 text-ink-300 inline" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateBankModal
          authHeaders={authHeaders}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            loadBanks();
          }}
        />
      )}

      {selected && (
        <BankDrawer
          bankId={selected}
          token={token!}
          authHeaders={authHeaders}
          onClose={() => {
            setSelected(null);
            loadBanks();
          }}
        />
      )}
    </div>
  );
}

function CreateBankModal({
  authHeaders,
  onClose,
  onCreated,
}: {
  authHeaders: Record<string, string>;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = React.useState({
    name: '',
    nameAr: '',
    contactEmail: '',
    contactPhone: '',
    subscriptionTier: 'trial',
    monthlyQueryLimit: 100,
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/banks', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(form),
      });
      if (res.ok) {
        onCreated();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create bank');
      }
    } catch {
      setError('Failed to create bank');
    }
    setSaving(false);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-cream-50 rounded-lg p-6 w-full max-w-lg z-50 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-h3 text-ink-600">New bank account</h2>
          <button onClick={onClose} className="p-1 hover:bg-cream-200 rounded-full">
            <X className="h-5 w-5 text-ink-400" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Input label="Bank name (English)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Bank name (Arabic)" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} dir="rtl" />
          <Input label="Contact email" type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} required />
          <Input label="Contact phone" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="eyebrow text-ink-300 mb-2 block">Subscription tier</label>
              <select
                value={form.subscriptionTier}
                onChange={(e) => setForm({ ...form, subscriptionTier: e.target.value })}
                className="w-full px-3 py-2.5 border-b border-ink-200 bg-transparent text-base focus:border-emerald-500 outline-none capitalize"
              >
                {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <Input
              label="Monthly query limit"
              type="number"
              value={form.monthlyQueryLimit}
              onChange={(e) => setForm({ ...form, monthlyQueryLimit: parseInt(e.target.value) || 0 })}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-sm text-[13px] text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create bank
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

function BankDrawer({
  bankId,
  token,
  authHeaders,
  onClose,
}: {
  bankId: string;
  token: string;
  authHeaders: Record<string, string>;
  onClose: () => void;
}) {
  const [bank, setBank] = React.useState<BankAccount | null>(null);
  const [members, setMembers] = React.useState<BankMember[]>([]);
  const [invites, setInvites] = React.useState<BankInvite[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState('viewer');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/banks/${bankId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setBank(data.bank);
        setMembers(data.members || []);
        setInvites(data.invites || []);
      }
    } catch (err) {
      console.error('Error loading bank:', err);
    }
    setLoading(false);
  }, [bankId, token]);

  React.useEffect(() => {
    load();
  }, [load]);

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setSending(true);
    setError(null);
    setInviteUrl(null);
    try {
      const res = await fetch(`/api/admin/banks/${bankId}/invite`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ email: inviteEmail.trim(), bankRole: inviteRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setInviteUrl(data.inviteUrl);
        setInviteEmail('');
        load();
      } else {
        setError(data.error || 'Failed to send invite');
      }
    } catch {
      setError('Failed to send invite');
    }
    setSending(false);
  };

  const revokeInvite = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/bank-invites/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) load();
    } catch (err) {
      console.error('Error revoking invite:', err);
    }
  };

  const memberName = (m: BankMember) => {
    const u = Array.isArray(m.users) ? m.users[0] : m.users;
    return u?.full_name || u?.email || '-';
  };
  const memberEmail = (m: BankMember) => {
    const u = Array.isArray(m.users) ? m.users[0] : m.users;
    return u?.email || '';
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-[60%] max-w-2xl bg-cream-50 z-50 overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-cream-50 border-b border-ink-100 px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-emerald-600" />
            <h2 className="text-h3 text-ink-600">{bank?.name || 'Bank'}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-cream-200 rounded-full">
            <X className="h-5 w-5 text-ink-400" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        ) : (
          <div className="px-8 py-6 space-y-8">
            {/* Invite form */}
            <div>
              <h3 className="text-body-m font-medium text-ink-600 mb-4">Invite a user</h3>
              <form onSubmit={sendInvite} className="flex gap-3">
                <div className="flex-1">
                  <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="user@bank.com" required />
                </div>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="px-3 border-b border-ink-200 bg-transparent text-base focus:border-emerald-500 outline-none capitalize"
                >
                  {BANK_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <Button type="submit" disabled={sending || !inviteEmail.trim()}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>

              {error && (
                <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-sm text-[13px] text-red-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {inviteUrl && (
                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-100 rounded-sm">
                  <p className="text-[12px] text-emerald-800 mb-2 flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> Invite created — send this link to the user:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[11px] text-ink-600 bg-cream-50 rounded px-2 py-1.5 overflow-x-auto whitespace-nowrap">{inviteUrl}</code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                      className="p-1.5 hover:bg-cream-200 rounded"
                    >
                      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-ink-400" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Members */}
            <div>
              <h3 className="text-body-m font-medium text-ink-600 mb-4 flex items-center gap-2">
                <Users className="h-4 w-4" /> Members ({members.length})
              </h3>
              {members.length === 0 ? (
                <p className="text-body-s text-ink-400">No members yet — invite someone above.</p>
              ) : (
                <div className="space-y-2">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-cream-100 rounded-md">
                      <div>
                        <p className="text-body-s text-ink-600">{memberName(m)}</p>
                        <p className="text-[11px] text-ink-400">{memberEmail(m)}</p>
                      </div>
                      <span className="text-[11px] text-ink-400 capitalize">{m.role}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending invites */}
            {invites.length > 0 && (
              <div>
                <h3 className="text-body-m font-medium text-ink-600 mb-4 flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Pending invites ({invites.length})
                </h3>
                <div className="space-y-2">
                  {invites.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between p-3 bg-cream-100 rounded-md">
                      <div>
                        <p className="text-body-s text-ink-600">{inv.email}</p>
                        <p className="text-[11px] text-ink-400 capitalize">{inv.bank_role} · expires {new Date(inv.expires_at).toLocaleDateString()}</p>
                      </div>
                      <Button variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => revokeInvite(inv.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default BanksPage;
