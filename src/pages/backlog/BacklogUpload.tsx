import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Card } from '@/src/components/ui';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  Upload,
  FileSpreadsheet,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ArrowLeft,
  Trash2,
  Eye,
  RefreshCw,
  Loader2,
  Download,
} from 'lucide-react';

type ImportStatus =
  | 'queued'
  | 'parsing'
  | 'auto_approved'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'parse_failed';

interface ImportJob {
  id: string;
  source_type: 'excel' | 'pdf';
  original_filename: string;
  status: ImportStatus;
  template_fingerprint: string | null;
  engine_match_percent: number | null;
  parser_warnings: Array<{ message: string; severity: string }>;
  created_at: string;
  parsed_at: string | null;
  resulting_report_id: string | null;
}

interface StatusCounts {
  queued: number;
  parsing: number;
  auto_approved: number;
  pending_review: number;
  approved: number;
  rejected: number;
  parse_failed: number;
}

export function BacklogUploadPage() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const navigate = useNavigate();

  const [imports, setImports] = React.useState<ImportJob[]>([]);
  const [statusCounts, setStatusCounts] = React.useState<StatusCounts>({
    queued: 0,
    parsing: 0,
    auto_approved: 0,
    pending_review: 0,
    approved: 0,
    rejected: 0,
    parse_failed: 0,
  });
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [dragActive, setDragActive] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState<ImportStatus | 'all'>('all');
  const [downloadingPdf, setDownloadingPdf] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Download PDF for a report
  const downloadPdf = async (reportId: string, filename?: string) => {
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
      link.download = `${filename?.replace(/\.[^/.]+$/, '') || 'report'}.pdf`;
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

  // Fetch imports
  const fetchImports = React.useCallback(async () => {
    if (!session?.access_token) return;

    try {
      const url = new URL('/api/imports', window.location.origin);
      if (statusFilter !== 'all') {
        url.searchParams.set('status', statusFilter);
      }

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch imports');

      const data = await res.json();
      setImports(data.imports || []);
      setStatusCounts(data.statusCounts || {
        queued: 0,
        parsing: 0,
        auto_approved: 0,
        pending_review: 0,
        approved: 0,
        rejected: 0,
        parse_failed: 0,
      });
    } catch (err) {
      console.error('Error fetching imports:', err);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, statusFilter]);

  React.useEffect(() => {
    fetchImports();
  }, [fetchImports]);

  // Auto-refresh for pending jobs
  React.useEffect(() => {
    const hasPending = imports.some(i => i.status === 'queued' || i.status === 'parsing');
    if (hasPending) {
      const interval = setInterval(fetchImports, 5000);
      return () => clearInterval(interval);
    }
  }, [imports, fetchImports]);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0 || !session?.access_token) return;

    setUploading(true);
    const batchId = crypto.randomUUID();

    try {
      for (const file of Array.from(files)) {
        // 1. Get signed upload URL
        const uploadRes = await fetch('/api/imports/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            batchId,
          }),
        });

        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          throw new Error(err.error || 'Failed to get upload URL');
        }

        const { jobId, signedUrl } = await uploadRes.json();

        // 2. Upload file to signed URL with retry logic
        let uploadSuccess = false;
        let retries = 3;
        let lastError: Error | null = null;

        while (retries > 0 && !uploadSuccess) {
          try {
            const uploadFileRes = await fetch(signedUrl, {
              method: 'PUT',
              body: file,
              headers: { 'Content-Type': file.type },
            });

            if (uploadFileRes.ok) {
              uploadSuccess = true;
            } else {
              lastError = new Error(`Upload failed: ${uploadFileRes.status}`);
              retries--;
              if (retries > 0) {
                await new Promise(r => setTimeout(r, 1000)); // Wait 1s before retry
              }
            }
          } catch (err) {
            lastError = err instanceof Error ? err : new Error('Upload failed');
            retries--;
            if (retries > 0) {
              await new Promise(r => setTimeout(r, 1000));
            }
          }
        }

        if (!uploadSuccess) {
          // Delete the orphaned job record
          await fetch(`/api/imports/${jobId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          throw lastError || new Error('Failed to upload file after retries');
        }

        // 3. Trigger processing
        await fetch(`/api/imports/${jobId}/process`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      }

      // Refresh list
      fetchImports();
    } catch (err) {
      console.error('Upload error:', err);
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleDelete = async (jobId: string) => {
    if (!session?.access_token) {
      console.error('No session token');
      return;
    }

    const confirmed = window.confirm('Are you sure you want to delete this import?');
    if (!confirmed) return;

    try {
      console.log('Deleting import:', jobId);
      const res = await fetch(`/api/imports/${jobId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Delete response:', res.status);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }

      // Refresh the list
      fetchImports();
    } catch (err) {
      console.error('Error deleting import:', err);
      alert('Failed to delete import');
    }
  };

  const getStatusIcon = (status: ImportStatus) => {
    switch (status) {
      case 'queued':
      case 'parsing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'auto_approved':
      case 'approved':
        return <CheckCircle className="h-4 w-4" />;
      case 'pending_review':
        return <Clock className="h-4 w-4" />;
      case 'rejected':
        return <XCircle className="h-4 w-4" />;
      case 'parse_failed':
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: ImportStatus) => {
    switch (status) {
      case 'queued':
      case 'parsing':
        return 'bg-blue-100 text-blue-700';
      case 'auto_approved':
      case 'approved':
        return 'bg-emerald-100 text-emerald-700';
      case 'pending_review':
        return 'bg-amber-100 text-amber-700';
      case 'rejected':
        return 'bg-red-100 text-red-700';
      case 'parse_failed':
        return 'bg-red-100 text-red-700';
    }
  };

  const getStatusLabel = (status: ImportStatus) => {
    return t(`backlog.status.${status}`, status.replace('_', ' '));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalImports = Object.values(statusCounts).reduce((a: number, b: number) => a + b, 0);
  const needsReview = statusCounts.pending_review;

  return (
    <div className="min-h-screen bg-cream-100 pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link to="/dashboard" className="text-ink-400 hover:text-ink-600">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-h3 text-ink-600">
                {t('backlog.title', 'Import Backlog')}
              </h1>
            </div>
            <p className="text-body-s text-ink-400">
              {t('backlog.subtitle', 'Upload historical Excel or PDF reports to import into the system')}
            </p>
          </div>
          {needsReview > 0 && (
            <Link to="/dashboard/backlog/review">
              <Button className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                {t('backlog.reviewQueue', 'Review Queue')} ({needsReview})
              </Button>
            </Link>
          )}
        </div>

        {/* Upload Zone */}
        <Card className="mb-8">
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
              dragActive
                ? 'border-brand-500 bg-brand-50'
                : 'border-ink-200 hover:border-ink-300'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 text-brand-500 animate-spin" />
                <p className="text-body text-ink-600">
                  {t('backlog.uploading', 'Uploading files...')}
                </p>
              </div>
            ) : (
              <>
                <Upload className="h-12 w-12 text-ink-300 mx-auto mb-4" />
                <h3 className="text-h5 text-ink-600 mb-2">
                  {t('backlog.dropzone.title', 'Drop files here or click to upload')}
                </h3>
                <p className="text-body-s text-ink-400 mb-4">
                  {t('backlog.dropzone.subtitle', 'Supports Excel (.xlsx, .xls) and PDF files')}
                </p>
                <div className="flex items-center justify-center gap-4">
                  <Button
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    {t('backlog.uploadExcel', 'Upload Excel')}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    {t('backlog.uploadPdf', 'Upload PDF')}
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files)}
                />
              </>
            )}
          </div>
        </Card>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          <button
            className={`px-4 py-2 rounded-full text-body-s whitespace-nowrap transition-colors ${
              statusFilter === 'all'
                ? 'bg-ink-600 text-cream-50'
                : 'bg-cream-200 text-ink-500 hover:bg-cream-300'
            }`}
            onClick={() => setStatusFilter('all')}
          >
            {t('dashboard.stats.all', 'All')} ({totalImports})
          </button>
          {needsReview > 0 && (
            <button
              className={`px-4 py-2 rounded-full text-body-s whitespace-nowrap transition-colors ${
                statusFilter === 'pending_review'
                  ? 'bg-amber-500 text-white'
                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
              }`}
              onClick={() => setStatusFilter('pending_review')}
            >
              {t('backlog.status.pending_review', 'Pending Review')} ({needsReview})
            </button>
          )}
          {(statusCounts.auto_approved > 0 || statusCounts.approved > 0) && (
            <button
              className={`px-4 py-2 rounded-full text-body-s whitespace-nowrap transition-colors ${
                statusFilter === 'approved'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              }`}
              onClick={() => setStatusFilter('approved')}
            >
              {t('backlog.status.approved', 'Approved')} ({statusCounts.auto_approved + statusCounts.approved})
            </button>
          )}
          {statusCounts.parse_failed > 0 && (
            <button
              className={`px-4 py-2 rounded-full text-body-s whitespace-nowrap transition-colors ${
                statusFilter === 'parse_failed'
                  ? 'bg-red-500 text-white'
                  : 'bg-red-100 text-red-700 hover:bg-red-200'
              }`}
              onClick={() => setStatusFilter('parse_failed')}
            >
              {t('backlog.status.parse_failed', 'Failed')} ({statusCounts.parse_failed})
            </button>
          )}
        </div>

        {/* Import List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-ink-400" />
          </div>
        ) : imports.length === 0 ? (
          <Card className="text-center py-12">
            <Upload className="h-12 w-12 text-ink-300 mx-auto mb-4" />
            <h3 className="text-h5 text-ink-600 mb-2">
              {t('backlog.empty.title', 'No imports yet')}
            </h3>
            <p className="text-body-s text-ink-400">
              {t('backlog.empty.subtitle', 'Upload Excel or PDF files to get started')}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {imports.map((job) => (
              <Card key={job.id} className="p-4">
                <div className="flex items-center gap-4">
                  {/* File icon */}
                  <div className={`p-3 rounded-lg ${
                    job.source_type === 'excel' ? 'bg-emerald-100' : 'bg-red-100'
                  }`}>
                    {job.source_type === 'excel' ? (
                      <FileSpreadsheet className={`h-6 w-6 ${
                        job.source_type === 'excel' ? 'text-emerald-600' : 'text-red-600'
                      }`} />
                    ) : (
                      <FileText className="h-6 w-6 text-red-600" />
                    )}
                  </div>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-body font-medium text-ink-600 truncate">
                      {job.original_filename}
                    </h4>
                    <p className="text-body-s text-ink-400">
                      {formatDate(job.created_at)}
                      {job.template_fingerprint && (
                        <span className="ml-2 text-ink-300">
                          {job.template_fingerprint}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Match percent (for Excel) */}
                  {job.engine_match_percent !== null && (
                    <div className="text-right">
                      <div className={`text-body-s font-medium ${
                        job.engine_match_percent >= 99
                          ? 'text-emerald-600'
                          : job.engine_match_percent >= 90
                          ? 'text-amber-600'
                          : 'text-red-600'
                      }`}>
                        {job.engine_match_percent.toFixed(1)}%
                      </div>
                      <div className="text-caption text-ink-400">
                        {t('backlog.engineMatch', 'engine match')}
                      </div>
                    </div>
                  )}

                  {/* Status badge */}
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-body-s font-medium ${getStatusColor(
                      job.status
                    )}`}
                  >
                    {getStatusIcon(job.status)}
                    {getStatusLabel(job.status)}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {job.status === 'pending_review' && (
                      <Link to={`/dashboard/backlog/review/${job.id}`}>
                        <Button size="sm" className="flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          {t('backlog.review', 'Review')}
                        </Button>
                      </Link>
                    )}
                    {job.resulting_report_id ? (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="flex items-center gap-1"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            downloadPdf(job.resulting_report_id!, job.original_filename);
                          }}
                          disabled={downloadingPdf === job.resulting_report_id}
                        >
                          {downloadingPdf === job.resulting_report_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          {t('backlog.downloadPdf', 'PDF')}
                        </Button>
                        <Link to={`/reports/${job.resulting_report_id}/edit`}>
                          <Button size="sm" variant="secondary" className="flex items-center gap-1">
                            <Eye className="h-4 w-4" />
                            {t('backlog.viewReport', 'View Report')}
                          </Button>
                        </Link>
                      </>
                    ) : (job.status === 'auto_approved' || job.status === 'approved') && (
                      <span className="text-caption text-amber-600 bg-amber-50 px-2 py-1 rounded">
                        {t('backlog.reportCreationFailed', 'Report creation failed - please re-upload')}
                      </span>
                    )}
                    {['queued', 'parsing', 'parse_failed'].includes(job.status) && (
                      <button
                        type="button"
                        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDelete(job.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* Warnings */}
                {job.parser_warnings && job.parser_warnings.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-ink-100">
                    <div className="flex flex-wrap gap-2">
                      {job.parser_warnings.slice(0, 3).map((w, i) => (
                        <span
                          key={i}
                          className={`text-caption px-2 py-1 rounded ${
                            w.severity === 'error'
                              ? 'bg-red-50 text-red-600'
                              : 'bg-amber-50 text-amber-600'
                          }`}
                        >
                          {w.message}
                        </span>
                      ))}
                      {job.parser_warnings.length > 3 && (
                        <span className="text-caption text-ink-400">
                          +{job.parser_warnings.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
