/**
 * Bank Report Viewer
 *
 * View full anonymized appraisal report content.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  FileText,
  MapPin,
  Home,
  User,
  Calendar,
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertCircle,
  Building,
  BedDouble,
  Bath,
  Maximize,
  Award,
  TrendingUp,
  DollarSign,
  CheckCircle,
  Lock,
} from 'lucide-react';

interface ReportData {
  listing: {
    id: string;
    property_type: string;
    approximate_area: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    report_kind: string;
    listing_price_piasters: number;
    listed_at: string;
    valuation_amount_piasters: number | null;
    governorates: { id: string; name_en: string; name_ar: string } | null;
    cities: { id: string; name_en: string; name_ar: string } | null;
    districts: { id: string; name_en: string; name_ar: string } | null;
    appraiser: {
      id: string;
      full_name: string;
      fra_license_number: string | null;
      professional_title_en: string | null;
      professional_title_ar: string | null;
      years_experience: number | null;
    } | null;
    job: {
      report_kind: string;
      property_type: string;
      approximate_area: number | null;
      floor: string | null;
      bedrooms: number | null;
      bathrooms: number | null;
      created_at: string;
      completed_at: string | null;
      delivered_report_json: Record<string, unknown> | null;
    } | null;
  };
  content: Record<string, unknown> | null;
}

const PROPERTY_TYPES: Record<string, { en: string; ar: string }> = {
  apartment: { en: 'Apartment', ar: 'شقة' },
  villa: { en: 'Villa', ar: 'فيلا' },
  duplex: { en: 'Duplex', ar: 'دوبلكس' },
  commercial_shop: { en: 'Commercial', ar: 'تجاري' },
  office: { en: 'Office', ar: 'مكتب' },
  building: { en: 'Building', ar: 'مبنى' },
};

const REPORT_KINDS: Record<string, { en: string; ar: string }> = {
  brief: { en: 'Brief Report', ar: 'تقرير موجز' },
  detailed: { en: 'Detailed Report', ar: 'تقرير تفصيلي' },
  full: { en: 'Full Report', ar: 'تقرير كامل' },
};

export default function ReportViewer() {
  const { listingId } = useParams<{ listingId: string }>();
  const { i18n } = useTranslation();
  const { session } = useAuth();
  const navigate = useNavigate();
  const isRTL = i18n.language === 'ar';

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadReport = async () => {
      if (!session?.access_token || !listingId) return;

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/bank/reports/${listingId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setReport(data.report);
        } else if (res.status === 403) {
          setError(isRTL ? 'لم يتم شراء هذا التقرير' : 'This report has not been purchased');
        } else {
          setError(isRTL ? 'فشل في تحميل التقرير' : 'Failed to load report');
        }
      } catch (err) {
        console.error('Error loading report:', err);
        setError(isRTL ? 'فشل في تحميل التقرير' : 'Failed to load report');
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [session?.access_token, listingId, isRTL]);

  const formatCurrency = (piasters: number) => {
    return new Intl.NumberFormat(isRTL ? 'ar-EG' : 'en-EG', {
      style: 'currency',
      currency: 'EGP',
      maximumFractionDigits: 0,
    }).format(piasters / 100);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(isRTL ? 'ar-EG' : 'en-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-100 pt-16 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-cream-100 pt-16">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
            {error?.includes('purchased') ? (
              <Lock className="w-12 h-12 text-red-500 mx-auto mb-4" />
            ) : (
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            )}
            <h2 className="text-xl font-semibold text-red-800 mb-2">
              {error || (isRTL ? 'التقرير غير موجود' : 'Report not found')}
            </h2>
            <button
              onClick={() => navigate('/bank/reports')}
              className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              {isRTL ? 'العودة للتقارير' : 'Back to Reports'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { listing, content } = report;

  return (
    <div className={`min-h-screen bg-cream-100 pt-16 ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Header */}
      <header className="bg-white border-b border-cream-200 px-6 py-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/bank/reports')}
            className="flex items-center gap-2 text-ink-500 hover:text-ink-700 mb-4"
          >
            {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            {isRTL ? 'العودة للتقارير' : 'Back to Reports'}
          </button>

          <div className="flex items-start justify-between">
            <div>
              <div className="flex gap-2 mb-2">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                  {isRTL
                    ? PROPERTY_TYPES[listing.property_type]?.ar
                    : PROPERTY_TYPES[listing.property_type]?.en || listing.property_type}
                </span>
                <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full">
                  {isRTL
                    ? REPORT_KINDS[listing.report_kind]?.ar
                    : REPORT_KINDS[listing.report_kind]?.en || listing.report_kind}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-ink-900">
                {isRTL ? 'تقرير التقييم' : 'Appraisal Report'}
              </h1>
              <div className="flex items-center gap-2 text-ink-500 mt-1">
                <MapPin className="w-4 h-4" />
                <span>
                  {listing.governorates && (isRTL ? listing.governorates.name_ar : listing.governorates.name_en)}
                  {listing.cities && `, ${isRTL ? listing.cities.name_ar : listing.cities.name_en}`}
                  {listing.districts && `, ${isRTL ? listing.districts.name_ar : listing.districts.name_en}`}
                </span>
              </div>
            </div>

            {/* Valuation Badge */}
            {listing.valuation_amount_piasters && (
              <div className="text-right">
                <p className="text-sm text-ink-500">{isRTL ? 'التقييم' : 'Valuation'}</p>
                <p className="text-3xl font-bold text-emerald-600">
                  {formatCurrency(listing.valuation_amount_piasters)}
                </p>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-6">
          {/* Property Details Card */}
          <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-6">
            <h2 className="text-lg font-semibold text-ink-900 mb-4 flex items-center gap-2">
              <Home className="w-5 h-5 text-emerald-600" />
              {isRTL ? 'تفاصيل العقار' : 'Property Details'}
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {listing.approximate_area && (
                <div className="p-4 bg-cream-50 rounded-lg text-center">
                  <Maximize className="w-5 h-5 text-ink-400 mx-auto mb-2" />
                  <p className="text-sm text-ink-500">{isRTL ? 'المساحة' : 'Area'}</p>
                  <p className="text-lg font-semibold text-ink-900">{listing.approximate_area} m²</p>
                </div>
              )}
              {listing.bedrooms && (
                <div className="p-4 bg-cream-50 rounded-lg text-center">
                  <BedDouble className="w-5 h-5 text-ink-400 mx-auto mb-2" />
                  <p className="text-sm text-ink-500">{isRTL ? 'غرف النوم' : 'Bedrooms'}</p>
                  <p className="text-lg font-semibold text-ink-900">{listing.bedrooms}</p>
                </div>
              )}
              {listing.bathrooms && (
                <div className="p-4 bg-cream-50 rounded-lg text-center">
                  <Bath className="w-5 h-5 text-ink-400 mx-auto mb-2" />
                  <p className="text-sm text-ink-500">{isRTL ? 'الحمامات' : 'Bathrooms'}</p>
                  <p className="text-lg font-semibold text-ink-900">{listing.bathrooms}</p>
                </div>
              )}
              {listing.job?.floor && (
                <div className="p-4 bg-cream-50 rounded-lg text-center">
                  <Building className="w-5 h-5 text-ink-400 mx-auto mb-2" />
                  <p className="text-sm text-ink-500">{isRTL ? 'الطابق' : 'Floor'}</p>
                  <p className="text-lg font-semibold text-ink-900">{listing.job.floor}</p>
                </div>
              )}
            </div>
          </div>

          {/* Appraiser Info Card */}
          {listing.appraiser && (
            <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-6">
              <h2 className="text-lg font-semibold text-ink-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-600" />
                {isRTL ? 'معلومات المقيّم' : 'Appraiser Information'}
              </h2>

              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                  <User className="w-8 h-8 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-ink-900">
                    {listing.appraiser.full_name}
                  </h3>
                  {listing.appraiser.professional_title_en && (
                    <p className="text-ink-600">
                      {isRTL ? listing.appraiser.professional_title_ar : listing.appraiser.professional_title_en}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-4 mt-2 text-sm text-ink-500">
                    {listing.appraiser.fra_license_number && (
                      <span className="flex items-center gap-1">
                        <Award className="w-4 h-4" />
                        FRA: {listing.appraiser.fra_license_number}
                      </span>
                    )}
                    {listing.appraiser.years_experience && (
                      <span>{listing.appraiser.years_experience} {isRTL ? 'سنة خبرة' : 'years experience'}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Report Timeline */}
          <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-6">
            <h2 className="text-lg font-semibold text-ink-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600" />
              {isRTL ? 'الجدول الزمني' : 'Timeline'}
            </h2>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-ink-500">{isRTL ? 'تاريخ الطلب' : 'Request Date'}</p>
                  <p className="font-medium text-ink-900">
                    {listing.job?.created_at ? formatDate(listing.job.created_at) : '-'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-ink-500">{isRTL ? 'تاريخ الإكمال' : 'Completion Date'}</p>
                  <p className="font-medium text-ink-900">
                    {listing.job?.completed_at ? formatDate(listing.job.completed_at) : '-'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-ink-500">{isRTL ? 'تاريخ الإدراج' : 'Listed Date'}</p>
                  <p className="font-medium text-ink-900">{formatDate(listing.listed_at)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Report Content */}
          {content && Object.keys(content).length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-6">
              <h2 className="text-lg font-semibold text-ink-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                {isRTL ? 'محتوى التقرير' : 'Report Content'}
              </h2>

              <div className="prose prose-sm max-w-none">
                {/* Render report content - this would depend on the actual structure */}
                {Object.entries(content).map(([key, value]) => {
                  // Skip sensitive fields
                  if (['clientName', 'clientContact', 'exactAddress', 'photos', 'images'].includes(key)) {
                    return null;
                  }

                  return (
                    <div key={key} className="mb-4 p-4 bg-cream-50 rounded-lg">
                      <h3 className="text-sm font-medium text-ink-500 mb-2 capitalize">
                        {key.replace(/_/g, ' ')}
                      </h3>
                      <div className="text-ink-900">
                        {typeof value === 'object' ? (
                          <pre className="text-sm whitespace-pre-wrap">
                            {JSON.stringify(value, null, 2)}
                          </pre>
                        ) : (
                          <p>{String(value)}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Privacy Notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-yellow-800 mb-1">
                  {isRTL ? 'ملاحظة الخصوصية' : 'Privacy Notice'}
                </h3>
                <p className="text-sm text-yellow-700">
                  {isRTL
                    ? 'تم إخفاء المعلومات الشخصية للعميل (الاسم، العنوان الدقيق، الصور) لحماية الخصوصية.'
                    : 'Client personal information (name, exact address, photos) has been hidden to protect privacy.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
