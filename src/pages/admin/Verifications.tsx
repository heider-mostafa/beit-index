import * as React from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { Button, Badge } from '@/src/components/ui';
import {
  X,
  Check,
  AlertCircle,
  Clock,
  ChevronRight,
  Loader2,
  FileText,
  MapPin,
  Building,
  User,
  Shield,
} from 'lucide-react';

interface AppraiserProfile {
  id: string;
  user_id: string;
  full_name_en: string;
  full_name_ar: string | null;
  phone: string | null;
  years_experience: number | null;
  professional_title_en: string | null;
  photo_url: string | null;
  fra_license_number: string | null;
  fra_license_issue_date: string | null;
  fra_license_expiry_date: string | null;
  national_id_number: string | null;
  bio_en: string | null;
  bio_ar: string | null;
  starting_price_egp: number | null;
  typical_turnaround_days: number | null;
  availability: string | null;
  signature_url: string | null;
  stamp_url: string | null;
  status: 'incomplete' | 'pending' | 'under_review' | 'verified' | 'rejected';
  submitted_at: string | null;
  rejection_reason: string | null;
  is_draft?: boolean;
  current_step?: number;
  users: { email: string; full_name: string };
  appraiser_service_areas: Array<{
    district_id: string;
    districts: { name_en: string; name_ar: string; cities: { name_en: string; name_ar: string } };
  }>;
  appraiser_specialties: Array<{
    property_type_id: string;
    years_experience: number;
    property_types: { name_en: string; name_ar: string };
  }>;
  verification_documents: Array<{
    id: string;
    document_type: string;
    storage_path: string;
    original_filename: string | null;
  }>;
}

interface StatusCounts {
  incomplete: number;
  pending: number;
  under_review: number;
  verified: number;
  rejected: number;
}

const STATUS_TABS = [
  { id: null, label: 'All' },
  { id: 'incomplete', label: 'Incomplete' },
  { id: 'pending', label: 'Pending' },
  { id: 'under_review', label: 'Under review' },
  { id: 'verified', label: 'Verified' },
  { id: 'rejected', label: 'Rejected' },
];

export function VerificationsPage() {
  const { session } = useAuth();
  const [profiles, setProfiles] = React.useState<AppraiserProfile[]>([]);
  const [statusCounts, setStatusCounts] = React.useState<StatusCounts>({
    incomplete: 0,
    pending: 0,
    under_review: 0,
    verified: 0,
    rejected: 0,
  });
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = React.useState<AppraiserProfile | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // Load profiles
  const loadProfiles = React.useCallback(async () => {
    if (!session?.access_token) return;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab) params.set('status', activeTab);

      const res = await fetch(`/api/admin/verifications?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setProfiles(data.profiles || []);
        setStatusCounts(
          data.statusCounts || { incomplete: 0, pending: 0, under_review: 0, verified: 0, rejected: 0 }
        );
      }
    } catch (err) {
      console.error('Error loading profiles:', err);
    }
    setLoading(false);
  }, [session, activeTab]);

  React.useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const openReview = async (profile: AppraiserProfile) => {
    if (!session?.access_token) return;
    // Incomplete appraisers have no submitted profile to review yet.
    if (profile.is_draft) return;

    // Fetch full profile details
    try {
      const res = await fetch(`/api/admin/verifications/${profile.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const fullProfile = await res.json();
        setSelectedProfile(fullProfile);
        setDrawerOpen(true);
      }
    } catch (err) {
      console.error('Error loading profile details:', err);
    }
  };

  const handleAction = async (action: 'approve' | 'reject' | 'request-changes', reason?: string) => {
    if (!session?.access_token || !selectedProfile) return;

    try {
      const res = await fetch(`/api/admin/verifications/${selectedProfile.id}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ reason }),
      });

      if (res.ok) {
        setDrawerOpen(false);
        setSelectedProfile(null);
        loadProfiles();
      }
    } catch (err) {
      console.error('Error performing action:', err);
    }
  };

  const totalPending = statusCounts.pending + statusCounts.under_review;

  return (
    <div className="min-h-screen bg-cream-100">
      <div className="max-w-7xl mx-auto px-5 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-h2 text-ink-600 mb-2">Verification queue</h1>
          <p className="text-body-m text-ink-400">
            {statusCounts.incomplete} incomplete &middot; {totalPending} pending &middot;{' '}
            {statusCounts.verified} verified
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id || 'all'}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-full text-body-s font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-emerald-500 text-white'
                  : 'bg-cream-50 text-ink-400 hover:bg-cream-200'
              }`}
            >
              {tab.label}
              {tab.id && statusCounts[tab.id as keyof StatusCounts] > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] bg-white/20">
                  {statusCounts[tab.id as keyof StatusCounts]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-cream-50 rounded-lg border-hairline overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
          ) : profiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-ink-400">
              <Shield className="h-12 w-12 mb-4 text-ink-200" />
              <p>No profiles to review</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-ink-100">
                  <th className="px-6 py-4 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">
                    Appraiser
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">
                    FRA License
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">
                    Service Areas
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {profiles.map((profile) => (
                  <tr key={profile.id} className="hover:bg-cream-100 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-ink-100 flex items-center justify-center overflow-hidden">
                          {profile.photo_url ? (
                            <img src={profile.photo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="h-5 w-5 text-ink-300" />
                          )}
                        </div>
                        <div>
                          <p className="text-body-s font-medium text-ink-600">{profile.full_name_en}</p>
                          <p className="text-[11px] text-ink-400">{profile.users?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-body-s text-ink-600">{profile.fra_license_number || '-'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-body-s text-ink-400">
                        {profile.submitted_at
                          ? formatRelativeTime(new Date(profile.submitted_at))
                          : '-'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {profile.appraiser_service_areas?.slice(0, 3).map((area, idx) => (
                          <Badge key={idx} className="text-[10px]">
                            {area.districts?.name_en}
                          </Badge>
                        ))}
                        {(profile.appraiser_service_areas?.length || 0) > 3 && (
                          <Badge className="text-[10px] bg-ink-200">
                            +{profile.appraiser_service_areas.length - 3}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={profile.status} />
                    </td>
                    <td className="px-6 py-4">
                      {profile.is_draft ? (
                        <span className="text-[11px] text-ink-400 whitespace-nowrap">
                          Step {profile.current_step || 1} of 6 &middot; not submitted
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          className="text-emerald-600"
                          onClick={() => openReview(profile)}
                        >
                          Review <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Review drawer */}
      {drawerOpen && selectedProfile && (
        <ReviewDrawer
          profile={selectedProfile}
          onClose={() => {
            setDrawerOpen(false);
            setSelectedProfile(null);
          }}
          onApprove={() => handleAction('approve')}
          onReject={(reason) => handleAction('reject', reason)}
          onRequestChanges={(reason) => handleAction('request-changes', reason)}
          session={session}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    incomplete: 'bg-ink-100 text-ink-500',
    pending: 'bg-yellow-100 text-yellow-800',
    under_review: 'bg-blue-100 text-blue-800',
    verified: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-red-100 text-red-800',
  };

  const labels = {
    incomplete: 'Incomplete',
    pending: 'Pending',
    under_review: 'Under review',
    verified: 'Verified',
    rejected: 'Rejected',
  };

  return (
    <span className={`inline-flex px-2 py-1 rounded-full text-[11px] font-medium ${styles[status as keyof typeof styles] || styles.pending}`}>
      {labels[status as keyof typeof labels] || status}
    </span>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

interface ReviewDrawerProps {
  profile: AppraiserProfile;
  onClose: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onRequestChanges: (reason: string) => void;
  session: { access_token: string } | null;
}

function ReviewDrawer({ profile, onClose, onApprove, onReject, onRequestChanges, session }: ReviewDrawerProps) {
  const [showRejectModal, setShowRejectModal] = React.useState(false);
  const [showChangesModal, setShowChangesModal] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [docUrls, setDocUrls] = React.useState<Record<string, string>>({});
  const [loadingAction, setLoadingAction] = React.useState(false);

  // Load signed URLs for documents
  React.useEffect(() => {
    if (!session?.access_token) return;

    const loadDocUrls = async () => {
      const urls: Record<string, string> = {};

      for (const doc of profile.verification_documents || []) {
        try {
          const res = await fetch('/api/download/get-url', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              bucket: 'verification-docs',
              storagePath: doc.storage_path,
              expiresIn: 900, // 15 minutes
            }),
          });

          if (res.ok) {
            const data = await res.json();
            urls[doc.id] = data.signedUrl;
          }
        } catch (err) {
          console.error('Error getting doc URL:', err);
        }
      }

      setDocUrls(urls);
    };

    loadDocUrls();
  }, [profile, session]);

  const handleApprove = async () => {
    setLoadingAction(true);
    await onApprove();
    setLoadingAction(false);
  };

  const handleReject = async () => {
    if (!reason.trim()) return;
    setLoadingAction(true);
    await onReject(reason);
    setLoadingAction(false);
  };

  const handleRequestChanges = async () => {
    if (!reason.trim()) return;
    setLoadingAction(true);
    await onRequestChanges(reason);
    setLoadingAction(false);
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-[60%] max-w-3xl bg-cream-50 z-50 overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-cream-50 border-b border-ink-100 px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-ink-100 flex items-center justify-center overflow-hidden">
              {profile.photo_url ? (
                <img src={profile.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="h-7 w-7 text-ink-300" />
              )}
            </div>
            <div>
              <h2 className="text-h3 text-ink-600">{profile.full_name_en}</h2>
              <StatusBadge status={profile.status} />
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-cream-200 rounded-full">
            <X className="h-5 w-5 text-ink-400" />
          </button>
        </div>

        {/* Content */}
        <div className="px-8 py-6 space-y-8">
          {/* Personal info */}
          <Section title="Personal information">
            <InfoGrid>
              <InfoItem label="Full name (EN)" value={profile.full_name_en} />
              <InfoItem label="Full name (AR)" value={profile.full_name_ar} />
              <InfoItem label="Email" value={profile.users?.email} />
              <InfoItem label="Phone" value={profile.phone} />
              <InfoItem label="Years experience" value={profile.years_experience?.toString()} />
              <InfoItem label="Professional title" value={profile.professional_title_en} />
            </InfoGrid>
          </Section>

          {/* FRA License */}
          <Section title="FRA License">
            <InfoGrid>
              <InfoItem label="License number" value={profile.fra_license_number} />
              <InfoItem label="Issue date" value={profile.fra_license_issue_date} />
              <InfoItem label="Expiry date" value={profile.fra_license_expiry_date} />
            </InfoGrid>
            {profile.verification_documents?.filter((d) => d.document_type === 'fra_license').map((doc) => (
              <div key={doc.id} className="mt-4">
                {docUrls[doc.id] ? (
                  <DocumentPreview url={docUrls[doc.id]} filename={doc.original_filename || 'License document'} />
                ) : (
                  <div className="flex items-center gap-2 text-ink-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-body-s">Loading document...</span>
                  </div>
                )}
              </div>
            ))}
          </Section>

          {/* National ID */}
          <Section title="National ID">
            <InfoGrid>
              <InfoItem label="ID number" value={profile.national_id_number} />
            </InfoGrid>
            <div className="mt-4 grid grid-cols-2 gap-4">
              {profile.verification_documents?.filter((d) => d.document_type.includes('national_id')).map((doc) => (
                <div key={doc.id}>
                  <p className="text-[11px] text-ink-400 mb-2 uppercase">
                    {doc.document_type === 'national_id_front' ? 'Front' : 'Back'}
                  </p>
                  {docUrls[doc.id] ? (
                    <DocumentPreview url={docUrls[doc.id]} filename={doc.original_filename || 'ID'} />
                  ) : (
                    <div className="h-32 bg-ink-100 rounded flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-ink-300" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>

          {/* Service areas */}
          <Section title="Service areas">
            <div className="flex flex-wrap gap-2">
              {profile.appraiser_service_areas?.map((area, idx) => (
                <Badge key={idx} className="bg-ink-100 text-ink-600">
                  <MapPin className="h-3 w-3 mr-1" />
                  {area.districts?.name_en}, {area.districts?.cities?.name_en}
                </Badge>
              ))}
            </div>
          </Section>

          {/* Specialties */}
          <Section title="Specialties">
            <div className="flex flex-wrap gap-2">
              {profile.appraiser_specialties?.map((spec, idx) => (
                <Badge key={idx} className="bg-ink-100 text-ink-600">
                  <Building className="h-3 w-3 mr-1" />
                  {spec.property_types?.name_en} ({spec.years_experience} yrs)
                </Badge>
              ))}
            </div>
          </Section>

          {/* Bio & terms */}
          <Section title="Bio & appraisal terms">
            <div className="space-y-4">
              <div>
                <p className="text-[11px] text-ink-400 uppercase mb-1">Bio (English)</p>
                <p className="text-body-s text-ink-600">{profile.bio_en || '-'}</p>
              </div>
              {profile.bio_ar && (
                <div>
                  <p className="text-[11px] text-ink-400 uppercase mb-1">Bio (Arabic)</p>
                  <p className="text-body-s text-ink-600" dir="rtl">{profile.bio_ar}</p>
                </div>
              )}
              <InfoGrid>
                <InfoItem label="Starting price" value={profile.starting_price_egp ? `${profile.starting_price_egp} EGP` : null} />
                <InfoItem label="Turnaround" value={profile.typical_turnaround_days ? `${profile.typical_turnaround_days} days` : null} />
                <InfoItem label="Availability" value={profile.availability?.replace('_', ' ')} />
              </InfoGrid>
            </div>
          </Section>

          {/* Signature & stamp */}
          <Section title="Signature & stamp">
            <div className="grid grid-cols-2 gap-4">
              {profile.signature_url && (
                <div>
                  <p className="text-[11px] text-ink-400 uppercase mb-2">Signature</p>
                  <div className="bg-white border border-ink-100 rounded p-4">
                    <img src={profile.signature_url} alt="Signature" className="max-h-20 object-contain" />
                  </div>
                </div>
              )}
              {profile.stamp_url && (
                <div>
                  <p className="text-[11px] text-ink-400 uppercase mb-2">Stamp</p>
                  <div className="bg-white border border-ink-100 rounded p-4">
                    <img src={profile.stamp_url} alt="Stamp" className="max-h-20 object-contain" />
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* Rejection reason if exists */}
          {profile.rejection_reason && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-[11px] text-yellow-800 uppercase font-medium mb-1">Previous feedback</p>
              <p className="text-body-s text-yellow-900">{profile.rejection_reason}</p>
            </div>
          )}
        </div>

        {/* Action bar */}
        <div className="sticky bottom-0 bg-cream-50 border-t border-ink-100 px-8 py-4 flex items-center gap-4">
          <Button onClick={handleApprove} disabled={loadingAction}>
            {loadingAction ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            Approve
          </Button>
          <Button variant="secondary" onClick={() => setShowChangesModal(true)} disabled={loadingAction}>
            Request changes
          </Button>
          <Button
            variant="ghost"
            className="text-red-600 hover:text-red-700 ml-auto"
            onClick={() => setShowRejectModal(true)}
            disabled={loadingAction}
          >
            Reject
          </Button>
        </div>
      </div>

      {/* Reject modal */}
      {showRejectModal && (
        <ActionModal
          title="Reject application"
          description="This action cannot be undone. Please provide a reason for rejection."
          actionLabel="Reject"
          actionColor="red"
          reason={reason}
          setReason={setReason}
          onClose={() => {
            setShowRejectModal(false);
            setReason('');
          }}
          onConfirm={handleReject}
          loading={loadingAction}
        />
      )}

      {/* Request changes modal */}
      {showChangesModal && (
        <ActionModal
          title="Request changes"
          description="The appraiser will be notified and can update their profile."
          actionLabel="Send request"
          actionColor="emerald"
          reason={reason}
          setReason={setReason}
          onClose={() => {
            setShowChangesModal(false);
            setReason('');
          }}
          onConfirm={handleRequestChanges}
          loading={loadingAction}
        />
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-ink-100 pb-6">
      <h3 className="text-body-m font-medium text-ink-600 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-4">{children}</div>;
}

function InfoItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] text-ink-400 uppercase">{label}</p>
      <p className="text-body-s text-ink-600">{value || '-'}</p>
    </div>
  );
}

function DocumentPreview({ url, filename }: { url: string; filename: string }) {
  const isPdf = url.includes('.pdf') || filename.endsWith('.pdf');

  if (isPdf) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 p-3 bg-ink-50 rounded-md hover:bg-ink-100 transition-colors"
      >
        <FileText className="h-5 w-5 text-ink-400" />
        <span className="text-body-s text-ink-600">{filename}</span>
      </a>
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
      <img
        src={url}
        alt={filename}
        className="max-h-48 rounded border border-ink-100 object-contain"
      />
    </a>
  );
}

function ActionModal({
  title,
  description,
  actionLabel,
  actionColor,
  reason,
  setReason,
  onClose,
  onConfirm,
  loading,
}: {
  title: string;
  description: string;
  actionLabel: string;
  actionColor: 'red' | 'emerald';
  reason: string;
  setReason: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-cream-50 rounded-lg p-6 w-full max-w-md z-50 shadow-xl">
        <h3 className="text-h3 text-ink-600 mb-2">{title}</h3>
        <p className="text-body-s text-ink-400 mb-4">{description}</p>

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Enter reason..."
          className="w-full h-32 px-3 py-2 border border-ink-200 rounded-md text-body-s focus:border-emerald-500 outline-none resize-none mb-4"
        />

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!reason.trim() || loading}
            className={actionColor === 'red' ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {actionLabel}
          </Button>
        </div>
      </div>
    </>
  );
}

export default VerificationsPage;
