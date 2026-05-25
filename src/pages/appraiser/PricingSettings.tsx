/**
 * Appraiser Pricing Settings
 *
 * Allows appraisers to set and manage their prices for different
 * property types and report kinds.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  DollarSign,
  Save,
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  Edit2,
  Trash2,
  Plus,
} from 'lucide-react';

interface PricingEntry {
  id?: string;
  property_type: string;
  report_kind: string;
  price: number;
  is_active: boolean;
}

const PROPERTY_TYPES = [
  { value: 'apartment', labelEn: 'Apartment', labelAr: 'شقة' },
  { value: 'villa', labelEn: 'Villa', labelAr: 'فيلا' },
  { value: 'duplex', labelEn: 'Duplex', labelAr: 'دوبلكس' },
  { value: 'commercial_shop', labelEn: 'Commercial Shop', labelAr: 'محل تجاري' },
  { value: 'office', labelEn: 'Office', labelAr: 'مكتب' },
  { value: 'building', labelEn: 'Building', labelAr: 'مبنى' },
  { value: 'compound_unit', labelEn: 'Compound Unit', labelAr: 'وحدة كمبوند' },
  { value: 'roof', labelEn: 'Roof', labelAr: 'روف' },
];

const REPORT_KINDS = [
  { value: 'brief', labelEn: 'Brief Report', labelAr: 'تقرير موجز', descEn: 'Basic valuation summary', descAr: 'ملخص تقييم أساسي' },
  { value: 'detailed', labelEn: 'Detailed Report', labelAr: 'تقرير تفصيلي', descEn: 'Full analysis with comparables', descAr: 'تحليل كامل مع المقارنات' },
  { value: 'full', labelEn: 'Full Report', labelAr: 'تقرير كامل', descEn: 'Comprehensive with photos & market study', descAr: 'شامل مع الصور ودراسة السوق' },
];

export default function PricingSettings() {
  const { i18n } = useTranslation();
  const { session } = useAuth();
  const isRTL = i18n.language === 'ar';

  const [pricing, setPricing] = useState<PricingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal state for adding/editing
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PricingEntry | null>(null);
  const [formData, setFormData] = useState({
    property_type: 'apartment',
    report_kind: 'brief',
    price: '',
  });

  const fetchPricing = useCallback(async () => {
    if (!session?.access_token) return;

    try {
      const res = await fetch('/api/appraiser/pricing', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setPricing(data.pricing || []);
      }
    } catch (err) {
      console.error('Failed to fetch pricing:', err);
      setError(isRTL ? 'فشل في تحميل الأسعار' : 'Failed to load pricing');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, isRTL]);

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  const handleOpenModal = (entry?: PricingEntry) => {
    if (entry) {
      setEditingEntry(entry);
      setFormData({
        property_type: entry.property_type,
        report_kind: entry.report_kind,
        price: (entry.price / 100).toString(), // Convert from piasters to EGP
      });
    } else {
      setEditingEntry(null);
      setFormData({
        property_type: 'apartment',
        report_kind: 'brief',
        price: '',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingEntry(null);
    setFormData({ property_type: 'apartment', report_kind: 'brief', price: '' });
  };

  const handleSave = async () => {
    if (!session?.access_token) return;

    const priceEGP = parseFloat(formData.price);
    if (isNaN(priceEGP) || priceEGP <= 0) {
      setError(isRTL ? 'يرجى إدخال سعر صحيح' : 'Please enter a valid price');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const url = editingEntry
        ? `/api/appraiser/pricing/${editingEntry.id}`
        : '/api/appraiser/pricing';
      const method = editingEntry ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          propertyType: formData.property_type,
          reportKind: formData.report_kind,
          price: Math.round(priceEGP * 100), // Convert to piasters
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save pricing');
      }

      setSuccess(isRTL ? 'تم حفظ السعر بنجاح' : 'Pricing saved successfully');
      handleCloseModal();
      fetchPricing();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save pricing';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!session?.access_token) return;
    if (!confirm(isRTL ? 'هل أنت متأكد من حذف هذا السعر؟' : 'Are you sure you want to delete this pricing?')) {
      return;
    }

    try {
      const res = await fetch(`/api/appraiser/pricing/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete pricing');
      }

      setSuccess(isRTL ? 'تم حذف السعر' : 'Pricing deleted');
      fetchPricing();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete pricing';
      setError(message);
    }
  };

  const handleToggleActive = async (entry: PricingEntry) => {
    if (!session?.access_token || !entry.id) return;

    try {
      const res = await fetch(`/api/appraiser/pricing/${entry.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          propertyType: entry.property_type,
          reportKind: entry.report_kind,
          price: entry.price,
          isActive: !entry.is_active,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update pricing');
      }

      fetchPricing();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update pricing';
      setError(message);
    }
  };

  const formatCurrency = (piasters: number) => {
    return new Intl.NumberFormat(isRTL ? 'ar-EG' : 'en-EG', {
      style: 'currency',
      currency: 'EGP',
      maximumFractionDigits: 0,
    }).format(piasters / 100);
  };

  const getPropertyLabel = (value: string) => {
    const prop = PROPERTY_TYPES.find((p) => p.value === value);
    return prop ? (isRTL ? prop.labelAr : prop.labelEn) : value;
  };

  const getReportLabel = (value: string) => {
    const report = REPORT_KINDS.find((r) => r.value === value);
    return report ? (isRTL ? report.labelAr : report.labelEn) : value;
  };

  // Check if a combination already exists
  const combinationExists = (propertyType: string, reportKind: string) => {
    return pricing.some(
      (p) =>
        p.property_type === propertyType &&
        p.report_kind === reportKind &&
        (!editingEntry || p.id !== editingEntry.id)
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-50 pt-16 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-cream-50 pt-16 ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Header */}
      <header className="bg-white border-b border-cream-200 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <Link
            to="/appraiser/jobs"
            className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-700 mb-2"
          >
            <ChevronLeft className="w-4 h-4" />
            {isRTL ? 'العودة للوحة التحكم' : 'Back to Dashboard'}
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-ink-900 flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-emerald-600" />
                {isRTL ? 'إعدادات الأسعار' : 'Pricing Settings'}
              </h1>
              <p className="text-sm text-ink-500 mt-1">
                {isRTL
                  ? 'حدد أسعارك لكل نوع عقار ونوع تقرير'
                  : 'Set your prices for each property type and report kind'}
              </p>
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
            >
              <Plus className="w-5 h-5" />
              {isRTL ? 'إضافة سعر' : 'Add Pricing'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-red-700">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
              &times;
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <span className="text-emerald-700">{success}</span>
          </div>
        )}

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            {isRTL
              ? 'الأسعار بالجنيه المصري. العملاء سيرون هذه الأسعار عند طلب خدماتك. يمكنك تفعيل أو تعطيل أي سعر دون حذفه.'
              : 'Prices are in Egyptian Pounds (EGP). Clients will see these prices when requesting your services. You can enable or disable any pricing without deleting it.'}
          </p>
        </div>

        {/* Pricing Grid */}
        {pricing.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <DollarSign className="w-12 h-12 text-ink-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-ink-900 mb-2">
              {isRTL ? 'لم يتم تحديد أسعار بعد' : 'No Pricing Set Yet'}
            </h3>
            <p className="text-ink-500 mb-6">
              {isRTL
                ? 'أضف أسعارك لبدء استقبال طلبات التقييم من العملاء'
                : 'Add your pricing to start receiving appraisal requests from clients'}
            </p>
            <button
              onClick={() => handleOpenModal()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
            >
              <Plus className="w-5 h-5" />
              {isRTL ? 'إضافة أول سعر' : 'Add Your First Pricing'}
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-cream-50 border-b border-cream-200">
                <tr>
                  <th className="px-6 py-3 text-start text-sm font-medium text-ink-500">
                    {isRTL ? 'نوع العقار' : 'Property Type'}
                  </th>
                  <th className="px-6 py-3 text-start text-sm font-medium text-ink-500">
                    {isRTL ? 'نوع التقرير' : 'Report Kind'}
                  </th>
                  <th className="px-6 py-3 text-start text-sm font-medium text-ink-500">
                    {isRTL ? 'السعر' : 'Price'}
                  </th>
                  <th className="px-6 py-3 text-start text-sm font-medium text-ink-500">
                    {isRTL ? 'الحالة' : 'Status'}
                  </th>
                  <th className="px-6 py-3 text-end text-sm font-medium text-ink-500">
                    {isRTL ? 'إجراءات' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {pricing.map((entry) => (
                  <tr key={entry.id} className={!entry.is_active ? 'bg-cream-50 opacity-60' : ''}>
                    <td className="px-6 py-4 text-sm font-medium text-ink-900">
                      {getPropertyLabel(entry.property_type)}
                    </td>
                    <td className="px-6 py-4 text-sm text-ink-700">
                      {getReportLabel(entry.report_kind)}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-emerald-600">
                      {formatCurrency(entry.price)}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(entry)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                          entry.is_active
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {entry.is_active
                          ? isRTL
                            ? 'مفعل'
                            : 'Active'
                          : isRTL
                          ? 'معطل'
                          : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-end">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(entry)}
                          className="p-2 text-ink-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                          title={isRTL ? 'تعديل' : 'Edit'}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => entry.id && handleDelete(entry.id)}
                          className="p-2 text-ink-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title={isRTL ? 'حذف' : 'Delete'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Quick Add Templates */}
        {pricing.length > 0 && pricing.length < 24 && (
          <div className="mt-8">
            <h3 className="text-sm font-medium text-ink-500 mb-3">
              {isRTL ? 'إضافة سريعة' : 'Quick Add'}
            </h3>
            <div className="flex flex-wrap gap-2">
              {PROPERTY_TYPES.slice(0, 4).map((prop) =>
                REPORT_KINDS.map((report) => {
                  const exists = combinationExists(prop.value, report.value);
                  if (exists) return null;
                  return (
                    <button
                      key={`${prop.value}-${report.value}`}
                      onClick={() => {
                        setFormData({
                          property_type: prop.value,
                          report_kind: report.value,
                          price: '',
                        });
                        setEditingEntry(null);
                        setShowModal(true);
                      }}
                      className="px-3 py-1.5 text-xs bg-cream-100 text-ink-600 rounded-lg hover:bg-cream-200 transition"
                    >
                      {isRTL ? prop.labelAr : prop.labelEn} - {isRTL ? report.labelAr : report.labelEn}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-ink-900 mb-4">
              {editingEntry
                ? isRTL
                  ? 'تعديل السعر'
                  : 'Edit Pricing'
                : isRTL
                ? 'إضافة سعر جديد'
                : 'Add New Pricing'}
            </h2>

            <div className="space-y-4">
              {/* Property Type */}
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">
                  {isRTL ? 'نوع العقار' : 'Property Type'}
                </label>
                <select
                  value={formData.property_type}
                  onChange={(e) => setFormData({ ...formData, property_type: e.target.value })}
                  className="w-full px-3 py-2 border border-cream-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  disabled={!!editingEntry}
                >
                  {PROPERTY_TYPES.map((prop) => (
                    <option key={prop.value} value={prop.value}>
                      {isRTL ? prop.labelAr : prop.labelEn}
                    </option>
                  ))}
                </select>
              </div>

              {/* Report Kind */}
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">
                  {isRTL ? 'نوع التقرير' : 'Report Kind'}
                </label>
                <select
                  value={formData.report_kind}
                  onChange={(e) => setFormData({ ...formData, report_kind: e.target.value })}
                  className="w-full px-3 py-2 border border-cream-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  disabled={!!editingEntry}
                >
                  {REPORT_KINDS.map((report) => (
                    <option key={report.value} value={report.value}>
                      {isRTL ? report.labelAr : report.labelEn}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-ink-400 mt-1">
                  {REPORT_KINDS.find((r) => r.value === formData.report_kind)?.[isRTL ? 'descAr' : 'descEn']}
                </p>
              </div>

              {/* Duplicate Warning */}
              {!editingEntry && combinationExists(formData.property_type, formData.report_kind) && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    {isRTL
                      ? 'هذا السعر موجود بالفعل. يمكنك تعديله من القائمة.'
                      : 'This pricing already exists. You can edit it from the list.'}
                  </p>
                </div>
              )}

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">
                  {isRTL ? 'السعر (جنيه مصري)' : 'Price (EGP)'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
                    {isRTL ? 'ج.م' : 'EGP'}
                  </span>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="2000"
                    min="0"
                    step="100"
                    className="w-full pl-14 pr-4 py-2 border border-cream-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <p className="text-xs text-ink-400 mt-1">
                  {isRTL ? 'هذا هو السعر الأساسي قبل رسوم الاستعجال' : 'This is the base price before urgency fees'}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCloseModal}
                className="flex-1 px-4 py-2 border border-cream-300 text-ink-700 rounded-lg hover:bg-cream-50 transition"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleSave}
                disabled={
                  saving ||
                  !formData.price ||
                  (!editingEntry && combinationExists(formData.property_type, formData.report_kind))
                }
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {isRTL ? 'حفظ' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
