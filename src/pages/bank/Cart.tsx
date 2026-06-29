/**
 * Bank Shopping Cart
 *
 * View cart items, see volume discounts, and checkout.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  ShoppingCart,
  Trash2,
  MapPin,
  Home,
  User,
  Calendar,
  Tag,
  CreditCard,
  Loader2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';

interface CartItem {
  id: string;
  added_at: string;
  listing: {
    id: string;
    property_type: string;
    approximate_area: number | null;
    bedrooms: number | null;
    report_kind: string;
    listing_price_piasters: number;
    listed_at: string;
    governorates: { name_en: string; name_ar: string } | null;
    cities: { name_en: string; name_ar: string } | null;
    districts: { name_en: string; name_ar: string } | null;
    appraiser: { full_name: string } | null;
  };
}

interface CartSummary {
  itemCount: number;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
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

export default function BankCart() {
  const { i18n } = useTranslation();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isRTL = i18n.language === 'ar';

  const [items, setItems] = useState<CartItem[]>([]);
  const [summary, setSummary] = useState<CartSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [removeLoading, setRemoveLoading] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for failed payment status
  const paymentStatus = searchParams.get('status');

  // Load cart
  useEffect(() => {
    const loadCart = async () => {
      if (!session?.access_token) return;

      setLoading(true);
      try {
        const res = await fetch('/api/bank/cart', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setItems(data.items || []);
          setSummary(data.summary || null);
        }
      } catch (err) {
        console.error('Error loading cart:', err);
        setError(isRTL ? 'فشل في تحميل السلة' : 'Failed to load cart');
      } finally {
        setLoading(false);
      }
    };

    loadCart();
  }, [session?.access_token, isRTL]);

  const removeItem = async (listingId: string) => {
    if (!session?.access_token) return;

    setRemoveLoading(listingId);
    try {
      const res = await fetch(`/api/bank/cart/${listingId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        // Reload cart
        const cartRes = await fetch('/api/bank/cart', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (cartRes.ok) {
          const data = await cartRes.json();
          setItems(data.items || []);
          setSummary(data.summary || null);
        }
      }
    } catch (err) {
      console.error('Error removing item:', err);
    } finally {
      setRemoveLoading(null);
    }
  };

  const clearCart = async () => {
    if (!session?.access_token) return;
    if (!confirm(isRTL ? 'هل أنت متأكد من إفراغ السلة؟' : 'Are you sure you want to clear the cart?')) return;

    setLoading(true);
    try {
      const res = await fetch('/api/bank/cart', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        setItems([]);
        setSummary(null);
      }
    } catch (err) {
      console.error('Error clearing cart:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!session?.access_token) return;

    setCheckoutLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/bank/checkout/pay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        // Redirect to Paymob's Unified Checkout
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        }
      } else {
        const data = await res.json();
        setError(data.error || (isRTL ? 'فشل في بدء الدفع' : 'Failed to initiate payment'));
      }
    } catch (err) {
      console.error('Error during checkout:', err);
      setError(isRTL ? 'فشل في بدء الدفع' : 'Failed to initiate payment');
    } finally {
      setCheckoutLoading(false);
    }
  };

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
        <div className="max-w-5xl mx-auto">
          <button
            onClick={() => navigate('/bank/marketplace')}
            className="flex items-center gap-2 text-ink-500 hover:text-ink-700 mb-4"
          >
            {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            {isRTL ? 'العودة للسوق' : 'Back to Marketplace'}
          </button>

          <div className="flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-emerald-600" />
            <h1 className="text-2xl font-bold text-ink-900">
              {isRTL ? 'سلة التسوق' : 'Shopping Cart'}
            </h1>
            {items.length > 0 && (
              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-sm rounded-full">
                {items.length} {isRTL ? 'عنصر' : items.length === 1 ? 'item' : 'items'}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Payment Failed Alert */}
        {paymentStatus === 'failed' && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">
              {isRTL ? 'فشل الدفع. يرجى المحاولة مرة أخرى.' : 'Payment failed. Please try again.'}
            </span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {items.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <ShoppingCart className="w-16 h-16 text-ink-200 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-ink-900 mb-2">
              {isRTL ? 'السلة فارغة' : 'Your cart is empty'}
            </h2>
            <p className="text-ink-500 mb-6">
              {isRTL ? 'تصفح السوق وأضف تقارير للسلة' : 'Browse the marketplace and add reports to your cart'}
            </p>
            <button
              onClick={() => navigate('/bank/marketplace')}
              className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              {isRTL ? 'تصفح السوق' : 'Browse Marketplace'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-ink-900">
                  {isRTL ? 'العناصر' : 'Items'}
                </h2>
                <button
                  onClick={clearCart}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  {isRTL ? 'إفراغ السلة' : 'Clear Cart'}
                </button>
              </div>

              {items.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl shadow-sm border border-cream-200 p-5"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Property Type & Report Kind */}
                      <div className="flex gap-2 mb-2">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                          {isRTL
                            ? PROPERTY_TYPES[item.listing.property_type]?.ar
                            : PROPERTY_TYPES[item.listing.property_type]?.en || item.listing.property_type}
                        </span>
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                          {isRTL
                            ? REPORT_KINDS[item.listing.report_kind]?.ar
                            : REPORT_KINDS[item.listing.report_kind]?.en || item.listing.report_kind}
                        </span>
                      </div>

                      {/* Location */}
                      <div className="flex items-center gap-2 text-ink-600 mb-2">
                        <MapPin className="w-4 h-4 text-ink-400" />
                        <span className="text-sm">
                          {item.listing.governorates &&
                            (isRTL ? item.listing.governorates.name_ar : item.listing.governorates.name_en)}
                          {item.listing.cities &&
                            `, ${isRTL ? item.listing.cities.name_ar : item.listing.cities.name_en}`}
                        </span>
                      </div>

                      {/* Details */}
                      <div className="flex flex-wrap gap-4 text-sm text-ink-500">
                        {item.listing.approximate_area && (
                          <span className="flex items-center gap-1">
                            <Home className="w-4 h-4" />
                            {item.listing.approximate_area} m²
                          </span>
                        )}
                        {item.listing.appraiser && (
                          <span className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            {item.listing.appraiser.full_name}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(item.listing.listed_at)}
                        </span>
                      </div>
                    </div>

                    <div className="text-right ml-4">
                      <p className="text-lg font-bold text-emerald-600">
                        {formatCurrency(item.listing.listing_price_piasters)}
                      </p>
                      <button
                        onClick={() => removeItem(item.listing.id)}
                        disabled={removeLoading === item.listing.id}
                        className="mt-2 flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
                      >
                        {removeLoading === item.listing.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        {isRTL ? 'إزالة' : 'Remove'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-6 sticky top-24">
                <h2 className="text-lg font-semibold text-ink-900 mb-4">
                  {isRTL ? 'ملخص الطلب' : 'Order Summary'}
                </h2>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-ink-600">
                    <span>{isRTL ? 'المجموع الفرعي' : 'Subtotal'}</span>
                    <span>{summary ? formatCurrency(summary.subtotal) : '-'}</span>
                  </div>

                  {summary && summary.discountPercent > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span className="flex items-center gap-1">
                        <Tag className="w-4 h-4" />
                        {isRTL ? `خصم الكمية (${summary.discountPercent}%)` : `Volume Discount (${summary.discountPercent}%)`}
                      </span>
                      <span>-{formatCurrency(summary.discountAmount)}</span>
                    </div>
                  )}

                  <div className="pt-3 border-t border-cream-200">
                    <div className="flex justify-between text-lg font-bold text-ink-900">
                      <span>{isRTL ? 'الإجمالي' : 'Total'}</span>
                      <span>{summary ? formatCurrency(summary.total) : '-'}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={checkoutLoading || !summary}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {checkoutLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CreditCard className="w-5 h-5" />
                  )}
                  {isRTL ? 'إتمام الشراء' : 'Proceed to Checkout'}
                </button>

                <p className="text-xs text-ink-400 text-center mt-4">
                  {isRTL
                    ? 'سيتم الدفع عبر Paymob'
                    : 'Payment processed securely via Paymob'}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
