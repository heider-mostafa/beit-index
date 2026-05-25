/**
 * Appraiser Job Detail Page
 *
 * Shows full job details and messaging interface for appraisers.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/contexts/AuthContext';
import { JobConversation } from '@/src/components/JobConversation';
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Clock,
  User,
  Mail,
  Phone,
  Loader2,
  AlertCircle,
  Play,
  FileText,
  Home,
  Building,
  Maximize,
  BedDouble,
  DoorOpen,
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
  bathrooms: number | null;
  total_price: number;
  platform_fee: number;
  appraiser_earnings: number;
  due_date: string;
  special_instructions: string | null;
  created_at: string;
  accepted_at: string | null;
  started_at: string | null;
  delivered_at: string | null;
  governorates: { id: string; name_en: string; name_ar: string } | null;
  cities: { id: string; name_en: string; name_ar: string } | null;
  districts: { id: string; name_en: string; name_ar: string } | null;
  client: { id: string; full_name: string; email: string; phone: string | null } | null;
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

const REPORT_KIND_LABELS: Record<string, { en: string; ar: string }> = {
  brief: { en: 'Brief Report', ar: 'تقرير موجز' },
  detailed: { en: 'Detailed Report', ar: 'تقرير تفصيلي' },
  full: { en: 'Full Report', ar: 'تقرير كامل' },
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

export default function AppraiserJobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { session } = useAuth();
  const isRTL = i18n.language === 'ar';

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const fetchJob = async () => {
      if (!session?.access_token || !id) return;

      try {
        const res = await fetch(`/api/appraiser/jobs/${id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (!res.ok) {
          throw new Error('Failed to fetch job');
        }

        const data = await res.json();
        setJob(data.job);
      } catch (err) {
        console.error('Error fetching job:', err);
        setError(isRTL ? 'فشل في تحميل الطلب' : 'Failed to load job');
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [id, session?.access_token, isRTL]);

  const handleStart = async () => {
    if (!session?.access_token || !id) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/appraiser/jobs/${id}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start job');
      }

      setJob((prev) => prev ? { ...prev, status: 'in_progress', started_at: new Date().toISOString() } : null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start job';
      alert(message);
    } finally {
      setActionLoading(false);
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
      month: 'long',
      day: 'numeric',
    });
  };

  const getDaysUntilDue = (dueDate: string) => {
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = due.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-100 pt-16 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-cream-100 pt-16">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-red-800 mb-2">
              {error || (isRTL ? 'الطلب غير موجود' : 'Job not found')}
            </h2>
            <button
              onClick={() => navigate('/appraiser/jobs')}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              {isRTL ? 'العودة للوحة الطلبات' : 'Back to Dashboard'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const daysUntilDue = getDaysUntilDue(job.due_date);
  const isOverdue = daysUntilDue < 0;
  const canMessage = ['paid', 'in_progress', 'delivered'].includes(job.status);

  return (
    <div className={`min-h-screen bg-cream-100 pt-16 ${isRTL ? 'rtl' : 'ltr'}`}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate('/appraiser/jobs')}
          className="flex items-center gap-2 text-ink-500 hover:text-ink-700 mb-6 transition"
        >
          {isRTL ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
          {isRTL ? 'العودة للوحة الطلبات' : 'Back to Dashboard'}
        </button>

        <div className="grid gap-6">
          {/* Job Info Card */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            {/* Status Badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${URGENCY_LABELS[job.urgency]?.color}`}>
                {isRTL ? URGENCY_LABELS[job.urgency]?.ar : URGENCY_LABELS[job.urgency]?.en}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_LABELS[job.status]?.color}`}>
                {isRTL ? STATUS_LABELS[job.status]?.ar : STATUS_LABELS[job.status]?.en}
              </span>
              {isOverdue && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
                  {isRTL ? 'متأخر' : 'Overdue'}
                </span>
              )}
            </div>

            {/* Property Type & Report Kind */}
            <h1 className="text-2xl font-bold text-ink-900 mb-2">
              {isRTL
                ? PROPERTY_TYPE_LABELS[job.property_type]?.ar
                : PROPERTY_TYPE_LABELS[job.property_type]?.en}
              {' - '}
              {isRTL
                ? REPORT_KIND_LABELS[job.report_kind]?.ar
                : REPORT_KIND_LABELS[job.report_kind]?.en}
            </h1>

            {/* Location */}
            <div className="flex items-center gap-2 text-ink-500 mb-4">
              <MapPin className="w-5 h-5" />
              <span>
                {job.governorates && (isRTL ? job.governorates.name_ar : job.governorates.name_en)}
                {job.cities && ` - ${isRTL ? job.cities.name_ar : job.cities.name_en}`}
                {job.districts && ` - ${isRTL ? job.districts.name_ar : job.districts.name_en}`}
              </span>
            </div>

            <p className="text-ink-600 mb-6">{job.address_description}</p>

            {/* Property Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {job.approximate_area && (
                <div className="bg-cream-50 rounded-lg p-3 text-center">
                  <Maximize className="w-5 h-5 text-ink-400 mx-auto mb-1" />
                  <p className="text-sm text-ink-500">{isRTL ? 'المساحة' : 'Area'}</p>
                  <p className="font-semibold text-ink-900">{job.approximate_area} m²</p>
                </div>
              )}
              {job.bedrooms && (
                <div className="bg-cream-50 rounded-lg p-3 text-center">
                  <BedDouble className="w-5 h-5 text-ink-400 mx-auto mb-1" />
                  <p className="text-sm text-ink-500">{isRTL ? 'غرف النوم' : 'Bedrooms'}</p>
                  <p className="font-semibold text-ink-900">{job.bedrooms}</p>
                </div>
              )}
              {job.bathrooms && (
                <div className="bg-cream-50 rounded-lg p-3 text-center">
                  <DoorOpen className="w-5 h-5 text-ink-400 mx-auto mb-1" />
                  <p className="text-sm text-ink-500">{isRTL ? 'الحمامات' : 'Bathrooms'}</p>
                  <p className="font-semibold text-ink-900">{job.bathrooms}</p>
                </div>
              )}
              {job.floor && (
                <div className="bg-cream-50 rounded-lg p-3 text-center">
                  <Building className="w-5 h-5 text-ink-400 mx-auto mb-1" />
                  <p className="text-sm text-ink-500">{isRTL ? 'الطابق' : 'Floor'}</p>
                  <p className="font-semibold text-ink-900">{job.floor}</p>
                </div>
              )}
            </div>

            {/* Due Date */}
            <div className="flex items-center gap-2 text-ink-600 mb-4">
              <Clock className="w-5 h-5" />
              <span className="font-medium">{isRTL ? 'موعد التسليم:' : 'Due Date:'}</span>
              <span>{formatDate(job.due_date)}</span>
              {daysUntilDue > 0 && (
                <span className={`text-sm ${daysUntilDue <= 1 ? 'text-orange-600' : 'text-ink-400'}`}>
                  ({daysUntilDue} {isRTL ? 'يوم متبقي' : daysUntilDue === 1 ? 'day left' : 'days left'})
                </span>
              )}
            </div>

            {/* Special Instructions */}
            {job.special_instructions && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-yellow-800 mb-2">
                  {isRTL ? 'تعليمات خاصة' : 'Special Instructions'}
                </h3>
                <p className="text-yellow-700">{job.special_instructions}</p>
              </div>
            )}

            {/* Earnings */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <h3 className="font-semibold text-emerald-800 mb-2">
                {isRTL ? 'أرباحك' : 'Your Earnings'}
              </h3>
              <p className="text-3xl font-bold text-emerald-600">
                {formatCurrency(job.appraiser_earnings)}
              </p>
              <p className="text-sm text-emerald-600 mt-1">
                {isRTL ? 'من إجمالي' : 'of'} {formatCurrency(job.total_price)}
              </p>
            </div>
          </div>

          {/* Client Info */}
          {job.client && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-ink-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-600" />
                {isRTL ? 'معلومات العميل' : 'Client Information'}
              </h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-ink-400" />
                  <span className="text-ink-700">{job.client.full_name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-ink-400" />
                  <a href={`mailto:${job.client.email}`} className="text-emerald-600 hover:underline">
                    {job.client.email}
                  </a>
                </div>
                {job.client.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-ink-400" />
                    <a href={`tel:${job.client.phone}`} className="text-emerald-600 hover:underline">
                      {job.client.phone}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Conversation */}
          {canMessage && (
            <JobConversation jobId={id!} jobStatus={job.status} />
          )}

          {/* Actions */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-ink-900 mb-4">
              {isRTL ? 'الإجراءات' : 'Actions'}
            </h2>
            <div className="flex flex-wrap gap-3">
              {job.status === 'accepted' && (
                <div className="w-full p-4 bg-yellow-50 rounded-lg text-center text-yellow-700">
                  {isRTL ? 'في انتظار دفع العميل' : 'Awaiting client payment'}
                </div>
              )}

              {job.status === 'paid' && (
                <button
                  onClick={handleStart}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {actionLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                  {isRTL ? 'بدء العمل' : 'Start Work'}
                </button>
              )}

              {job.status === 'in_progress' && (
                <Link
                  to={`/appraiser/jobs/${id}/deliver`}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  <FileText className="w-5 h-5" />
                  {isRTL ? 'تسليم التقرير' : 'Deliver Report'}
                </Link>
              )}

              {job.status === 'delivered' && (
                <div className="w-full p-4 bg-emerald-50 rounded-lg text-center text-emerald-700">
                  {isRTL ? 'تم تسليم التقرير - في انتظار قبول العميل' : 'Report delivered - Awaiting client acceptance'}
                </div>
              )}

              {job.status === 'completed' && (
                <div className="w-full p-4 bg-green-50 rounded-lg text-center text-green-700">
                  {isRTL ? 'تم اكتمال الطلب بنجاح' : 'Job completed successfully'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
