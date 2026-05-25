/**
 * Bank Purchased Reports
 *
 * View all purchased appraisal reports.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  FileText,
  MapPin,
  Home,
  User,
  Calendar,
  Eye,
  Loader2,
  CheckCircle,
  Download,
  Search,
} from 'lucide-react';

interface PurchasedReport {
  id: string;
  price_piasters: number;
  created_at: string;
  purchase: {
    id: string;
    paid_at: string;
  } | null;
  listing: {
    id: string;
    property_type: string;
    approximate_area: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    report_kind: string;
    listed_at: string;
    valuation_amount_piasters: number | null;
    governorates: { name_en: string; name_ar: string } | null;
    cities: { name_en: string; name_ar: string } | null;
    districts: { name_en: string; name_ar: string } | null;
    appraiser: { full_name: string; fra_license_number: string | null } | null;
  };
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
  brief: { en: 'Brief', ar: 'موجز' },
  detailed: { en: 'Detailed', ar: 'تفصيلي' },
  full: { en: 'Full', ar: 'كامل' },
};

export default function PurchasedReports() {
  const { i18n } = useTranslation();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isRTL = i18n.language === 'ar';

  const [reports, setReports] = useState<PurchasedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Check for successful purchase
  const purchaseId = searchParams.get('purchase');
  const status = searchParams.get('status');

  useEffect(() => {
    const loadReports = async () => {
      if (!session?.access_token) return;

      setLoading(true);
      try {
        const res = await fetch('/api/bank/reports', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setReports(data.reports || []);
        }
      } catch (err) {
        console.error('Error loading reports:', err);
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, [session?.access_token]);

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
      month: 'short',
      day: 'numeric',
    });
  };

  // Filter reports by search term
  const filteredReports = reports.filter((report) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      report.listing.property_type.toLowerCase().includes(search) ||
      report.listing.governorates?.name_en.toLowerCase().includes(search) ||
      report.listing.governorates?.name_ar.includes(search) ||
      report.listing.cities?.name_en.toLowerCase().includes(search) ||
      report.listing.cities?.name_ar.includes(search) ||
      report.listing.appraiser?.full_name.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-100 pt-16 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-cream-100 pt-16 ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Header */}
      <header className="bg-white border-b border-cream-200 px-6 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-emerald-600" />
              <div>
                <h1 className="text-2xl font-bold text-ink-900">
                  {isRTL ? 'التقارير المشتراة' : 'Purchased Reports'}
                </h1>
                <p className="text-ink-500">
                  {reports.length} {isRTL ? 'تقرير' : reports.length === 1 ? 'report' : 'reports'}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/bank/marketplace')}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              {isRTL ? 'شراء المزيد' : 'Buy More'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Success Message */}
        {status === 'success' && purchaseId && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <span className="text-emerald-700">
              {isRTL
                ? 'تم الشراء بنجاح! يمكنك الآن عرض التقارير.'
                : 'Purchase successful! You can now view your reports.'}
            </span>
          </div>
        )}

        {/* Search */}
        {reports.length > 0 && (
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ink-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={isRTL ? 'بحث في التقارير...' : 'Search reports...'}
                className="w-full pl-10 pr-4 py-2 border border-cream-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        )}

        {filteredReports.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <FileText className="w-16 h-16 text-ink-200 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-ink-900 mb-2">
              {searchTerm
                ? isRTL ? 'لا توجد نتائج' : 'No results found'
                : isRTL ? 'لا توجد تقارير' : 'No reports yet'}
            </h2>
            <p className="text-ink-500 mb-6">
              {searchTerm
                ? isRTL ? 'جرب تغيير كلمات البحث' : 'Try different search terms'
                : isRTL ? 'قم بشراء تقارير من السوق' : 'Purchase reports from the marketplace'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => navigate('/bank/marketplace')}
                className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                {isRTL ? 'تصفح السوق' : 'Browse Marketplace'}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredReports.map((report) => (
              <div
                key={report.id}
                className="bg-white rounded-xl shadow-sm border border-cream-200 overflow-hidden hover:shadow-md transition cursor-pointer"
                onClick={() => navigate(`/bank/reports/${report.listing.id}`)}
              >
                <div className="p-5">
                  {/* Property Type & Report Kind */}
                  <div className="flex gap-2 mb-3">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                      {isRTL
                        ? PROPERTY_TYPES[report.listing.property_type]?.ar
                        : PROPERTY_TYPES[report.listing.property_type]?.en || report.listing.property_type}
                    </span>
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                      {isRTL
                        ? REPORT_KINDS[report.listing.report_kind]?.ar
                        : REPORT_KINDS[report.listing.report_kind]?.en || report.listing.report_kind}
                    </span>
                  </div>

                  {/* Location */}
                  <div className="flex items-center gap-2 text-ink-600 mb-2">
                    <MapPin className="w-4 h-4 text-ink-400" />
                    <span className="text-sm">
                      {report.listing.governorates &&
                        (isRTL ? report.listing.governorates.name_ar : report.listing.governorates.name_en)}
                      {report.listing.cities &&
                        `, ${isRTL ? report.listing.cities.name_ar : report.listing.cities.name_en}`}
                    </span>
                  </div>

                  {/* Property Details */}
                  <div className="flex flex-wrap gap-3 text-sm text-ink-500 mb-2">
                    {report.listing.approximate_area && (
                      <span className="flex items-center gap-1">
                        <Home className="w-4 h-4" />
                        {report.listing.approximate_area} m²
                      </span>
                    )}
                    {report.listing.bedrooms && (
                      <span>{report.listing.bedrooms} {isRTL ? 'غرف' : 'BR'}</span>
                    )}
                  </div>

                  {/* Appraiser */}
                  {report.listing.appraiser && (
                    <div className="flex items-center gap-2 text-sm text-ink-500 mb-3">
                      <User className="w-4 h-4" />
                      <span>{report.listing.appraiser.full_name}</span>
                    </div>
                  )}

                  {/* Valuation (if available) */}
                  {report.listing.valuation_amount_piasters && (
                    <div className="p-3 bg-emerald-50 rounded-lg mb-3">
                      <p className="text-xs text-emerald-600 mb-1">
                        {isRTL ? 'التقييم' : 'Valuation'}
                      </p>
                      <p className="text-lg font-bold text-emerald-700">
                        {formatCurrency(report.listing.valuation_amount_piasters)}
                      </p>
                    </div>
                  )}

                  {/* Purchase Date */}
                  <div className="flex items-center gap-2 text-sm text-ink-400">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {isRTL ? 'تاريخ الشراء:' : 'Purchased:'}{' '}
                      {report.purchase?.paid_at ? formatDate(report.purchase.paid_at) : '-'}
                    </span>
                  </div>
                </div>

                {/* View Button */}
                <div className="px-5 py-3 bg-cream-50 border-t border-cream-100">
                  <button className="w-full flex items-center justify-center gap-2 text-emerald-600 hover:text-emerald-700">
                    <Eye className="w-4 h-4" />
                    {isRTL ? 'عرض التقرير' : 'View Report'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
