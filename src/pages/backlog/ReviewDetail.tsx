import * as React from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Card } from '@/src/components/ui';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  ArrowLeft,
  FileSpreadsheet,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Edit3,
  Download,
  Loader2,
  ChevronDown,
  ChevronUp,
  Image,
} from 'lucide-react';

interface ExtractedImage {
  label: string;
  path: string;
  url: string;
}

interface ImportJob {
  id: string;
  source_type: 'excel' | 'pdf';
  original_filename: string;
  status: string;
  source_storage_path: string;
  template_fingerprint: string | null;
  engine_match_percent: number | null;
  engine_discrepancies: Array<{
    field: string;
    label: string;
    typed: number;
    computed: number;
    deltaPercent: number;
  }>;
  parser_warnings: Array<{ field?: string; message: string; severity: string }>;
  extracted_data: Record<string, unknown> & {
    _images?: ExtractedImage[];
    _imageSummary?: string;
  } | null;
  engine_computed: Record<string, unknown> | null;
  created_at: string;
  parsed_at: string | null;
}

export function ReviewDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const navigate = useNavigate();

  const [job, setJob] = React.useState<ImportJob | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState('');
  const [showRejectModal, setShowRejectModal] = React.useState(false);
  const [sourceUrl, setSourceUrl] = React.useState<string | null>(null);
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
    new Set(['identification', 'physical', 'reconciliation'])
  );
  const [corrections, setCorrections] = React.useState<Record<string, unknown>>({});

  // Fetch job details
  React.useEffect(() => {
    const fetchJob = async () => {
      if (!session?.access_token || !id) return;

      try {
        const res = await fetch(`/api/imports/${id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (!res.ok) throw new Error('Failed to fetch');

        const data = await res.json();
        setJob(data);
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [session?.access_token, id]);

  // Fetch source file URL
  const fetchSourceUrl = async () => {
    if (!session?.access_token || !id) return;

    try {
      const res = await fetch(`/api/imports/${id}/source-url`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) throw new Error('Failed to get URL');

      const data = await res.json();
      setSourceUrl(data.signedUrl);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleApprove = async () => {
    if (!session?.access_token || !id) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/imports/${id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ corrections }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to approve');
      }

      navigate('/dashboard/backlog/review');
    } catch (err) {
      console.error('Error:', err);
      alert(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!session?.access_token || !id || !rejectReason.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/imports/${id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ reason: rejectReason }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to reject');
      }

      navigate('/dashboard/backlog/review');
    } catch (err) {
      console.error('Error:', err);
      alert(err instanceof Error ? err.message : 'Rejection failed');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') {
      return value.toLocaleString('en-EG');
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    return String(value);
  };

  const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
    const parts = path.split('.');
    let value: unknown = obj;
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return value;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-100 pt-24 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-ink-400" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-cream-100 pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-5 text-center">
          <h2 className="text-h4 text-ink-600 mb-4">
            {t('backlog.notFound', 'Import not found')}
          </h2>
          <Link to="/dashboard/backlog/review">
            <Button variant="secondary">{t('common.back', 'Back')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const extracted = job.extracted_data || {};
  const sections = [
    { id: 'identification', label: t('reports.sections.identification', 'Identification'), data: extracted.identification },
    { id: 'physical', label: t('reports.sections.physical', 'Physical Characteristics'), data: extracted.physical },
    { id: 'marketStudy', label: t('reports.sections.marketStudy', 'Market Study'), data: extracted.marketStudy },
    { id: 'costApproach', label: t('reports.sections.costApproach', 'Cost Approach'), data: extracted.costApproach },
    { id: 'salesComparison', label: t('reports.sections.salesComparison', 'Sales Comparison'), data: extracted.salesComparison },
    { id: 'incomeApproach', label: t('reports.sections.incomeApproach', 'Income Approach'), data: extracted.incomeApproach },
    { id: 'grm', label: t('reports.sections.grm', 'GRM'), data: extracted.grm },
    { id: 'reconciliation', label: t('reports.sections.reconciliation', 'Reconciliation'), data: extracted.reconciliation },
  ];

  return (
    <div className="min-h-screen bg-cream-100 pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link to="/dashboard/backlog/review" className="text-ink-400 hover:text-ink-600">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-h3 text-ink-600">
                {t('backlog.reviewImport', 'Review Import')}
              </h1>
            </div>
            <p className="text-body-s text-ink-400 flex items-center gap-2">
              {job.source_type === 'excel' ? (
                <FileSpreadsheet className="h-4 w-4" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              {job.original_filename}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={fetchSourceUrl}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {t('backlog.viewSource', 'View Source')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowRejectModal(true)}
              className="flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50"
            >
              <XCircle className="h-4 w-4" />
              {t('backlog.reject', 'Reject')}
            </Button>
            <Button
              onClick={handleApprove}
              disabled={submitting}
              className="flex items-center gap-2"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              {t('backlog.approve', 'Approve & Create Report')}
            </Button>
          </div>
        </div>

        {/* Source file viewer */}
        {sourceUrl && (
          <Card className="mb-6 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-h5 text-ink-600">
                {t('backlog.sourceFile', 'Source File')}
              </h3>
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="secondary">
                  {t('backlog.openInNewTab', 'Open in New Tab')}
                </Button>
              </a>
            </div>
            {job.source_type === 'pdf' ? (
              <iframe
                src={sourceUrl}
                className="w-full h-[600px] border border-ink-200 rounded-lg"
                title="Source PDF"
              />
            ) : (
              <div className="text-center py-8 text-ink-400">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4" />
                <p>{t('backlog.excelPreviewUnavailable', 'Excel preview not available. Click "Open in New Tab" to download.')}</p>
              </div>
            )}
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Extracted Data */}
          <div>
            <h2 className="text-h4 text-ink-600 mb-4">
              {t('backlog.extractedData', 'Extracted Data')}
            </h2>

            {/* Warnings */}
            {job.parser_warnings && job.parser_warnings.length > 0 && (
              <Card className="mb-4 p-4 border-amber-200 bg-amber-50">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-body font-medium text-amber-800 mb-2">
                      {t('backlog.parserWarnings', 'Parser Warnings')}
                    </h4>
                    <ul className="space-y-1">
                      {job.parser_warnings.map((w, i) => (
                        <li key={i} className="text-body-s text-amber-700">
                          {w.field && <span className="font-mono text-amber-600">{w.field}: </span>}
                          {w.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            )}

            {/* Extracted Images */}
            {extracted._images && extracted._images.length > 0 && (
              <Card className="mb-4 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Image className="h-5 w-5 text-ink-500" />
                  <h3 className="text-h5 text-ink-600">
                    {t('backlog.extractedImages', 'Extracted Images')} ({extracted._images.length})
                  </h3>
                </div>
                {extracted._imageSummary && (
                  <p className="text-body-s text-ink-400 mb-4">{extracted._imageSummary}</p>
                )}
                <div className="grid grid-cols-3 gap-3">
                  {extracted._images.map((img, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={img.url}
                        alt={img.label}
                        className="w-full h-24 object-cover rounded-lg border border-ink-100"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23f5f5f5" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23999" font-size="12">No preview</text></svg>';
                        }}
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-ink-900/70 text-white text-[10px] px-2 py-1 rounded-b-lg truncate">
                        {img.label}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Data sections */}
            {sections.map((section) => {
              if (!section.data) return null;
              const data = section.data as Record<string, unknown>;
              const isExpanded = expandedSections.has(section.id);

              return (
                <Card key={section.id} className="mb-4">
                  <button
                    className="w-full p-4 flex items-center justify-between text-left"
                    onClick={() => toggleSection(section.id)}
                  >
                    <h3 className="text-h5 text-ink-600">{section.label}</h3>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-ink-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-ink-400" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-ink-100 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        {Object.entries(data)
                          .filter(([key]) => !key.startsWith('_'))
                          .map(([key, value]) => (
                            <div key={key}>
                              <div className="text-caption text-ink-400 mb-1">
                                {key}
                              </div>
                              <div className="text-body-s font-medium text-ink-600">
                                {formatValue(value)}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Right: Engine Verification */}
          <div>
            <h2 className="text-h4 text-ink-600 mb-4">
              {t('backlog.engineVerification', 'Engine Verification')}
            </h2>

            {/* Match percentage */}
            {job.engine_match_percent !== null && (
              <Card className="mb-4 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-h5 text-ink-600">
                    {t('backlog.engineMatchLabel', 'Calculation Match')}
                  </h3>
                  <span className={`text-h4 font-bold ${
                    job.engine_match_percent >= 99
                      ? 'text-emerald-600'
                      : job.engine_match_percent >= 90
                      ? 'text-amber-600'
                      : 'text-red-600'
                  }`}>
                    {job.engine_match_percent.toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 bg-cream-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      job.engine_match_percent >= 99
                        ? 'bg-emerald-500'
                        : job.engine_match_percent >= 90
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${job.engine_match_percent}%` }}
                  />
                </div>
                <p className="text-body-s text-ink-400 mt-2">
                  {job.engine_match_percent >= 99
                    ? t('backlog.matchExcellent', 'Excellent match - calculations verified')
                    : job.engine_match_percent >= 90
                    ? t('backlog.matchGood', 'Good match - minor discrepancies detected')
                    : t('backlog.matchPoor', 'Significant discrepancies - review carefully')}
                </p>
              </Card>
            )}

            {/* Discrepancies */}
            {job.engine_discrepancies && job.engine_discrepancies.length > 0 && (
              <Card className="mb-4 p-4 border-amber-200">
                <h3 className="text-h5 text-ink-600 mb-4">
                  {t('backlog.discrepancies', 'Discrepancies')}
                </h3>
                <div className="space-y-3">
                  {job.engine_discrepancies.map((d, i) => (
                    <div key={i} className="p-3 bg-cream-50 rounded-lg">
                      <div className="text-body-s font-medium text-ink-600 mb-2">
                        {d.label}
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-body-s">
                        <div>
                          <span className="text-ink-400">{t('backlog.typedValue', 'Typed')}:</span>
                          <span className="ml-2 font-mono text-ink-600">
                            {d.typed.toLocaleString('en-EG')}
                          </span>
                        </div>
                        <div>
                          <span className="text-ink-400">{t('backlog.computedValue', 'Computed')}:</span>
                          <span className="ml-2 font-mono text-ink-600">
                            {d.computed.toLocaleString('en-EG')}
                          </span>
                        </div>
                      </div>
                      <div className={`text-caption mt-2 ${
                        d.deltaPercent > 5 ? 'text-red-600' : 'text-amber-600'
                      }`}>
                        {d.deltaPercent > 0 ? '+' : ''}{d.deltaPercent.toFixed(2)}% difference
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Engine computed values */}
            {job.engine_computed && (
              <Card className="p-4">
                <h3 className="text-h5 text-ink-600 mb-4">
                  {t('backlog.computedValues', 'Engine Computed Values')}
                </h3>
                {Object.entries(job.engine_computed).map(([approach, values]) => (
                  <div key={approach} className="mb-4 last:mb-0">
                    <h4 className="text-body font-medium text-ink-500 mb-2 capitalize">
                      {approach.replace(/([A-Z])/g, ' $1').trim()}
                    </h4>
                    {values && typeof values === 'object' && (
                      <div className="grid grid-cols-2 gap-2 text-body-s">
                        {Object.entries(values as Record<string, unknown>).map(([key, val]) => (
                          <div key={key} className="flex justify-between p-2 bg-cream-50 rounded">
                            <span className="text-ink-400">{key}:</span>
                            <span className="font-mono text-ink-600">{formatValue(val)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </Card>
            )}
          </div>
        </div>

        {/* Reject Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-ink-900/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md p-6">
              <h3 className="text-h4 text-ink-600 mb-4">
                {t('backlog.rejectImport', 'Reject Import')}
              </h3>
              <p className="text-body-s text-ink-400 mb-4">
                {t('backlog.rejectDescription', 'Please provide a reason for rejecting this import. The file will be kept but no report will be created.')}
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t('backlog.rejectReasonPlaceholder', 'Enter reason for rejection...')}
                className="w-full h-32 p-3 border border-ink-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <div className="flex justify-end gap-3 mt-4">
                <Button
                  variant="secondary"
                  onClick={() => setShowRejectModal(false)}
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  onClick={handleReject}
                  disabled={!rejectReason.trim() || submitting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t('backlog.confirmReject', 'Reject Import')
                  )}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
