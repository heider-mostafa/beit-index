/**
 * Payment Checkout Page
 *
 * Displays order summary and embeds Paymob payment iframe.
 * Handles payment initiation and success/failure states.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/contexts/AuthContext';
import { CreditCard, CheckCircle, XCircle, Loader2, Shield, ArrowLeft } from 'lucide-react';

interface Job {
  id: string;
  status: string;
  property_type: string;
  address_description: string;
  report_kind: string;
  urgency: string;
  base_price: number;
  urgency_fee: number;
  platform_fee: number;
  total_price: number;
  due_date: string;
  governorates: { name_en: string; name_ar: string } | null;
  cities: { name_en: string; name_ar: string } | null;
  appraiser?: {
    id: string;
    full_name: string;
  } | null;
}

interface PaymentInitResponse {
  payment: {
    id: string;
    amount: number;
    status: string;
  };
  paymob: {
    orderId: number;
    iframeUrl: string;
  };
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

const URGENCY_LABELS: Record<string, { en: string; ar: string }> = {
  standard: { en: '7 Days', ar: '7 أيام' },
  priority: { en: '3 Days (+50%)', ar: '3 أيام (+50%)' },
  express: { en: '24 Hours (+100%)', ar: '24 ساعة (+100%)' },
};

export default function PaymentCheckout() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const isRTL = i18n.language === 'ar';

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [initiatingPayment, setInitiatingPayment] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'processing' | 'success' | 'failed'>('pending');

  // Fetch job details
  useEffect(() => {
    async function fetchJob() {
      if (!id || !session?.access_token) return;

      try {
        const res = await fetch(`/api/jobs/${id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setJob(data.job);

          // Check if job is in correct status for payment
          if (!['draft', 'pending_payment', 'accepted'].includes(data.job.status)) {
            if (data.job.status === 'paid' || data.job.status === 'in_progress' || data.job.status === 'completed') {
              // Already paid, redirect to job detail
              navigate(`/marketplace/jobs/${id}`);
              return;
            }
            setError(t('payment.paymentNotAvailable'));
          }
        } else {
          setError(t('payment.errors.failedToLoad'));
        }
      } catch (err) {
        console.error('Failed to fetch job:', err);
        setError(t('payment.errors.failedToLoad'));
      } finally {
        setLoading(false);
      }
    }
    fetchJob();
  }, [id, session?.access_token, navigate, isRTL]);

  // Listen for payment completion via postMessage from iframe
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // Paymob sends messages about payment status
      if (event.data?.type === 'PAYMOB_PAYMENT_SUCCESS') {
        setPaymentStatus('success');
        setTimeout(() => {
          navigate(`/marketplace/jobs/${id}`);
        }, 2000);
      } else if (event.data?.type === 'PAYMOB_PAYMENT_FAILED') {
        setPaymentStatus('failed');
        setError(t('payment.errors.paymentFailed'));
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [id, navigate, isRTL]);

  const initiatePayment = async () => {
    if (!id || !session?.access_token) return;

    setInitiatingPayment(true);
    setError(null);

    try {
      const res = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ jobId: id }),
      });

      const data: PaymentInitResponse = await res.json();

      if (!res.ok) {
        throw new Error((data as any).error || 'Failed to initiate payment');
      }

      setPaymentUrl(data.paymob.iframeUrl);
      setPaymentStatus('processing');
    } catch (err) {
      console.error('Payment initiation failed:', err);
      setError((err as Error).message);
    } finally {
      setInitiatingPayment(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(isRTL ? 'ar-EG' : 'en-EG', {
      style: 'currency',
      currency: 'EGP',
      maximumFractionDigits: 0,
    }).format(value / 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-50 pt-16 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (paymentStatus === 'success') {
    return (
      <div className="min-h-screen bg-cream-50 pt-16 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-ink-900 mb-2">
            {t('payment.success')}
          </h2>
          <p className="text-ink-500 mb-4">
            {t('payment.successMessage')}
          </p>
          <p className="text-sm text-ink-400">
            {t('deliver.redirecting')}
          </p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-cream-50 pt-16 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-ink-500">{t('payment.jobNotFound')}</p>
          <Link to="/marketplace/jobs" className="text-emerald-600 hover:underline mt-2 inline-block">
            {t('payment.backToJobs')}
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
          <Link
            to={`/marketplace/jobs/${id}`}
            className="text-sm text-ink-500 hover:text-ink-700 mb-2 inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('payment.backToJob')}
          </Link>
          <h1 className="text-2xl font-bold text-ink-900">
            {t('payment.title')}
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        <div className="grid md:grid-cols-5 gap-8">
          {/* Order Summary - Left Side */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
              <h2 className="text-lg font-semibold text-ink-900 mb-4">
                {t('payment.orderSummary')}
              </h2>

              {/* Property Info */}
              <div className="border-b border-cream-100 pb-4 mb-4">
                <p className="font-medium text-ink-900">
                  {t(`propertyTypes.${job.property_type}`)}
                </p>
                <p className="text-sm text-ink-500 mt-1">
                  {job.governorates
                    ? isRTL
                      ? job.governorates.name_ar
                      : job.governorates.name_en
                    : ''}
                  {job.cities && `, ${isRTL ? job.cities.name_ar : job.cities.name_en}`}
                </p>
                <p className="text-sm text-ink-400 mt-1">{job.address_description}</p>
              </div>

              {/* Report Details */}
              <div className="border-b border-cream-100 pb-4 mb-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-ink-500">{t('payment.reportType')}</span>
                  <span className="text-ink-700">
                    {t(`marketplace.reportKinds.${job.report_kind}`)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-500">{t('payment.delivery')}</span>
                  <span className="text-ink-700">
                    {t(`marketplace.urgency.${job.urgency}`)}
                  </span>
                </div>
              </div>

              {/* Pricing Breakdown */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-ink-500">{t('payment.basePrice')}</span>
                  <span className="text-ink-700">{formatCurrency(job.base_price)}</span>
                </div>
                {job.urgency_fee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-500">{t('payment.urgencyFee')}</span>
                    <span className="text-ink-700">{formatCurrency(job.urgency_fee)}</span>
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="border-t border-cream-200 pt-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-ink-900">
                    {t('payment.total')}
                  </span>
                  <span className="text-2xl font-bold text-emerald-600">
                    {formatCurrency(job.total_price)}
                  </span>
                </div>
                <p className="text-xs text-ink-400 mt-1">
                  {t('payment.includingFees')}
                </p>
              </div>

              {/* Security Badge */}
              <div className="mt-6 flex items-center gap-2 text-xs text-ink-400">
                <Shield className="w-4 h-4" />
                <span>{t('payment.securePayment')}</span>
              </div>
            </div>
          </div>

          {/* Payment Section - Right Side */}
          <div className="md:col-span-3">
            {!paymentUrl ? (
              <div className="bg-white rounded-xl shadow-sm p-8">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CreditCard className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-ink-900 mb-2">
                    {t('payment.readyToPay')}
                  </h2>
                  <p className="text-ink-500">
                    {t('payment.readyToPayDesc')}
                  </p>
                </div>

                {/* Payment Methods Info */}
                <div className="bg-cream-50 rounded-lg p-4 mb-6">
                  <p className="text-sm font-medium text-ink-700 mb-2">
                    {t('payment.availableMethods')}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <span className="px-3 py-1 bg-white rounded text-sm text-ink-600">
                      Visa / Mastercard
                    </span>
                    <span className="px-3 py-1 bg-white rounded text-sm text-ink-600">
                      {t('payment.mobileWallets')}
                    </span>
                    <span className="px-3 py-1 bg-white rounded text-sm text-ink-600">
                      {t('payment.fawryAman')}
                    </span>
                  </div>
                </div>

                <button
                  onClick={initiatePayment}
                  disabled={initiatingPayment}
                  className="w-full px-6 py-4 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2 transition"
                >
                  {initiatingPayment ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t('payment.loading')}
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" />
                      {t('payment.payButton', { amount: formatCurrency(job.total_price) })}
                    </>
                  )}
                </button>

                <p className="text-center text-xs text-ink-400 mt-4">
                  {t('payment.termsAgreement')}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 bg-cream-50 border-b border-cream-200">
                  <p className="text-sm text-ink-600 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-600" />
                    {t('payment.enterPaymentDetails')}
                  </p>
                </div>
                <iframe
                  src={paymentUrl}
                  title="Payment"
                  className="w-full h-[600px] border-0"
                  allow="payment"
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
