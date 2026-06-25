/**
 * Request Appraisal Form
 *
 * Client-facing form for requesting a new property appraisal.
 * Supports direct booking when appraiserId is provided in URL.
 * Calculates pricing based on property type, area, and urgency.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle } from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';

interface Governorate {
  id: string;
  name_en: string;
  name_ar: string;
}

interface City {
  id: string;
  name_en: string;
  name_ar: string;
}

interface District {
  id: string;
  name_en: string;
  name_ar: string;
}

interface PricingResult {
  basePrice: number;
  urgencyFee: number;
  platformFee: number;
  totalPrice: number;
  appraiserAmount: number;
}

interface SelectedAppraiser {
  id: string;
  full_name: string;
  avatar_url: string | null;
  license_number: string | null;
  years_experience: number | null;
  average_rating: number | null;
  completed_jobs: number;
  governorates: { name_en: string; name_ar: string }[];
}

const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Apartment', labelAr: 'شقة' },
  { value: 'villa', label: 'Villa', labelAr: 'فيلا' },
  { value: 'duplex', label: 'Duplex', labelAr: 'دوبلكس' },
  { value: 'commercial_shop', label: 'Commercial', labelAr: 'تجاري' },
  { value: 'office', label: 'Office', labelAr: 'مكتب' },
  { value: 'building', label: 'Building', labelAr: 'مبنى' },
  { value: 'compound_unit', label: 'Compound Unit', labelAr: 'وحدة كمبوند' },
  { value: 'roof', label: 'Roof', labelAr: 'روف' },
];

const REPORT_KINDS = [
  { value: 'brief', label: 'Brief Report', labelAr: 'تقرير موجز', desc: 'Basic valuation summary' },
  { value: 'detailed', label: 'Detailed Report', labelAr: 'تقرير تفصيلي', desc: 'Full analysis with comparables' },
  { value: 'full', label: 'Full Report', labelAr: 'تقرير كامل', desc: 'Comprehensive with photos & market study' },
];

const URGENCY_OPTIONS = [
  { value: 'standard', label: '7 Days', labelAr: '7 أيام', multiplier: '1x' },
  { value: 'priority', label: '3 Days', labelAr: '3 أيام', multiplier: '+50%' },
  { value: 'express', label: '24 Hours', labelAr: '24 ساعة', multiplier: '+100%' },
];

const PURPOSES = [
  { value: 'mortgage', label: 'Mortgage', labelAr: 'قرض عقاري' },
  { value: 'sale', label: 'Sale', labelAr: 'بيع' },
  { value: 'purchase', label: 'Purchase', labelAr: 'شراء' },
  { value: 'insurance', label: 'Insurance', labelAr: 'تأمين' },
  { value: 'legal', label: 'Legal/Court', labelAr: 'قانوني/محكمة' },
  { value: 'personal', label: 'Personal', labelAr: 'شخصي' },
];

export default function RequestAppraisal() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const isRTL = i18n.language === 'ar';

  // Get appraiserId from URL if present (direct booking)
  const appraiserId = searchParams.get('appraiserId');

  // Selected appraiser state (for direct booking)
  const [selectedAppraiser, setSelectedAppraiser] = useState<SelectedAppraiser | null>(null);

  // Form state
  const [propertyType, setPropertyType] = useState('apartment');
  const [governorateId, setGovernorateId] = useState('');
  const [cityId, setCityId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [addressDescription, setAddressDescription] = useState('');
  const [approximateArea, setApproximateArea] = useState<number | ''>('');
  const [floor, setFloor] = useState('');
  const [bedrooms, setBedrooms] = useState<number | ''>('');
  const [reportKind, setReportKind] = useState('brief');
  const [purpose, setPurpose] = useState('mortgage');
  const [urgency, setUrgency] = useState('standard');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Data
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [pricing, setPricing] = useState<PricingResult | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  // Fetch selected appraiser details if appraiserId is provided
  useEffect(() => {
    if (!appraiserId) return;

    async function fetchAppraiser() {
      try {
        const res = await fetch(`/api/appraisers/${appraiserId}`);
        if (res.ok) {
          const data = await res.json();
          setSelectedAppraiser(data.appraiser);
        }
      } catch (err) {
        console.error('Failed to fetch appraiser:', err);
      }
    }
    fetchAppraiser();
  }, [appraiserId]);

  // Fetch governorates
  useEffect(() => {
    async function fetchGovernorates() {
      try {
        const res = await fetch('/api/gazetteer/governorates');
        const data = await res.json();
        setGovernorates(data.governorates || []);
      } catch (err) {
        console.error('Failed to fetch governorates:', err);
      }
    }
    fetchGovernorates();
  }, []);

  // Fetch cities when governorate changes
  useEffect(() => {
    if (!governorateId) {
      setCities([]);
      setCityId('');
      return;
    }
    async function fetchCities() {
      try {
        const res = await fetch(`/api/gazetteer/cities?governorate_id=${governorateId}`);
        const data = await res.json();
        setCities(data.cities || []);
      } catch (err) {
        console.error('Failed to fetch cities:', err);
      }
    }
    fetchCities();
  }, [governorateId]);

  // Fetch districts when city changes
  useEffect(() => {
    if (!cityId) {
      setDistricts([]);
      setDistrictId('');
      return;
    }
    async function fetchDistricts() {
      try {
        const res = await fetch(`/api/gazetteer/districts?city_id=${cityId}`);
        const data = await res.json();
        setDistricts(data.districts || []);
      } catch (err) {
        console.error('Failed to fetch districts:', err);
      }
    }
    fetchDistricts();
  }, [cityId]);

  // Fetch pricing when relevant fields change
  useEffect(() => {
    async function fetchPricing() {
      try {
        const params = new URLSearchParams({
          propertyType,
          reportKind,
          urgency,
        });
        if (approximateArea) params.append('area', approximateArea.toString());
        if (appraiserId) params.append('appraiserId', appraiserId);

        const res = await fetch(`/api/marketplace/pricing?${params}`);
        const data = await res.json();
        setPricing(data);
      } catch (err) {
        console.error('Failed to fetch pricing:', err);
      }
    }
    fetchPricing();
  }, [propertyType, reportKind, urgency, approximateArea, appraiserId]);

  const formatCurrency = (value: number) => {
    // Convert from piasters to EGP
    return new Intl.NumberFormat(isRTL ? 'ar-EG' : 'en-EG', {
      style: 'currency',
      currency: 'EGP',
      maximumFractionDigits: 0,
    }).format(value / 100);
  };

  const handleSubmit = async () => {
    if (!governorateId || !addressDescription) {
      setError(t('marketplace.fillRequired'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (!session?.access_token) {
        setError(t('marketplace.loginFirst'));
        setLoading(false);
        return;
      }

      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          propertyType,
          governorateId,
          cityId: cityId || null,
          districtId: districtId || null,
          addressDescription,
          approximateArea: approximateArea || null,
          floor: floor || null,
          bedrooms: bedrooms || null,
          reportKind,
          purpose,
          urgency,
          specialInstructions: specialInstructions || null,
          // Direct booking: include selected appraiser
          appraiserId: appraiserId || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create job request');
      }

      const { job } = await res.json();

      // For direct booking, redirect to job detail (appraiser needs to accept)
      // For pool booking, redirect to payment
      if (appraiserId) {
        navigate(`/marketplace/jobs/${job.id}`);
      } else {
        navigate(`/marketplace/jobs/${job.id}/payment`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen bg-cream-50 pt-16 ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Header */}
      <header className="bg-white border-b border-cream-200 px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-ink-900">
            {t('marketplace.title')}
          </h1>
          <p className="text-sm text-ink-500 mt-1">
            {appraiserId && selectedAppraiser ? (
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                {t('marketplace.directBooking', { name: selectedAppraiser.full_name })}
              </span>
            ) : (
              t('marketplace.subtitle')
            )}
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= s
                    ? 'bg-emerald-600 text-white'
                    : 'bg-cream-200 text-ink-500'
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={`w-16 h-1 mx-2 ${
                    step > s ? 'bg-emerald-600' : 'bg-cream-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Step 1: Property Details */}
        {step === 1 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-ink-900 mb-4">
              {t('marketplace.steps.propertyDetails')}
            </h2>

            <div className="space-y-4">
              {/* Property Type */}
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">
                  {t('marketplace.propertyType')} *
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {PROPERTY_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setPropertyType(type.value)}
                      className={`p-3 rounded-lg border text-center transition ${
                        propertyType === type.value
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                          : 'border-cream-300 hover:border-cream-400'
                      }`}
                    >
                      {isRTL ? type.labelAr : type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1">
                    {t('marketplace.governorate')} *
                  </label>
                  <select
                    value={governorateId}
                    onChange={(e) => setGovernorateId(e.target.value)}
                    className="w-full px-3 py-2 border border-cream-300 rounded-lg"
                  >
                    <option value="">{t('marketplace.selectGovernorate')}</option>
                    {governorates.map((gov) => (
                      <option key={gov.id} value={gov.id}>
                        {isRTL ? gov.name_ar : gov.name_en}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1">
                    {t('marketplace.city')}
                  </label>
                  <select
                    value={cityId}
                    onChange={(e) => setCityId(e.target.value)}
                    className="w-full px-3 py-2 border border-cream-300 rounded-lg"
                    disabled={!governorateId}
                  >
                    <option value="">{t('marketplace.selectCity')}</option>
                    {cities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {isRTL ? city.name_ar : city.name_en}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1">
                    {t('marketplace.district')}
                  </label>
                  <select
                    value={districtId}
                    onChange={(e) => setDistrictId(e.target.value)}
                    className="w-full px-3 py-2 border border-cream-300 rounded-lg"
                    disabled={!cityId}
                  >
                    <option value="">{t('marketplace.selectDistrict')}</option>
                    {districts.map((dist) => (
                      <option key={dist.id} value={dist.id}>
                        {isRTL ? dist.name_ar : dist.name_en}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">
                  {t('marketplace.addressDescription')} *
                </label>
                <textarea
                  value={addressDescription}
                  onChange={(e) => setAddressDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-cream-300 rounded-lg"
                  placeholder={t('marketplace.addressPlaceholder')}
                />
              </div>

              {/* Property Specs */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1">
                    {t('marketplace.approximateArea')}
                  </label>
                  <input
                    type="number"
                    value={approximateArea}
                    onChange={(e) => setApproximateArea(e.target.value ? parseInt(e.target.value) : '')}
                    className="w-full px-3 py-2 border border-cream-300 rounded-lg"
                    placeholder="200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1">
                    {t('marketplace.floor')}
                  </label>
                  <input
                    type="text"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    className="w-full px-3 py-2 border border-cream-300 rounded-lg"
                    placeholder={isRTL ? 'الثالث' : '3rd'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1">
                    {t('marketplace.bedrooms')}
                  </label>
                  <input
                    type="number"
                    value={bedrooms}
                    onChange={(e) => setBedrooms(e.target.value ? parseInt(e.target.value) : '')}
                    className="w-full px-3 py-2 border border-cream-300 rounded-lg"
                    placeholder="3"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setStep(2)}
                disabled={!governorateId || !addressDescription}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('marketplace.next')}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Report Options */}
        {step === 2 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-ink-900 mb-4">
              {t('marketplace.steps.reportOptions')}
            </h2>

            <div className="space-y-6">
              {/* Report Kind */}
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-2">
                  {t('marketplace.reportType')}
                </label>
                <div className="space-y-3">
                  {REPORT_KINDS.map((kind) => (
                    <label
                      key={kind.value}
                      className={`flex items-start p-4 rounded-lg border cursor-pointer transition ${
                        reportKind === kind.value
                          ? 'border-emerald-600 bg-emerald-50'
                          : 'border-cream-300 hover:border-cream-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name="reportKind"
                        value={kind.value}
                        checked={reportKind === kind.value}
                        onChange={(e) => setReportKind(e.target.value)}
                        className="mt-1 text-emerald-600"
                      />
                      <div className="ml-3">
                        <span className="font-medium text-ink-900">
                          {isRTL ? kind.labelAr : kind.label}
                        </span>
                        <p className="text-sm text-ink-500">{kind.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Urgency */}
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-2">
                  {t('marketplace.deliverySpeed')}
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {URGENCY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setUrgency(opt.value)}
                      className={`p-4 rounded-lg border text-center transition ${
                        urgency === opt.value
                          ? 'border-emerald-600 bg-emerald-50'
                          : 'border-cream-300 hover:border-cream-400'
                      }`}
                    >
                      <span className="block font-medium text-ink-900">
                        {isRTL ? opt.labelAr : opt.label}
                      </span>
                      <span className="text-sm text-ink-500">{opt.multiplier}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Purpose */}
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">
                  {t('marketplace.purpose')}
                </label>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full px-3 py-2 border border-cream-300 rounded-lg"
                >
                  {PURPOSES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {isRTL ? p.labelAr : p.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Special Instructions */}
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">
                  {t('marketplace.specialInstructions')}
                </label>
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-cream-300 rounded-lg"
                  placeholder={t('marketplace.specialInstructionsPlaceholder')}
                />
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2 border border-cream-300 text-ink-700 rounded-lg hover:bg-cream-50"
              >
                {t('marketplace.back')}
              </button>
              <button
                onClick={() => setStep(3)}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                {t('marketplace.next')}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Payment */}
        {step === 3 && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-ink-900 mb-4">
                {t('marketplace.orderSummary')}
              </h2>

              <div className="space-y-3 text-sm">
                {/* Selected Appraiser (Direct Booking) */}
                {selectedAppraiser && (
                  <div className="flex justify-between py-2 border-b border-cream-100">
                    <span className="text-ink-500">{t('marketplace.appraiser')}</span>
                    <span className="font-medium text-ink-900 flex items-center gap-2">
                      {selectedAppraiser.full_name}
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-cream-100">
                  <span className="text-ink-500">{t('marketplace.propertyType')}</span>
                  <span className="font-medium text-ink-900">
                    {t(`propertyTypes.${propertyType}`)}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-cream-100">
                  <span className="text-ink-500">{t('marketplace.location')}</span>
                  <span className="font-medium text-ink-900">
                    {governorates.find((g) => g.id === governorateId)?.[isRTL ? 'name_ar' : 'name_en']}
                    {cityId && `, ${cities.find((c) => c.id === cityId)?.[isRTL ? 'name_ar' : 'name_en']}`}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-cream-100">
                  <span className="text-ink-500">{t('marketplace.reportType')}</span>
                  <span className="font-medium text-ink-900">
                    {t(`marketplace.reportKinds.${reportKind}`)}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-cream-100">
                  <span className="text-ink-500">{t('marketplace.deliverySpeed')}</span>
                  <span className="font-medium text-ink-900">
                    {t(`marketplace.urgency.${urgency}`)}
                  </span>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-ink-900 mb-4">
                {t('marketplace.pricing')}
              </h2>

              {pricing && (
                <div className="space-y-3">
                  <div className="flex justify-between py-2">
                    <span className="text-ink-500">{t('marketplace.basePrice')}</span>
                    <span className="text-ink-900">{formatCurrency(pricing.basePrice)}</span>
                  </div>
                  {pricing.urgencyFee > 0 && (
                    <div className="flex justify-between py-2">
                      <span className="text-ink-500">{t('marketplace.urgencyFee')}</span>
                      <span className="text-ink-900">+{formatCurrency(pricing.urgencyFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-3 border-t border-cream-200">
                    <span className="font-semibold text-ink-900">{t('marketplace.total')}</span>
                    <span className="text-2xl font-bold text-emerald-600">
                      {formatCurrency(pricing.totalPrice)}
                    </span>
                  </div>
                </div>
              )}

              {/* Direct booking workflow note */}
              {appraiserId && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    {t('marketplace.directBookingNote')}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-2 border border-cream-300 text-ink-700 rounded-lg hover:bg-cream-50"
              >
                {t('marketplace.back')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-8 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium"
              >
                {loading
                  ? t('marketplace.creating')
                  : appraiserId
                  ? t('marketplace.sendRequest')
                  : t('marketplace.proceedPayment')}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
