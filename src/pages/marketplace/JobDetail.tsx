/**
 * Job Detail Page (Client View)
 *
 * Shows job details, deliverables, and allows completing the job.
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/contexts/AuthContext';
import { JobConversation } from '@/src/components/JobConversation';

interface Deliverable {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string;
  report_type: string;
  notes: string | null;
  delivered_at: string;
  download_count: number;
}

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
  accepted_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;
  appraiser_notes: string | null;
  governorates: { name_en: string; name_ar: string } | null;
  cities: { name_en: string; name_ar: string } | null;
  appraiser: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

const STATUS_LABELS: Record<string, { en: string; ar: string; color: string }> = {
  draft: { en: 'Draft', ar: 'مسودة', color: 'bg-gray-100 text-gray-700' },
  pending_acceptance: { en: 'Pending Acceptance', ar: 'في انتظار القبول', color: 'bg-amber-100 text-amber-700' },
  accepted: { en: 'Accepted', ar: 'مقبول', color: 'bg-blue-100 text-blue-700' },
  declined: { en: 'Declined', ar: 'مرفوض', color: 'bg-red-100 text-red-700' },
  pending_payment: { en: 'Pending Payment', ar: 'في انتظار الدفع', color: 'bg-yellow-100 text-yellow-700' },
  paid: { en: 'Paid', ar: 'تم الدفع', color: 'bg-blue-100 text-blue-700' },
  in_progress: { en: 'In Progress', ar: 'قيد التنفيذ', color: 'bg-indigo-100 text-indigo-700' },
  delivered: { en: 'Delivered', ar: 'تم التسليم', color: 'bg-emerald-100 text-emerald-700' },
  completed: { en: 'Completed', ar: 'مكتمل', color: 'bg-green-100 text-green-700' },
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

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const { i18n } = useTranslation();
  const { session } = useAuth();
  const isRTL = i18n.language === 'ar';

  const [job, setJob] = useState<Job | null>(null);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchJob() {
      if (!id || !session?.access_token) return;

      try {
        const [jobRes, delivRes] = await Promise.all([
          fetch(`/api/jobs/${id}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
          fetch(`/api/jobs/${id}/deliverables`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
        ]);

        if (jobRes.ok) {
          const jobData = await jobRes.json();
          setJob(jobData.job);
        }

        if (delivRes.ok) {
          const delivData = await delivRes.json();
          setDeliverables(delivData.deliverables || []);
        }
      } catch (err) {
        console.error('Failed to fetch job:', err);
        setError('Failed to load job details');
      } finally {
        setLoading(false);
      }
    }
    fetchJob();
  }, [id, session?.access_token]);

  const handleComplete = async () => {
    if (!id || !session?.access_token) return;

    setCompleting(true);
    try {
      const res = await fetch(`/api/jobs/${id}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        setJob((prev) => (prev ? { ...prev, status: 'completed', completed_at: new Date().toISOString() } : null));
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to complete job');
      }
    } catch (err) {
      console.error('Failed to complete job:', err);
      setError('Failed to complete job');
    } finally {
      setCompleting(false);
    }
  };

  const handleDownload = async (deliverable: Deliverable) => {
    if (!session?.access_token) return;

    // Record download
    await fetch(`/api/deliverables/${deliverable.id}/download`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    // Open file (in real app, this would be a signed URL from storage)
    window.open(deliverable.file_path, '_blank');
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

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-50 pt-16 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-cream-50 pt-16 flex items-center justify-center">
        <div className="text-center">
          <p className="text-ink-500">{isRTL ? 'لم يتم العثور على الطلب' : 'Job not found'}</p>
          <Link to="/marketplace/jobs" className="text-emerald-600 hover:underline mt-2 inline-block">
            {isRTL ? 'العودة للطلبات' : 'Back to My Jobs'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-cream-50 pt-16 ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Header */}
      <header className="bg-white border-b border-cream-200 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <Link to="/marketplace/jobs" className="text-sm text-ink-500 hover:text-ink-700 mb-2 inline-block">
            &larr; {isRTL ? 'العودة للطلبات' : 'Back to My Jobs'}
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${STATUS_LABELS[job.status]?.color}`}
              >
                {isRTL ? STATUS_LABELS[job.status]?.ar : STATUS_LABELS[job.status]?.en}
              </span>
              <h1 className="text-2xl font-bold text-ink-900 mt-2">
                {isRTL
                  ? PROPERTY_TYPE_LABELS[job.property_type]?.ar
                  : PROPERTY_TYPE_LABELS[job.property_type]?.en}{' '}
                - {job.governorates ? (isRTL ? job.governorates.name_ar : job.governorates.name_en) : ''}
              </h1>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-ink-900">{formatCurrency(job.total_price)}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Job Details */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-ink-900 mb-4">
            {isRTL ? 'تفاصيل الطلب' : 'Request Details'}
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-ink-500">{isRTL ? 'العنوان:' : 'Address:'}</span>
              <p className="text-ink-900 mt-1">{job.address_description}</p>
            </div>
            <div>
              <span className="text-ink-500">{isRTL ? 'نوع التقرير:' : 'Report Type:'}</span>
              <p className="text-ink-900 mt-1 capitalize">{job.report_kind}</p>
            </div>
            <div>
              <span className="text-ink-500">{isRTL ? 'تاريخ الطلب:' : 'Requested:'}</span>
              <p className="text-ink-900 mt-1">{formatDate(job.created_at)}</p>
            </div>
            <div>
              <span className="text-ink-500">{isRTL ? 'موعد التسليم:' : 'Due Date:'}</span>
              <p className="text-ink-900 mt-1">{formatDate(job.due_date)}</p>
            </div>
          </div>
        </div>

        {/* Appraiser Info */}
        {job.appraiser && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-ink-900 mb-4">
              {isRTL ? 'المقيم' : 'Appraiser'}
            </h2>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-cream-200 flex items-center justify-center">
                {job.appraiser.avatar_url ? (
                  <img
                    src={job.appraiser.avatar_url}
                    alt={job.appraiser.full_name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-bold text-ink-400">
                    {job.appraiser.full_name.charAt(0)}
                  </span>
                )}
              </div>
              <div>
                <p className="font-semibold text-ink-900">{job.appraiser.full_name}</p>
                <Link
                  to={`/appraisers/${job.appraiser.id}`}
                  className="text-sm text-emerald-600 hover:underline"
                >
                  {isRTL ? 'عرض الملف الشخصي' : 'View Profile'}
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Conversation */}
        {job.appraiser && (
          <JobConversation jobId={id!} jobStatus={job.status} />
        )}

        {/* Deliverables */}
        {deliverables.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-ink-900 mb-4">
              {isRTL ? 'المرفقات' : 'Deliverables'}
            </h2>
            <div className="space-y-3">
              {deliverables.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between p-4 bg-cream-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-emerald-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-ink-900">{d.file_name}</p>
                      <p className="text-xs text-ink-500">
                        {formatFileSize(d.file_size)} • {formatDate(d.delivered_at)}
                        {d.notes && ` • ${d.notes}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownload(d)}
                    className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    {isRTL ? 'تحميل' : 'Download'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payment Required */}
        {(job.status === 'pending_payment' || job.status === 'accepted') && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-amber-900 mb-2">
              {isRTL ? 'مطلوب الدفع' : 'Payment Required'}
            </h2>
            <p className="text-sm text-amber-700 mb-4">
              {isRTL
                ? 'يرجى إتمام الدفع للمتابعة مع طلب التقييم الخاص بك.'
                : 'Please complete payment to proceed with your appraisal request.'}
            </p>
            <Link
              to={`/marketplace/jobs/${id}/payment`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              {isRTL ? `ادفع ${formatCurrency(job.total_price)}` : `Pay ${formatCurrency(job.total_price)}`}
            </Link>
          </div>
        )}

        {/* Complete Job Action */}
        {job.status === 'delivered' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-emerald-900 mb-2">
              {isRTL ? 'هل أنت راضٍ عن التقرير؟' : 'Satisfied with the report?'}
            </h2>
            <p className="text-sm text-emerald-700 mb-4">
              {isRTL
                ? 'بمجرد تأكيد الاستلام، سيتم إصدار الدفعة للمقيم.'
                : 'Once you confirm receipt, payment will be released to the appraiser.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleComplete}
                disabled={completing}
                className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-50"
              >
                {completing
                  ? isRTL
                    ? 'جارٍ التأكيد...'
                    : 'Confirming...'
                  : isRTL
                  ? 'تأكيد الاستلام'
                  : 'Confirm Receipt'}
              </button>
              <button className="px-6 py-3 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 font-medium">
                {isRTL ? 'فتح نزاع' : 'Open Dispute'}
              </button>
            </div>
          </div>
        )}

        {/* Completed Status */}
        {job.status === 'completed' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-green-900 mb-2">
              {isRTL ? 'اكتمل الطلب' : 'Job Completed'}
            </h2>
            <p className="text-sm text-green-700">
              {isRTL
                ? `تم إكمال هذا الطلب في ${formatDate(job.completed_at!)}`
                : `This job was completed on ${formatDate(job.completed_at!)}`}
            </p>
          </div>
        )}

        {/* Status Timeline */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-ink-900 mb-4">
            {isRTL ? 'الجدول الزمني' : 'Timeline'}
          </h2>
          <div className="space-y-4">
            <TimelineItem
              done
              label={isRTL ? 'تم إنشاء الطلب' : 'Request Created'}
              date={formatDate(job.created_at)}
            />
            {job.accepted_at && (
              <TimelineItem
                done
                label={isRTL ? 'قبل المقيم الطلب' : 'Appraiser Accepted'}
                date={formatDate(job.accepted_at)}
              />
            )}
            {job.delivered_at && (
              <TimelineItem
                done
                label={isRTL ? 'تم تسليم التقرير' : 'Report Delivered'}
                date={formatDate(job.delivered_at)}
              />
            )}
            {job.completed_at && (
              <TimelineItem
                done
                label={isRTL ? 'اكتمل الطلب' : 'Job Completed'}
                date={formatDate(job.completed_at)}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function TimelineItem({ done, label, date }: { done: boolean; label: string; date: string }) {
  return (
    <div className="flex items-center gap-4">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center ${
          done ? 'bg-emerald-100' : 'bg-cream-200'
        }`}
      >
        {done ? (
          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <div className="w-2 h-2 bg-ink-300 rounded-full" />
        )}
      </div>
      <div className="flex-1">
        <p className={`font-medium ${done ? 'text-ink-900' : 'text-ink-400'}`}>{label}</p>
        <p className="text-xs text-ink-500">{date}</p>
      </div>
    </div>
  );
}
