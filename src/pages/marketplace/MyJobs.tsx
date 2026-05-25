/**
 * My Jobs Page
 *
 * Client view of their appraisal requests with status tracking.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface Job {
  id: string;
  status: string;
  property_type: string;
  address_description: string;
  report_kind: string;
  urgency: string;
  total_price: number;
  due_date: string;
  created_at: string;
  delivered_at: string | null;
  completed_at: string | null;
  governorates: { name_en: string; name_ar: string } | null;
  cities: { name_en: string; name_ar: string } | null;
  appraiser: { full_name: string } | null;
  delivered_report: { id: string; final_value: number } | null;
}

const STATUS_LABELS: Record<string, { en: string; ar: string; color: string }> = {
  draft: { en: 'Draft', ar: 'مسودة', color: 'bg-gray-100 text-gray-700' },
  pending_acceptance: { en: 'Pending Acceptance', ar: 'في انتظار القبول', color: 'bg-amber-100 text-amber-700' },
  accepted: { en: 'Accepted', ar: 'مقبول', color: 'bg-blue-100 text-blue-700' },
  declined: { en: 'Declined', ar: 'مرفوض', color: 'bg-red-100 text-red-700' },
  pending_payment: { en: 'Pending Payment', ar: 'في انتظار الدفع', color: 'bg-yellow-100 text-yellow-700' },
  paid: { en: 'Paid', ar: 'تم الدفع', color: 'bg-blue-100 text-blue-700' },
  assigned: { en: 'Assigned', ar: 'تم التعيين', color: 'bg-purple-100 text-purple-700' },
  in_progress: { en: 'In Progress', ar: 'قيد التنفيذ', color: 'bg-indigo-100 text-indigo-700' },
  delivered: { en: 'Delivered', ar: 'تم التسليم', color: 'bg-emerald-100 text-emerald-700' },
  completed: { en: 'Completed', ar: 'مكتمل', color: 'bg-green-100 text-green-700' },
  disputed: { en: 'Disputed', ar: 'متنازع عليه', color: 'bg-red-100 text-red-700' },
  cancelled: { en: 'Cancelled', ar: 'ملغي', color: 'bg-gray-100 text-gray-500' },
  refunded: { en: 'Refunded', ar: 'تم الاسترداد', color: 'bg-gray-100 text-gray-500' },
};

const PROPERTY_TYPE_LABELS: Record<string, { en: string; ar: string }> = {
  apartment: { en: 'Apartment', ar: 'شقة' },
  villa: { en: 'Villa', ar: 'فيلا' },
  duplex: { en: 'Duplex', ar: 'دوبلكس' },
  commercial_shop: { en: 'Commercial', ar: 'تجاري' },
  office: { en: 'Office', ar: 'مكتب' },
  building: { en: 'Building', ar: 'مبنى' },
  compound_unit: { en: 'Compound Unit', ar: 'وحدة كمبوند' },
  roof: { en: 'Roof', ar: 'روف' },
};

export default function MyJobs() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    async function fetchJobs() {
      try {
        const token = localStorage.getItem('supabase_access_token');
        const params = new URLSearchParams();
        if (filter !== 'all') params.append('status', filter);

        const res = await fetch(`/api/jobs?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setJobs(data.jobs || []);
      } catch (err) {
        console.error('Failed to fetch jobs:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchJobs();
  }, [filter]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(isRTL ? 'ar-EG' : 'en-EG', {
      style: 'currency',
      currency: 'EGP',
      maximumFractionDigits: 0,
    }).format(value / 100);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(isRTL ? 'ar-EG' : 'en-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Count jobs by status
  const statusCounts = jobs.reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className={`min-h-screen bg-cream-50 pt-16 ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Header */}
      <header className="bg-white border-b border-cream-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink-900">
              {isRTL ? 'طلباتي' : 'My Requests'}
            </h1>
            <p className="text-sm text-ink-500 mt-1">
              {isRTL
                ? `${jobs.length} طلب تقييم`
                : `${jobs.length} appraisal request${jobs.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <Link
            to="/marketplace/request"
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
          >
            {isRTL ? '+ طلب جديد' : '+ New Request'}
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Status Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === 'all'
                ? 'bg-ink-900 text-white'
                : 'bg-white text-ink-700 hover:bg-cream-100'
            }`}
          >
            {isRTL ? 'الكل' : 'All'} ({jobs.length})
          </button>
          {['pending_payment', 'paid', 'in_progress', 'delivered', 'completed'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === status
                  ? 'bg-ink-900 text-white'
                  : 'bg-white text-ink-700 hover:bg-cream-100'
              }`}
            >
              {isRTL ? STATUS_LABELS[status].ar : STATUS_LABELS[status].en}
              {statusCounts[status] ? ` (${statusCounts[status]})` : ''}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-4xl mb-4">📋</div>
            <h3 className="text-lg font-semibold text-ink-900 mb-2">
              {isRTL ? 'لا توجد طلبات' : 'No Requests Yet'}
            </h3>
            <p className="text-ink-500 mb-6">
              {isRTL
                ? 'ابدأ بطلب تقييم عقاري لممتلكاتك'
                : 'Start by requesting an appraisal for your property'}
            </p>
            <Link
              to="/marketplace/request"
              className="inline-block px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
            >
              {isRTL ? 'طلب تقييم جديد' : 'Request New Appraisal'}
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Status Badge */}
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${STATUS_LABELS[job.status]?.color}`}
                    >
                      {isRTL ? STATUS_LABELS[job.status]?.ar : STATUS_LABELS[job.status]?.en}
                    </span>

                    {/* Property Info */}
                    <h3 className="text-lg font-semibold text-ink-900 mt-2">
                      {isRTL
                        ? PROPERTY_TYPE_LABELS[job.property_type]?.ar
                        : PROPERTY_TYPE_LABELS[job.property_type]?.en}{' '}
                      -{' '}
                      {job.governorates
                        ? isRTL
                          ? job.governorates.name_ar
                          : job.governorates.name
                        : ''}
                    </h3>
                    <p className="text-sm text-ink-500 mt-1 line-clamp-1">
                      {job.address_description}
                    </p>

                    {/* Details */}
                    <div className="flex flex-wrap gap-4 mt-3 text-sm text-ink-600">
                      <span>
                        {isRTL ? 'تاريخ الطلب:' : 'Requested:'} {formatDate(job.created_at)}
                      </span>
                      <span>
                        {isRTL ? 'موعد التسليم:' : 'Due:'} {formatDate(job.due_date)}
                      </span>
                      {job.appraiser && (
                        <span>
                          {isRTL ? 'المقيم:' : 'Appraiser:'} {job.appraiser.full_name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Price & Actions */}
                  <div className="text-right ml-4">
                    <p className="text-2xl font-bold text-ink-900">
                      {formatCurrency(job.total_price)}
                    </p>

                    <div className="mt-3 space-x-2 rtl:space-x-reverse">
                      {job.status === 'draft' && (
                        <Link
                          to={`/marketplace/jobs/${job.id}/payment`}
                          className="inline-block px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700"
                        >
                          {isRTL ? 'إتمام الدفع' : 'Complete Payment'}
                        </Link>
                      )}
                      {job.status === 'delivered' && (
                        <>
                          <Link
                            to={`/reports/${job.delivered_report?.id}`}
                            className="inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                          >
                            {isRTL ? 'عرض التقرير' : 'View Report'}
                          </Link>
                          <button className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700">
                            {isRTL ? 'قبول' : 'Accept'}
                          </button>
                        </>
                      )}
                      {job.status === 'completed' && job.delivered_report && (
                        <Link
                          to={`/reports/${job.delivered_report.id}`}
                          className="inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                        >
                          {isRTL ? 'عرض التقرير' : 'View Report'}
                        </Link>
                      )}
                      <Link
                        to={`/marketplace/jobs/${job.id}`}
                        className="inline-block px-4 py-2 border border-cream-300 text-ink-700 text-sm rounded-lg hover:bg-cream-50"
                      >
                        {isRTL ? 'التفاصيل' : 'Details'}
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Final Value (for completed jobs) */}
                {job.delivered_report?.final_value && (
                  <div className="mt-4 pt-4 border-t border-cream-100">
                    <span className="text-sm text-ink-500">
                      {isRTL ? 'القيمة النهائية:' : 'Final Value:'}
                    </span>
                    <span className="ml-2 text-lg font-bold text-emerald-600">
                      {new Intl.NumberFormat(isRTL ? 'ar-EG' : 'en-EG', {
                        style: 'currency',
                        currency: 'EGP',
                        maximumFractionDigits: 0,
                      }).format(job.delivered_report.final_value)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
