import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Badge, Card } from '@/src/components/ui';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  Plus,
  FileText,
  Clock,
  CheckCircle,
  Archive,
  Filter,
  ExternalLink,
  Edit3,
  Eye,
  ChevronDown,
  Upload,
  Download,
  Loader2,
  FolderOpen,
  Briefcase,
} from 'lucide-react';

type ReportStatus = 'draft' | 'submitted' | 'finalized' | 'archived';

interface Report {
  id: string;
  project_name: string | null;
  status: ReportStatus;
  property_type: { property_type: string } | null;
  report_kind: string;
  client_name: string | null;
  owner_name: string | null;
  appraisal_date: string | null;
  final_value: number | null;
  created_at: string;
  updated_at: string;
  version: number;
  address: {
    address_description: string;
    district_id: string | null;
    districts: { name_en: string; name_ar: string } | null;
  } | null;
}

interface StatusCounts {
  draft: number;
  submitted: number;
  finalized: number;
  archived: number;
}

export function DashboardPage() {
  const { t } = useTranslation();
  const { profile, session } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = React.useState<Report[]>([]);
  const [statusCounts, setStatusCounts] = React.useState<StatusCounts>({
    draft: 0,
    submitted: 0,
    finalized: 0,
    archived: 0,
  });
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState<ReportStatus | 'all'>('all');
  const [profileId, setProfileId] = React.useState<string | null>(null);
  const [profileStatus, setProfileStatus] = React.useState<string | null>(null);
  const [hasProfile, setHasProfile] = React.useState<boolean | null>(null);
  const [draftStep, setDraftStep] = React.useState<number | null>(null);
  const [showNewReportModal, setShowNewReportModal] = React.useState(false);
  const [downloadingPdf, setDownloadingPdf] = React.useState<string | null>(null);

  // Download PDF for a finalized report
  const downloadPdf = async (reportId: string, projectName?: string | null) => {
    if (!session?.access_token) return;
    setDownloadingPdf(reportId);

    try {
      const res = await fetch(`/api/reports/${reportId}/pdf`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate PDF');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${projectName || 'report'}-${reportId.slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      alert(err instanceof Error ? err.message : 'Failed to download PDF');
    } finally {
      setDownloadingPdf(null);
    }
  };

  // Fetch reports
  const fetchReports = React.useCallback(async () => {
    if (!session?.access_token) return;

    try {
      const url = new URL('/api/reports', window.location.origin);
      if (statusFilter !== 'all') {
        url.searchParams.set('status', statusFilter);
      }

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch reports');

      const data = await res.json();
      setReports(data.reports || []);
      setStatusCounts(data.statusCounts || { draft: 0, submitted: 0, finalized: 0, archived: 0 });
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, statusFilter]);

  React.useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Get appraiser profile ID and status
  React.useEffect(() => {
    if (session?.access_token) {
      fetch('/api/onboarding/status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.profileId) {
            setProfileId(data.profileId);
          }
          if (data.profileStatus) {
            setProfileStatus(data.profileStatus);
          }
          setHasProfile(!!data.hasProfile);
          setDraftStep(data.draftStep || null);
        })
        .catch(console.error);
    }
  }, [session]);

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    return new Intl.NumberFormat('en-EG', {
      style: 'currency',
      currency: 'EGP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusIcon = (status: ReportStatus) => {
    switch (status) {
      case 'draft':
        return <Edit3 className="h-4 w-4" />;
      case 'submitted':
        return <Clock className="h-4 w-4" />;
      case 'finalized':
        return <CheckCircle className="h-4 w-4" />;
      case 'archived':
        return <Archive className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: ReportStatus) => {
    switch (status) {
      case 'draft':
        return 'bg-amber-100 text-amber-700';
      case 'submitted':
        return 'bg-blue-100 text-blue-700';
      case 'finalized':
        return 'bg-emerald-100 text-emerald-700';
      case 'archived':
        return 'bg-ink-100 text-ink-500';
    }
  };

  const totalReports = statusCounts.draft + statusCounts.submitted + statusCounts.finalized + statusCounts.archived;

  return (
    <div className="min-h-screen bg-cream-100 pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-5">
        {/* Incomplete-onboarding banner: appraiser has not submitted a profile yet */}
        {hasProfile === false && (
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-body-s font-medium text-amber-900">Complete your appraiser profile</p>
                <p className="text-[13px] text-amber-700">
                  Finish onboarding and submit your profile for verification before you can be approved and receive work
                  {draftStep ? ` — you're on step ${draftStep} of 6.` : '.'}
                </p>
              </div>
            </div>
            <Link to="/onboarding" className="flex-shrink-0">
              <Button variant="primary">Continue onboarding</Button>
            </Link>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-h3 text-ink-600">
                {t('dashboard.title')}
              </h1>
              {profileStatus && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${
                    profileStatus === 'verified'
                      ? 'bg-emerald-100 text-emerald-700'
                      : profileStatus === 'pending_verification'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {profileStatus === 'verified' && <CheckCircle className="h-3.5 w-3.5" />}
                  {profileStatus === 'pending_verification' && <Clock className="h-3.5 w-3.5" />}
                  {profileStatus === 'verified'
                    ? t('dashboard.status.verified')
                    : profileStatus === 'pending_verification'
                    ? t('dashboard.status.pending')
                    : t('dashboard.status.rejected')}
                </span>
              )}
            </div>
            <p className="text-body-s text-ink-400">
              {t('dashboard.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {profileId && (
              <Link to={`/appraisers/${profileId}`}>
                <Button variant="secondary" className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  {t('profile.card.viewProfile', 'View Profile')}
                </Button>
              </Link>
            )}
            <Link to="/appraiser/jobs">
              <Button variant="secondary" className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                {t('dashboard.clientJobs', 'Client Jobs')}
              </Button>
            </Link>
            <Link to="/dashboard/reports">
              <Button variant="secondary" className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                {t('dashboard.myReports', 'My Reports')}
              </Button>
            </Link>
            <Link to="/dashboard/backlog">
              <Button variant="secondary" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                {t('backlog.title', 'Import Backlog')}
              </Button>
            </Link>
            <Button onClick={() => setShowNewReportModal(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {t('dashboard.newReport.title', 'New Report')}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <button
            onClick={() => setStatusFilter('all')}
            className={`text-left p-4 rounded-md border transition-colors ${
              statusFilter === 'all'
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-ink-100 bg-cream-50 hover:border-ink-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-ink-400" />
              <span className="text-[11px] font-medium text-ink-400 uppercase tracking-wider">{t('dashboard.stats.all')}</span>
            </div>
            <span className="text-h4 text-ink-600">{totalReports}</span>
          </button>

          <button
            onClick={() => setStatusFilter('draft')}
            className={`text-left p-4 rounded-md border transition-colors ${
              statusFilter === 'draft'
                ? 'border-amber-500 bg-amber-50'
                : 'border-ink-100 bg-cream-50 hover:border-ink-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Edit3 className="h-4 w-4 text-amber-500" />
              <span className="text-[11px] font-medium text-ink-400 uppercase tracking-wider">{t('dashboard.stats.drafts')}</span>
            </div>
            <span className="text-h4 text-ink-600">{statusCounts.draft}</span>
          </button>

          <button
            onClick={() => setStatusFilter('finalized')}
            className={`text-left p-4 rounded-md border transition-colors ${
              statusFilter === 'finalized'
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-ink-100 bg-cream-50 hover:border-ink-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <span className="text-[11px] font-medium text-ink-400 uppercase tracking-wider">{t('dashboard.stats.finalized')}</span>
            </div>
            <span className="text-h4 text-ink-600">{statusCounts.finalized}</span>
          </button>

          <button
            onClick={() => setStatusFilter('archived')}
            className={`text-left p-4 rounded-md border transition-colors ${
              statusFilter === 'archived'
                ? 'border-ink-300 bg-ink-50'
                : 'border-ink-100 bg-cream-50 hover:border-ink-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Archive className="h-4 w-4 text-ink-400" />
              <span className="text-[11px] font-medium text-ink-400 uppercase tracking-wider">{t('dashboard.stats.archived')}</span>
            </div>
            <span className="text-h4 text-ink-600">{statusCounts.archived}</span>
          </button>
        </div>

        {/* Reports List */}
        <div className="bg-cream-50 rounded-lg border border-ink-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-body-s text-ink-400">{t('common.loading', 'Loading...')}</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="h-12 w-12 text-ink-200 mx-auto mb-4" />
              <h3 className="text-body-m font-medium text-ink-600 mb-2">
                {statusFilter === 'all' ? t('dashboard.empty.title') : t('dashboard.empty.titleFiltered', { status: statusFilter })}
              </h3>
              <p className="text-body-s text-ink-400 mb-6">
                {statusFilter === 'all'
                  ? t('dashboard.empty.message')
                  : t('dashboard.empty.messageFiltered', { status: statusFilter })}
              </p>
              {statusFilter === 'all' && (
                <Button onClick={() => setShowNewReportModal(true)} className="flex items-center gap-2 mx-auto">
                  <Plus className="h-4 w-4" />
                  {t('dashboard.newReport.create')}
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-ink-100">
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">
                    {t('dashboard.table.projectAddress')}
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">
                    {t('dashboard.table.client')}
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">
                    {t('dashboard.table.status')}
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">
                    {t('dashboard.table.value')}
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-ink-400 uppercase tracking-wider">
                    {t('dashboard.table.lastUpdated')}
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-medium text-ink-400 uppercase tracking-wider">
                    {t('dashboard.table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr
                    key={report.id}
                    className="border-b border-ink-50 hover:bg-cream-100/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/reports/${report.id}/edit`)}
                  >
                    <td className="px-4 py-4">
                      <div>
                        <p className="text-body-s font-medium text-ink-600">
                          {report.project_name || report.address?.address_description || t('dashboard.untitledReport', 'Untitled Report')}
                        </p>
                        {report.address?.districts && (
                          <p className="text-[12px] text-ink-400 mt-0.5">
                            {report.address.districts.name_en}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-body-s text-ink-500">
                        {report.client_name || '-'}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium ${getStatusColor(
                          report.status
                        )}`}
                      >
                        {getStatusIcon(report.status)}
                        {t(`dashboard.reportStatus.${report.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-body-s text-ink-600 font-medium">
                        {formatCurrency(report.final_value)}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-body-s text-ink-400">
                        {formatDate(report.updated_at)}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {report.status === 'finalized' && (
                          <Button
                            variant="ghost"
                            className="text-ink-400 hover:text-emerald-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadPdf(report.id, report.project_name);
                            }}
                            disabled={downloadingPdf === report.id}
                          >
                            {downloadingPdf === report.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          className="text-emerald-600 hover:text-emerald-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/reports/${report.id}/edit`);
                          }}
                        >
                          {report.status === 'finalized' ? t('common.view', 'View') : t('common.edit', 'Edit')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* New Report Modal */}
      {showNewReportModal && (
        <NewReportModal
          onClose={() => setShowNewReportModal(false)}
          onCreated={(reportId) => {
            setShowNewReportModal(false);
            navigate(`/reports/${reportId}/edit`);
          }}
        />
      )}
    </div>
  );
}

// New Report Modal Component
function NewReportModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (reportId: string) => void;
}) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [propertyType, setPropertyType] = React.useState('villa');
  const [addressDescription, setAddressDescription] = React.useState('');
  const [projectName, setProjectName] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const handleCreate = async () => {
    if (!addressDescription.trim()) {
      setError(t('dashboard.newReport.addressRequired', 'Address description is required'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          propertyData: {
            property_type: propertyType,
            address_description: addressDescription,
            project_name: projectName || null,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create report');
      }

      const data = await res.json();
      onCreated(data.report.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-cream-50 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
        <h2 className="text-h4 text-ink-600 mb-4">{t('dashboard.newReport.title')}</h2>

        <div className="space-y-4">
          {/* Property Type */}
          <div>
            <label className="text-[11px] font-medium text-ink-400 uppercase tracking-wider block mb-2">
              {t('dashboard.newReport.propertyType')}
            </label>
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              className="w-full bg-cream-100 border border-ink-100 rounded-md px-3 py-2 text-body-s text-ink-600 focus:border-emerald-500 focus:outline-none"
            >
              <option value="apartment">{t('propertyTypes.apartment', 'Apartment')}</option>
              <option value="villa">{t('propertyTypes.villa', 'Villa')}</option>
              <option value="duplex">{t('propertyTypes.duplex', 'Duplex')}</option>
              <option value="compound_unit">{t('propertyTypes.compoundUnit', 'Compound Unit')}</option>
              <option value="roof">{t('propertyTypes.roof', 'Roof')}</option>
            </select>
          </div>

          {/* Project Name */}
          <div>
            <label className="text-[11px] font-medium text-ink-400 uppercase tracking-wider block mb-2">
              {t('dashboard.newReport.projectName')}
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g., Villa Solia"
              className="w-full bg-cream-100 border border-ink-100 rounded-md px-3 py-2 text-body-s text-ink-600 placeholder:text-ink-300 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Address Description */}
          <div>
            <label className="text-[11px] font-medium text-ink-400 uppercase tracking-wider block mb-2">
              {t('dashboard.newReport.addressDescription')} *
            </label>
            <textarea
              value={addressDescription}
              onChange={(e) => setAddressDescription(e.target.value)}
              placeholder={t('dashboard.newReport.addressPlaceholder', 'Enter the property address...')}
              rows={3}
              className="w-full bg-cream-100 border border-ink-100 rounded-md px-3 py-2 text-body-s text-ink-600 placeholder:text-ink-300 focus:border-emerald-500 focus:outline-none resize-none"
            />
          </div>

          {error && (
            <p className="text-body-s text-red-600">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {t('dashboard.newReport.cancel')}
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? t('dashboard.newReport.creating') : t('dashboard.newReport.create')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
