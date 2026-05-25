import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Card, Badge } from '@/src/components/ui';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  FileText,
  CheckCircle,
  ArrowLeft,
  Eye,
  Download,
  Loader2,
  MapPin,
  Calendar,
  User,
  Building,
  DollarSign,
} from 'lucide-react';

interface Report {
  id: string;
  project_name: string | null;
  status: string;
  report_kind: string;
  client_name: string | null;
  owner_name: string | null;
  appraisal_date: string | null;
  final_value: number | null;
  land_value: number | null;
  building_value: number | null;
  unit_net_area: number | null;
  created_at: string;
  updated_at: string;
  source: string | null;
  property: {
    property_type: string;
    address_description: string;
    governorate?: { name_en: string; name_ar: string } | null;
    city?: { name_en: string; name_ar: string } | null;
    district?: { name_en: string; name_ar: string } | null;
  } | null;
  appraiser?: {
    full_name_en: string;
    full_name_ar: string | null;
  } | null;
}

export function ReportsPage() {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const navigate = useNavigate();
  const isAr = i18n.language === 'ar';

  const [reports, setReports] = React.useState<Report[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [downloadingPdf, setDownloadingPdf] = React.useState<string | null>(null);
  const [selectedReport, setSelectedReport] = React.useState<Report | null>(null);

  // Fetch finalized reports
  const fetchReports = React.useCallback(async () => {
    if (!session?.access_token) return;

    try {
      const url = new URL('/api/reports', window.location.origin);
      url.searchParams.set('status', 'finalized');

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch reports');

      const data = await res.json();
      setReports(data.reports || []);
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  React.useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Download PDF
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

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '-';
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

  const getPropertyTypeLabel = (type: string) => {
    const labels: Record<string, { en: string; ar: string }> = {
      apartment: { en: 'Apartment', ar: 'شقة' },
      villa: { en: 'Villa', ar: 'فيلا' },
      duplex: { en: 'Duplex', ar: 'دوبلكس' },
      compound_unit: { en: 'Compound Unit', ar: 'وحدة مجمع' },
      roof: { en: 'Roof', ar: 'روف' },
      commercial_shop: { en: 'Commercial Shop', ar: 'محل تجاري' },
      office: { en: 'Office', ar: 'مكتب' },
      building: { en: 'Building', ar: 'عمارة' },
    };
    return labels[type]?.[isAr ? 'ar' : 'en'] || type;
  };

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
                {t('reports.title', 'My Reports')}
              </h1>
            </div>
            <p className="text-body-s text-ink-400">
              {t('reports.subtitle', 'View and download your finalized appraisal reports')}
            </p>
          </div>
          <div className="flex items-center gap-2 text-body-s text-ink-400">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            {reports.length} {t('reports.finalized', 'finalized reports')}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-ink-400" />
          </div>
        ) : reports.length === 0 ? (
          <Card className="text-center py-12">
            <FileText className="h-12 w-12 text-ink-300 mx-auto mb-4" />
            <h3 className="text-h5 text-ink-600 mb-2">
              {t('reports.empty.title', 'No finalized reports yet')}
            </h3>
            <p className="text-body-s text-ink-400 mb-6">
              {t('reports.empty.subtitle', 'Reports will appear here once they are finalized')}
            </p>
            <Link to="/dashboard">
              <Button variant="secondary">
                {t('reports.backToDashboard', 'Back to Dashboard')}
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Reports List */}
            <div className="lg:col-span-1 space-y-3">
              {reports.map((report) => (
                <Card
                  key={report.id}
                  className={`p-4 cursor-pointer transition-all hover:border-emerald-300 ${
                    selectedReport?.id === report.id
                      ? 'border-emerald-500 bg-emerald-50/50'
                      : ''
                  }`}
                  onClick={() => setSelectedReport(report)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-body font-medium text-ink-600 truncate">
                        {report.project_name || report.property?.address_description || t('reports.untitled', 'Untitled Report')}
                      </h4>
                      <p className="text-caption text-ink-400 truncate">
                        {report.property?.district?.[isAr ? 'name_ar' : 'name_en'] ||
                         report.property?.governorate?.[isAr ? 'name_ar' : 'name_en'] || '-'}
                      </p>
                    </div>
                    <Badge className="ml-2 bg-emerald-100 text-emerald-700">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {t('reports.finalized', 'Finalized')}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-caption text-ink-400">
                    <span>{formatDate(report.appraisal_date)}</span>
                    <span className="font-medium text-ink-600">
                      {formatCurrency(report.final_value)}
                    </span>
                  </div>
                </Card>
              ))}
            </div>

            {/* Report Detail Panel */}
            <div className="lg:col-span-2">
              {selectedReport ? (
                <Card className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-6 pb-6 border-b border-ink-100">
                    <div>
                      <h2 className="text-h4 text-ink-600 mb-1">
                        {selectedReport.project_name || selectedReport.property?.address_description || t('reports.untitled', 'Untitled Report')}
                      </h2>
                      <p className="text-body-s text-ink-400">
                        {getPropertyTypeLabel(selectedReport.property?.property_type || 'apartment')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        className="flex items-center gap-2"
                        onClick={() => downloadPdf(selectedReport.id, selectedReport.project_name)}
                        disabled={downloadingPdf === selectedReport.id}
                      >
                        {downloadingPdf === selectedReport.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        {t('reports.downloadPdf', 'Download PDF')}
                      </Button>
                      <Link to={`/reports/${selectedReport.id}/edit`}>
                        <Button className="flex items-center gap-2">
                          <Eye className="h-4 w-4" />
                          {t('reports.viewDetails', 'View Details')}
                        </Button>
                      </Link>
                    </div>
                  </div>

                  {/* Value Summary */}
                  <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-emerald-50 rounded-lg">
                    <div className="text-center">
                      <p className="text-caption text-ink-400 mb-1">{t('reports.finalValue', 'Final Value')}</p>
                      <p className="text-h4 text-emerald-600 font-semibold">
                        {formatCurrency(selectedReport.final_value)}
                      </p>
                    </div>
                    <div className="text-center border-x border-emerald-200">
                      <p className="text-caption text-ink-400 mb-1">{t('reports.landValue', 'Land Value')}</p>
                      <p className="text-body font-medium text-ink-600">
                        {formatCurrency(selectedReport.land_value)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-caption text-ink-400 mb-1">{t('reports.buildingValue', 'Building Value')}</p>
                      <p className="text-body font-medium text-ink-600">
                        {formatCurrency(selectedReport.building_value)}
                      </p>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* Property Info */}
                    <div>
                      <h3 className="text-eyebrow text-ink-400 mb-3">{t('reports.propertyInfo', 'Property Information')}</h3>
                      <div className="space-y-3">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-ink-300 mt-0.5" />
                          <div>
                            <p className="text-body-s text-ink-600">
                              {selectedReport.property?.address_description || '-'}
                            </p>
                            <p className="text-caption text-ink-400">
                              {[
                                selectedReport.property?.district?.[isAr ? 'name_ar' : 'name_en'],
                                selectedReport.property?.city?.[isAr ? 'name_ar' : 'name_en'],
                                selectedReport.property?.governorate?.[isAr ? 'name_ar' : 'name_en'],
                              ].filter(Boolean).join(', ') || '-'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-ink-300" />
                          <p className="text-body-s text-ink-600">
                            {selectedReport.unit_net_area ? `${selectedReport.unit_net_area} m²` : '-'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Report Info */}
                    <div>
                      <h3 className="text-eyebrow text-ink-400 mb-3">{t('reports.reportInfo', 'Report Information')}</h3>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-ink-300" />
                          <div>
                            <p className="text-body-s text-ink-600">{formatDate(selectedReport.appraisal_date)}</p>
                            <p className="text-caption text-ink-400">{t('reports.appraisalDate', 'Appraisal Date')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-ink-300" />
                          <div>
                            <p className="text-body-s text-ink-600">{selectedReport.client_name || '-'}</p>
                            <p className="text-caption text-ink-400">{t('reports.client', 'Client')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-ink-300" />
                          <div>
                            <p className="text-body-s text-ink-600">{selectedReport.owner_name || '-'}</p>
                            <p className="text-caption text-ink-400">{t('reports.owner', 'Property Owner')}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Source Badge */}
                  {selectedReport.source && (
                    <div className="mt-6 pt-4 border-t border-ink-100">
                      <span className="text-caption text-ink-400">
                        {t('reports.source', 'Source')}:{' '}
                        <span className="text-ink-500">
                          {selectedReport.source === 'backlog_import'
                            ? t('reports.sourceBacklog', 'Imported from backlog')
                            : t('reports.sourceManual', 'Created manually')}
                        </span>
                      </span>
                    </div>
                  )}
                </Card>
              ) : (
                <Card className="p-12 text-center">
                  <FileText className="h-12 w-12 text-ink-200 mx-auto mb-4" />
                  <p className="text-body text-ink-400">
                    {t('reports.selectReport', 'Select a report from the list to view details')}
                  </p>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReportsPage;
