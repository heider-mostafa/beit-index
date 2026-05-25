import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Card } from '@/src/components/ui';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  ArrowLeft,
  FileSpreadsheet,
  FileText,
  Clock,
  Eye,
  ChevronRight,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

interface ImportJob {
  id: string;
  source_type: 'excel' | 'pdf';
  original_filename: string;
  status: string;
  template_fingerprint: string | null;
  engine_match_percent: number | null;
  parser_warnings: Array<{ message: string; severity: string }>;
  extracted_data: Record<string, unknown> | null;
  created_at: string;
}

export function ReviewQueuePage() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const navigate = useNavigate();

  const [imports, setImports] = React.useState<ImportJob[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Fetch pending review imports
  React.useEffect(() => {
    const fetchPending = async () => {
      if (!session?.access_token) return;

      try {
        const res = await fetch('/api/imports?status=pending_review', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (!res.ok) throw new Error('Failed to fetch');

        const data = await res.json();
        setImports(data.imports || []);
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPending();
  }, [session?.access_token]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getExtractedValue = (job: ImportJob, path: string): string => {
    if (!job.extracted_data) return '-';
    const parts = path.split('.');
    let value: unknown = job.extracted_data;
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        return '-';
      }
    }
    if (typeof value === 'number') {
      return value.toLocaleString('en-EG');
    }
    return String(value || '-');
  };

  return (
    <div className="min-h-screen bg-cream-100 pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link to="/dashboard/backlog" className="text-ink-400 hover:text-ink-600">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-h3 text-ink-600">
                {t('backlog.reviewQueue', 'Review Queue')}
              </h1>
            </div>
            <p className="text-body-s text-ink-400">
              {t('backlog.reviewQueueSubtitle', 'Review and approve imported reports before they are finalized')}
            </p>
          </div>
        </div>

        {/* Queue List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-ink-400" />
          </div>
        ) : imports.length === 0 ? (
          <Card className="text-center py-12">
            <Clock className="h-12 w-12 text-ink-300 mx-auto mb-4" />
            <h3 className="text-h5 text-ink-600 mb-2">
              {t('backlog.reviewEmpty.title', 'No reports to review')}
            </h3>
            <p className="text-body-s text-ink-400 mb-4">
              {t('backlog.reviewEmpty.subtitle', 'All imported reports have been processed')}
            </p>
            <Link to="/dashboard/backlog">
              <Button variant="secondary">
                {t('backlog.backToUpload', 'Back to Upload')}
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-4">
            {imports.map((job) => (
              <Card key={job.id} className="p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  {/* File icon */}
                  <div className={`p-3 rounded-lg flex-shrink-0 ${
                    job.source_type === 'excel' ? 'bg-emerald-100' : 'bg-red-100'
                  }`}>
                    {job.source_type === 'excel' ? (
                      <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
                    ) : (
                      <FileText className="h-8 w-8 text-red-600" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-h5 text-ink-600 truncate">
                        {job.original_filename}
                      </h4>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-medium bg-amber-100 text-amber-700">
                        <Clock className="h-3.5 w-3.5" />
                        {t('backlog.status.pending_review', 'Pending Review')}
                      </span>
                    </div>

                    <p className="text-body-s text-ink-400 mb-4">
                      {t('backlog.uploadedAt', 'Uploaded')} {formatDate(job.created_at)}
                      {job.template_fingerprint && (
                        <span className="ml-2 text-ink-300">
                          {job.template_fingerprint}
                        </span>
                      )}
                    </p>

                    {/* Extracted preview */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-cream-50 rounded-lg">
                      <div>
                        <div className="text-caption text-ink-400 mb-1">
                          {t('backlog.preview.clientName', 'Client')}
                        </div>
                        <div className="text-body-s font-medium text-ink-600">
                          {getExtractedValue(job, 'identification.clientName')}
                        </div>
                      </div>
                      <div>
                        <div className="text-caption text-ink-400 mb-1">
                          {t('backlog.preview.propertyType', 'Property Type')}
                        </div>
                        <div className="text-body-s font-medium text-ink-600">
                          {getExtractedValue(job, 'identification.propertyType')}
                        </div>
                      </div>
                      <div>
                        <div className="text-caption text-ink-400 mb-1">
                          {t('backlog.preview.area', 'Area (sqm)')}
                        </div>
                        <div className="text-body-s font-medium text-ink-600">
                          {getExtractedValue(job, 'physical.unitNetArea')}
                        </div>
                      </div>
                      <div>
                        <div className="text-caption text-ink-400 mb-1">
                          {t('backlog.preview.finalValue', 'Final Value')}
                        </div>
                        <div className="text-body-s font-medium text-ink-600">
                          {getExtractedValue(job, 'reconciliation.finalValue')} EGP
                        </div>
                      </div>
                    </div>

                    {/* Warnings */}
                    {job.parser_warnings && job.parser_warnings.length > 0 && (
                      <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 rounded-lg">
                        <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="text-body-s text-amber-700">
                          {job.parser_warnings.length === 1
                            ? job.parser_warnings[0].message
                            : t('backlog.warningsCount', '{{count}} warnings', {
                                count: job.parser_warnings.length,
                              })}
                        </div>
                      </div>
                    )}

                    {/* Engine match for Excel */}
                    {job.engine_match_percent !== null && (
                      <div className="mt-4 flex items-center gap-3">
                        <div className="flex-1 h-2 bg-cream-200 rounded-full overflow-hidden">
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
                        <span className={`text-body-s font-medium ${
                          job.engine_match_percent >= 99
                            ? 'text-emerald-600'
                            : job.engine_match_percent >= 90
                            ? 'text-amber-600'
                            : 'text-red-600'
                        }`}>
                          {job.engine_match_percent.toFixed(1)}% {t('backlog.engineMatch', 'engine match')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action */}
                  <Link
                    to={`/dashboard/backlog/review/${job.id}`}
                    className="flex-shrink-0"
                  >
                    <Button className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      {t('backlog.review', 'Review')}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
