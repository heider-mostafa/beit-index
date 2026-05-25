/**
 * Appraiser Jobs Dashboard - Direct Booking Model
 *
 * Shows incoming requests to accept/decline and active jobs.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  Briefcase,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  Play,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  User,
  Mail,
  DollarSign,
  Settings,
} from 'lucide-react';

interface Job {
  id: string;
  property_type: string;
  report_kind: string;
  urgency: string;
  status: string;
  address_description: string;
  approximate_area: number | null;
  floor: string | null;
  bedrooms: number | null;
  total_price: number;
  platform_fee: number;
  appraiser_earnings: number;
  due_date: string;
  special_instructions: string | null;
  created_at: string;
  accepted_at?: string;
  started_at?: string;
  governorate_id: string;
  governorates: { id: string; name_en: string; name_ar: string } | null;
  city_id: string;
  cities: { id: string; name_en: string; name_ar: string } | null;
  district_id: string | null;
  districts: { id: string; name_en: string; name_ar: string } | null;
  client?: { id: string; full_name: string; email: string } | null;
}

interface Stats {
  pending_acceptance: number;
  accepted: number;
  in_progress: number;
  delivered: number;
  completed: number;
  total_completed: number;
  total_earnings: number;
}

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

const URGENCY_LABELS: Record<string, { en: string; ar: string; color: string }> = {
  standard: { en: '7 Days', ar: '7 أيام', color: 'bg-gray-100 text-gray-700' },
  priority: { en: '3 Days', ar: '3 أيام', color: 'bg-yellow-100 text-yellow-700' },
  express: { en: '24 Hours', ar: '24 ساعة', color: 'bg-red-100 text-red-700' },
};

const STATUS_LABELS: Record<string, { en: string; ar: string; color: string }> = {
  pending_acceptance: { en: 'Pending', ar: 'في انتظار القبول', color: 'bg-orange-100 text-orange-700' },
  accepted: { en: 'Awaiting Payment', ar: 'في انتظار الدفع', color: 'bg-yellow-100 text-yellow-700' },
  paid: { en: 'Paid - Ready', ar: 'مدفوع - جاهز', color: 'bg-blue-100 text-blue-700' },
  in_progress: { en: 'In Progress', ar: 'قيد التنفيذ', color: 'bg-purple-100 text-purple-700' },
  delivered: { en: 'Delivered', ar: 'تم التسليم', color: 'bg-emerald-100 text-emerald-700' },
  completed: { en: 'Completed', ar: 'مكتمل', color: 'bg-green-100 text-green-700' },
};

export default function AppraiserJobsDashboard() {
  const { i18n } = useTranslation();
  const { session } = useAuth();
  const isRTL = i18n.language === 'ar';

  const [activeTab, setActiveTab] = useState<'requests' | 'active' | 'history'>('requests');
  const [incomingRequests, setIncomingRequests] = useState<Job[]>([]);
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!session?.access_token) return;

    setLoading(true);
    setError(null);

    try {
      const headers = { Authorization: `Bearer ${session.access_token}` };

      const [requestsRes, jobsRes, statsRes] = await Promise.all([
        fetch('/api/appraiser/requests', { headers }),
        fetch('/api/appraiser/my-jobs', { headers }),
        fetch('/api/appraiser/stats', { headers }),
      ]);

      if (!requestsRes.ok || !jobsRes.ok || !statsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const [requestsData, jobsData, statsData] = await Promise.all([
        requestsRes.json(),
        jobsRes.json(),
        statsRes.json(),
      ]);

      setIncomingRequests(requestsData.requests || []);
      setActiveJobs(jobsData.jobs || []);
      setStats(statsData.stats || null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(isRTL ? 'فشل في تحميل البيانات' : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, isRTL]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAccept = async (jobId: string) => {
    if (!session?.access_token) return;

    setActionLoading(jobId);
    try {
      const res = await fetch(`/api/appraiser/jobs/${jobId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to accept job');
      }

      await fetchData();
      setActiveTab('active');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to accept job';
      alert(message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (jobId: string) => {
    if (!session?.access_token) return;

    const reason = prompt(isRTL ? 'سبب الرفض (اختياري):' : 'Reason for declining (optional):');

    setActionLoading(jobId);
    try {
      const res = await fetch(`/api/appraiser/jobs/${jobId}/decline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to decline job');
      }

      await fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to decline job';
      alert(message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStart = async (jobId: string) => {
    if (!session?.access_token) return;

    setActionLoading(jobId);
    try {
      const res = await fetch(`/api/appraiser/jobs/${jobId}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start job');
      }

      await fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start job';
      alert(message);
    } finally {
      setActionLoading(null);
    }
  };

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

  const getDaysUntilDue = (dueDate: string) => {
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const renderJobCard = (job: Job, type: 'request' | 'active') => {
    const daysUntilDue = getDaysUntilDue(job.due_date);
    const isOverdue = daysUntilDue < 0;
    const isUrgent = daysUntilDue <= 1;

    return (
      <div
        key={job.id}
        className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition border border-cream-200"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-3">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${URGENCY_LABELS[job.urgency]?.color}`}>
                {isRTL ? URGENCY_LABELS[job.urgency]?.ar : URGENCY_LABELS[job.urgency]?.en}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_LABELS[job.status]?.color}`}>
                {isRTL ? STATUS_LABELS[job.status]?.ar : STATUS_LABELS[job.status]?.en}
              </span>
              {isOverdue && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                  {isRTL ? 'متأخر' : 'Overdue'}
                </span>
              )}
            </div>

            {/* Property Info */}
            <h3 className="text-lg font-semibold text-ink-900">
              {isRTL
                ? PROPERTY_TYPE_LABELS[job.property_type]?.ar
                : PROPERTY_TYPE_LABELS[job.property_type]?.en}
              {' - '}
              {job.report_kind === 'brief'
                ? isRTL ? 'تقرير موجز' : 'Brief Report'
                : job.report_kind === 'detailed'
                ? isRTL ? 'تقرير تفصيلي' : 'Detailed Report'
                : isRTL ? 'تقرير كامل' : 'Full Report'}
            </h3>

            <div className="flex items-center gap-1 text-ink-500 mt-1">
              <MapPin className="w-4 h-4" />
              <span className="text-sm">
                {job.governorates
                  ? isRTL
                    ? job.governorates.name_ar
                    : job.governorates.name_en
                  : ''}
                {job.cities && (
                  <>
                    {' - '}
                    {isRTL ? job.cities.name_ar : job.cities.name_en}
                  </>
                )}
              </span>
            </div>

            <p className="text-sm text-ink-500 mt-1 line-clamp-1">
              {job.address_description}
            </p>

            {/* Details */}
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-ink-600">
              {job.approximate_area && (
                <span>{job.approximate_area} m²</span>
              )}
              {job.bedrooms && (
                <span>{job.bedrooms} {isRTL ? 'غرف' : 'BR'}</span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {isRTL ? 'التسليم:' : 'Due:'} {formatDate(job.due_date)}
                {isUrgent && !isOverdue && (
                  <span className="text-orange-600 font-medium">
                    ({daysUntilDue} {isRTL ? 'يوم' : 'day'}{daysUntilDue !== 1 ? 's' : ''})
                  </span>
                )}
              </span>
            </div>

            {/* Client Info */}
            {job.client && (
              <div className="mt-4 p-3 bg-cream-50 rounded-lg">
                <p className="text-sm font-medium text-ink-700 mb-2">
                  {isRTL ? 'معلومات العميل' : 'Client Information'}
                </p>
                <div className="flex flex-wrap gap-4 text-sm text-ink-600">
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {job.client.full_name}
                  </span>
                  <span className="flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    {job.client.email}
                  </span>
                </div>
              </div>
            )}

            {/* Special Instructions */}
            {job.special_instructions && (
              <div className="mt-3 p-3 bg-yellow-50 rounded-lg text-sm">
                <span className="font-medium">{isRTL ? 'تعليمات خاصة:' : 'Special Instructions:'}</span>{' '}
                {job.special_instructions}
              </div>
            )}
          </div>

          {/* Earnings & Actions */}
          <div className="text-right ml-6 flex-shrink-0">
            <div className="mb-4">
              <p className="text-sm text-ink-500">{isRTL ? 'أرباحك' : 'Your Earnings'}</p>
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(job.appraiser_earnings)}
              </p>
              <p className="text-xs text-ink-400">
                {isRTL ? 'من إجمالي' : 'of'} {formatCurrency(job.total_price)}
              </p>
            </div>

            <div className="space-y-2">
              {type === 'request' && (
                <>
                  <button
                    onClick={() => handleAccept(job.id)}
                    disabled={actionLoading === job.id}
                    className="w-full px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {actionLoading === job.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    {isRTL ? 'قبول' : 'Accept'}
                  </button>
                  <button
                    onClick={() => handleDecline(job.id)}
                    disabled={actionLoading === job.id}
                    className="w-full px-4 py-2 border border-red-300 text-red-600 text-sm rounded-lg hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    {isRTL ? 'رفض' : 'Decline'}
                  </button>
                </>
              )}

              {type === 'active' && job.status === 'accepted' && (
                <div className="text-center text-sm text-yellow-600 bg-yellow-50 p-2 rounded-lg">
                  {isRTL ? 'في انتظار دفع العميل' : 'Awaiting client payment'}
                </div>
              )}

              {type === 'active' && job.status === 'paid' && (
                <button
                  onClick={() => handleStart(job.id)}
                  disabled={actionLoading === job.id}
                  className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading === job.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {isRTL ? 'بدء العمل' : 'Start Work'}
                </button>
              )}

              {type === 'active' && job.status === 'in_progress' && (
                <button
                  onClick={() => window.location.href = `/appraiser/jobs/${job.id}/deliver`}
                  className="w-full px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2"
                >
                  <ChevronRight className="w-4 h-4" />
                  {isRTL ? 'تسليم التقرير' : 'Deliver Report'}
                </button>
              )}

              {type === 'active' && job.status === 'delivered' && (
                <div className="text-center text-sm text-emerald-600 bg-emerald-50 p-2 rounded-lg">
                  {isRTL ? 'في انتظار قبول العميل' : 'Awaiting client acceptance'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-100 pt-16 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-cream-100 pt-16 ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Header */}
      <header className="bg-cream-100 border-b border-ink-100 px-5 md:px-8 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-h3 text-ink-600">
                {isRTL ? 'لوحة الطلبات' : 'Jobs Dashboard'}
              </h1>
              <p className="text-body-s text-ink-300 mt-1">
                {isRTL
                  ? 'إدارة طلبات التقييم الواردة'
                  : 'Manage your incoming appraisal requests'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/appraiser/pricing"
                className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-emerald-500 bg-emerald-50 rounded-sm hover:bg-emerald-100 transition"
              >
                <DollarSign className="w-4 h-4" />
                {isRTL ? 'إعدادات الأسعار' : 'Pricing Settings'}
              </Link>
              <button
                onClick={fetchData}
                className="p-2 text-ink-400 hover:text-ink-600 hover:bg-cream-200 rounded-sm transition"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-8">
              <div className="bg-amber-50 border border-amber-100 rounded-sm p-4">
                <p className="text-body-s text-amber-600">{isRTL ? 'طلبات جديدة' : 'New Requests'}</p>
                <p className="text-h4 text-amber-700 mt-1">{stats.pending_acceptance}</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-100 rounded-sm p-4">
                <p className="text-body-s text-yellow-600">{isRTL ? 'في انتظار الدفع' : 'Awaiting Payment'}</p>
                <p className="text-h4 text-yellow-700 mt-1">{stats.accepted}</p>
              </div>
              <div className="bg-purple-50 border border-purple-100 rounded-sm p-4">
                <p className="text-body-s text-purple-600">{isRTL ? 'قيد التنفيذ' : 'In Progress'}</p>
                <p className="text-h4 text-purple-700 mt-1">{stats.in_progress}</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-sm p-4">
                <p className="text-body-s text-emerald-600">{isRTL ? 'مكتمل' : 'Completed'}</p>
                <p className="text-h4 text-emerald-700 mt-1">{stats.total_completed}</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-sm p-4">
                <p className="text-body-s text-emerald-600">{isRTL ? 'إجمالي الأرباح' : 'Total Earnings'}</p>
                <p className="text-h4 text-emerald-700 mt-1">{formatCurrency(stats.total_earnings)}</p>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 md:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-body-s text-red-700">{error}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-5 py-2.5 rounded-sm text-[13px] font-medium transition flex items-center gap-2 ${
              activeTab === 'requests'
                ? 'bg-emerald-500 text-white'
                : 'bg-cream-200 text-ink-500 hover:bg-cream-300'
            }`}
          >
            <Briefcase className="w-5 h-5" />
            {isRTL ? 'طلبات جديدة' : 'New Requests'}
            {incomingRequests.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'requests' ? 'bg-white/20' : 'bg-orange-100 text-orange-700'
              }`}>
                {incomingRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`px-5 py-2.5 rounded-sm text-[13px] font-medium transition flex items-center gap-2 ${
              activeTab === 'active'
                ? 'bg-emerald-500 text-white'
                : 'bg-cream-200 text-ink-500 hover:bg-cream-300'
            }`}
          >
            <CheckCircle className="w-5 h-5" />
            {isRTL ? 'الطلبات النشطة' : 'Active Jobs'}
            {activeJobs.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'active' ? 'bg-white/20' : 'bg-blue-100 text-blue-700'
              }`}>
                {activeJobs.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        {activeTab === 'requests' && (
          <div className="space-y-4">
            {incomingRequests.length === 0 ? (
              <div className="bg-cream-200 border border-ink-100 rounded-sm p-12 text-center">
                <Briefcase className="w-12 h-12 text-ink-200 mx-auto mb-4" />
                <h3 className="text-h4 text-ink-600 mb-2">
                  {isRTL ? 'لا توجد طلبات جديدة' : 'No New Requests'}
                </h3>
                <p className="text-body-s text-ink-400">
                  {isRTL
                    ? 'ستظهر هنا طلبات العملاء الجديدة'
                    : 'New client requests will appear here'}
                </p>
              </div>
            ) : (
              incomingRequests.map((job) => renderJobCard(job, 'request'))
            )}
          </div>
        )}

        {activeTab === 'active' && (
          <div className="space-y-4">
            {activeJobs.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <CheckCircle className="w-12 h-12 text-ink-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-ink-900 mb-2">
                  {isRTL ? 'لا توجد طلبات نشطة' : 'No Active Jobs'}
                </h3>
                <p className="text-ink-500 mb-4">
                  {isRTL
                    ? 'اقبل طلبات جديدة للبدء'
                    : 'Accept new requests to get started'}
                </p>
                <button
                  onClick={() => setActiveTab('requests')}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  {isRTL ? 'عرض الطلبات الجديدة' : 'View New Requests'}
                </button>
              </div>
            ) : (
              activeJobs.map((job) => renderJobCard(job, 'active'))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
