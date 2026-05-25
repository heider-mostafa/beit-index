/**
 * Bank Data Marketplace
 *
 * Browse and purchase anonymized appraisal reports.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  Search,
  Filter,
  ShoppingCart,
  Plus,
  Check,
  MapPin,
  Home,
  FileText,
  Calendar,
  User,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Tag,
} from 'lucide-react';

interface Listing {
  id: string;
  property_type: string;
  approximate_area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  report_kind: string;
  listing_price_piasters: number;
  listed_at: string;
  is_purchased: boolean;
  governorates: { name_en: string; name_ar: string } | null;
  cities: { name_en: string; name_ar: string } | null;
  districts: { name_en: string; name_ar: string } | null;
  appraiser: { id: string; full_name: string; fra_license_number: string | null } | null;
}

interface VolumeDiscount {
  min_quantity: number;
  discount_percent: number;
}

interface Governorate {
  id: string;
  name_en: string;
  name_ar: string;
}

const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Apartment', labelAr: 'شقة' },
  { value: 'villa', label: 'Villa', labelAr: 'فيلا' },
  { value: 'duplex', label: 'Duplex', labelAr: 'دوبلكس' },
  { value: 'commercial_shop', label: 'Commercial', labelAr: 'تجاري' },
  { value: 'office', label: 'Office', labelAr: 'مكتب' },
  { value: 'building', label: 'Building', labelAr: 'مبنى' },
];

const REPORT_KINDS = [
  { value: 'brief', label: 'Brief', labelAr: 'موجز' },
  { value: 'detailed', label: 'Detailed', labelAr: 'تفصيلي' },
  { value: 'full', label: 'Full', labelAr: 'كامل' },
];

export default function BankMarketplace() {
  const { i18n } = useTranslation();
  const { session } = useAuth();
  const navigate = useNavigate();
  const isRTL = i18n.language === 'ar';

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartLoading, setCartLoading] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);

  // Filters
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [selectedGovernorate, setSelectedGovernorate] = useState('');
  const [selectedPropertyType, setSelectedPropertyType] = useState('');
  const [selectedReportKind, setSelectedReportKind] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Volume discounts
  const [volumeDiscounts, setVolumeDiscounts] = useState<VolumeDiscount[]>([]);

  // Load governorates
  useEffect(() => {
    const loadGovernorates = async () => {
      try {
        const res = await fetch('/api/gazetteer/governorates');
        if (res.ok) {
          const data = await res.json();
          setGovernorates(data.governorates || []);
        }
      } catch (err) {
        console.error('Error loading governorates:', err);
      }
    };
    loadGovernorates();
  }, []);

  // Load listings
  useEffect(() => {
    const loadListings = async () => {
      if (!session?.access_token) return;

      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '12',
        });

        if (selectedGovernorate) params.set('governorateId', selectedGovernorate);
        if (selectedPropertyType) params.set('propertyType', selectedPropertyType);
        if (selectedReportKind) params.set('reportKind', selectedReportKind);

        const res = await fetch(`/api/bank/marketplace?${params}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setListings(data.listings || []);
          setTotalPages(data.pagination?.totalPages || 1);
          setTotal(data.pagination?.total || 0);
          setVolumeDiscounts(data.volumeDiscounts || []);
        }
      } catch (err) {
        console.error('Error loading listings:', err);
      } finally {
        setLoading(false);
      }
    };

    loadListings();
  }, [session?.access_token, page, selectedGovernorate, selectedPropertyType, selectedReportKind]);

  // Load cart count
  useEffect(() => {
    const loadCartCount = async () => {
      if (!session?.access_token) return;

      try {
        const res = await fetch('/api/bank/cart', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setCartCount(data.items?.length || 0);
        }
      } catch (err) {
        console.error('Error loading cart:', err);
      }
    };

    loadCartCount();
  }, [session?.access_token]);

  const addToCart = async (listingId: string) => {
    if (!session?.access_token) return;

    setCartLoading(listingId);
    try {
      const res = await fetch('/api/bank/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ listingId }),
      });

      if (res.ok) {
        setCartCount((prev) => prev + 1);
        // Update listing state
        setListings((prev) =>
          prev.map((l) => (l.id === listingId ? { ...l, in_cart: true } : l))
        );
      }
    } catch (err) {
      console.error('Error adding to cart:', err);
    } finally {
      setCartLoading(null);
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

  const getPropertyTypeLabel = (type: string) => {
    const pt = PROPERTY_TYPES.find((p) => p.value === type);
    return isRTL ? pt?.labelAr : pt?.label || type;
  };

  const getReportKindLabel = (kind: string) => {
    const rk = REPORT_KINDS.find((r) => r.value === kind);
    return isRTL ? rk?.labelAr : rk?.label || kind;
  };

  return (
    <div className={`min-h-screen bg-cream-100 pt-16 ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Header */}
      <header className="bg-white border-b border-cream-200 px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-ink-900">
                {isRTL ? 'سوق التقارير' : 'Report Marketplace'}
              </h1>
              <p className="text-ink-500 mt-1">
                {isRTL
                  ? `${total} تقرير متاح للشراء`
                  : `${total} reports available for purchase`}
              </p>
            </div>
            <button
              onClick={() => navigate('/bank/cart')}
              className="relative flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
            >
              <ShoppingCart className="w-5 h-5" />
              {isRTL ? 'السلة' : 'Cart'}
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>

          {/* Volume Discount Banner */}
          {volumeDiscounts.length > 0 && (
            <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="flex items-center gap-2 text-emerald-700">
                <Tag className="w-5 h-5" />
                <span className="font-medium">
                  {isRTL ? 'خصومات الكمية:' : 'Volume Discounts:'}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 mt-2">
                {volumeDiscounts.map((d) => (
                  <span key={d.min_quantity} className="text-sm text-emerald-600">
                    {d.min_quantity}+ {isRTL ? 'تقرير' : 'reports'}: {d.discount_percent}% {isRTL ? 'خصم' : 'off'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Filters */}
      <div className="bg-white border-b border-cream-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 border border-cream-300 rounded-lg hover:bg-cream-50"
            >
              <Filter className="w-4 h-4" />
              {isRTL ? 'فلاتر' : 'Filters'}
            </button>

            <select
              value={selectedGovernorate}
              onChange={(e) => { setSelectedGovernorate(e.target.value); setPage(1); }}
              className="px-4 py-2 border border-cream-300 rounded-lg bg-white"
            >
              <option value="">{isRTL ? 'كل المحافظات' : 'All Governorates'}</option>
              {governorates.map((g) => (
                <option key={g.id} value={g.id}>
                  {isRTL ? g.name_ar : g.name_en}
                </option>
              ))}
            </select>

            <select
              value={selectedPropertyType}
              onChange={(e) => { setSelectedPropertyType(e.target.value); setPage(1); }}
              className="px-4 py-2 border border-cream-300 rounded-lg bg-white"
            >
              <option value="">{isRTL ? 'كل الأنواع' : 'All Property Types'}</option>
              {PROPERTY_TYPES.map((pt) => (
                <option key={pt.value} value={pt.value}>
                  {isRTL ? pt.labelAr : pt.label}
                </option>
              ))}
            </select>

            <select
              value={selectedReportKind}
              onChange={(e) => { setSelectedReportKind(e.target.value); setPage(1); }}
              className="px-4 py-2 border border-cream-300 rounded-lg bg-white"
            >
              <option value="">{isRTL ? 'كل التقارير' : 'All Report Types'}</option>
              {REPORT_KINDS.map((rk) => (
                <option key={rk.value} value={rk.value}>
                  {isRTL ? rk.labelAr : rk.label}
                </option>
              ))}
            </select>

            {(selectedGovernorate || selectedPropertyType || selectedReportKind) && (
              <button
                onClick={() => {
                  setSelectedGovernorate('');
                  setSelectedPropertyType('');
                  setSelectedReportKind('');
                  setPage(1);
                }}
                className="text-sm text-red-600 hover:text-red-700"
              >
                {isRTL ? 'مسح الفلاتر' : 'Clear Filters'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-16 h-16 text-ink-200 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-ink-900 mb-2">
              {isRTL ? 'لا توجد تقارير متاحة' : 'No Reports Available'}
            </h3>
            <p className="text-ink-500">
              {isRTL ? 'جرب تغيير الفلاتر' : 'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          <>
            {/* Listings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map((listing) => (
                <div
                  key={listing.id}
                  className="bg-white rounded-xl shadow-sm border border-cream-200 overflow-hidden hover:shadow-md transition"
                >
                  <div className="p-5">
                    {/* Property Type Badge */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                        {getPropertyTypeLabel(listing.property_type)}
                      </span>
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                        {getReportKindLabel(listing.report_kind)}
                      </span>
                    </div>

                    {/* Location */}
                    <div className="flex items-center gap-2 text-ink-600 mb-2">
                      <MapPin className="w-4 h-4 text-ink-400" />
                      <span className="text-sm">
                        {listing.governorates && (isRTL ? listing.governorates.name_ar : listing.governorates.name_en)}
                        {listing.cities && `, ${isRTL ? listing.cities.name_ar : listing.cities.name_en}`}
                      </span>
                    </div>

                    {/* Property Details */}
                    <div className="flex flex-wrap gap-3 text-sm text-ink-500 mb-3">
                      {listing.approximate_area && (
                        <span className="flex items-center gap-1">
                          <Home className="w-4 h-4" />
                          {listing.approximate_area} m²
                        </span>
                      )}
                      {listing.bedrooms && (
                        <span>{listing.bedrooms} {isRTL ? 'غرف' : 'BR'}</span>
                      )}
                    </div>

                    {/* Appraiser */}
                    {listing.appraiser && (
                      <div className="flex items-center gap-2 text-sm text-ink-500 mb-3">
                        <User className="w-4 h-4" />
                        <span>{listing.appraiser.full_name}</span>
                      </div>
                    )}

                    {/* Date */}
                    <div className="flex items-center gap-2 text-sm text-ink-400 mb-4">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(listing.listed_at)}</span>
                    </div>

                    {/* Price & Action */}
                    <div className="flex items-center justify-between pt-4 border-t border-cream-100">
                      <span className="text-lg font-bold text-emerald-600">
                        {formatCurrency(listing.listing_price_piasters)}
                      </span>

                      {listing.is_purchased ? (
                        <button
                          onClick={() => navigate(`/bank/reports/${listing.id}`)}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg"
                        >
                          <Check className="w-4 h-4" />
                          {isRTL ? 'عرض التقرير' : 'View Report'}
                        </button>
                      ) : (
                        <button
                          onClick={() => addToCart(listing.id)}
                          disabled={cartLoading === listing.id}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {cartLoading === listing.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                          {isRTL ? 'أضف للسلة' : 'Add to Cart'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-8">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-2 px-4 py-2 border border-cream-300 rounded-lg disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {isRTL ? 'السابق' : 'Previous'}
                </button>
                <span className="text-ink-600">
                  {isRTL ? `${page} من ${totalPages}` : `Page ${page} of ${totalPages}`}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-2 px-4 py-2 border border-cream-300 rounded-lg disabled:opacity-50"
                >
                  {isRTL ? 'التالي' : 'Next'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
