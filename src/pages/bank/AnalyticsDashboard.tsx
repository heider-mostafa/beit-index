/**
 * Bank Analytics Dashboard
 *
 * Revenue product for banks - shows market data, price trends, zone analytics.
 * Reads from valuation_records table (anonymized appraisal data).
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';

interface OverviewData {
  totalRecords: number;
  recentRecords: number;
  medianPricePerSqm: number;
  avgPricePerSqm: number;
  propertyTypeDistribution: Record<string, number>;
  periodStart: string;
  periodEnd: string;
}

interface TrendData {
  month: string;
  count: number;
  median: number;
  avg: number;
  min: number;
  max: number;
  p25: number;
  p75: number;
}

interface ZoneData {
  district: { id: string; name: string; nameAr: string };
  city: { id: string; name: string; nameAr: string };
  governorate: { id: string; name: string; nameAr: string };
  recordCount: number;
  totalValue: number;
  medianPricePerSqm: number;
  avgPricePerSqm: number;
  minPricePerSqm: number;
  maxPricePerSqm: number;
}

interface BankAccount {
  id: string;
  name: string;
  subscription_tier: string;
  queries_this_month: number;
  monthly_query_limit: number;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AnalyticsDashboard() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [zones, setZones] = useState<ZoneData[]>([]);

  // Filters
  const [period, setPeriod] = useState('12m');
  const [propertyType, setPropertyType] = useState<string>('');
  const [governorates, setGovernorates] = useState<Array<{ id: string; name: string; name_ar: string }>>([]);
  const [selectedGovernorate, setSelectedGovernorate] = useState<string>('');

  // Fetch governorates for filter
  useEffect(() => {
    async function fetchGovernorates() {
      try {
        const token = localStorage.getItem('supabase_access_token');
        const res = await fetch('/api/gazetteer/governorates', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setGovernorates(data.governorates || []);
      } catch (err) {
        console.error('Failed to fetch governorates:', err);
      }
    }
    fetchGovernorates();
  }, []);

  // Fetch account info
  useEffect(() => {
    async function fetchAccount() {
      try {
        const token = localStorage.getItem('supabase_access_token');
        const res = await fetch('/api/bank/account', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch account');
        const data = await res.json();
        setAccount(data.account);
      } catch (err) {
        setError((err as Error).message);
      }
    }
    fetchAccount();
  }, []);

  // Fetch analytics data
  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      try {
        const token = localStorage.getItem('supabase_access_token');
        const headers = { Authorization: `Bearer ${token}` };

        // Fetch overview
        const overviewRes = await fetch('/api/analytics/overview', { headers });
        if (!overviewRes.ok) throw new Error('Failed to fetch overview');
        const overviewData = await overviewRes.json();
        setOverview(overviewData);

        // Fetch trends
        const params = new URLSearchParams({ period });
        if (propertyType) params.append('propertyType', propertyType);
        if (selectedGovernorate) params.append('governorateId', selectedGovernorate);

        const trendsRes = await fetch(`/api/analytics/price-trends?${params}`, { headers });
        if (!trendsRes.ok) throw new Error('Failed to fetch trends');
        const trendsData = await trendsRes.json();
        setTrends(trendsData.trends || []);

        // Fetch zone breakdown
        const zoneParams = new URLSearchParams();
        if (propertyType) zoneParams.append('propertyType', propertyType);
        if (selectedGovernorate) zoneParams.append('governorateId', selectedGovernorate);

        const zonesRes = await fetch(`/api/analytics/zone-breakdown?${zoneParams}`, { headers });
        if (!zonesRes.ok) throw new Error('Failed to fetch zones');
        const zonesData = await zonesRes.json();
        setZones(zonesData.zones || []);

        setLoading(false);
      } catch (err) {
        setError((err as Error).message);
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, [period, propertyType, selectedGovernorate]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(isRTL ? 'ar-EG' : 'en-EG', {
      style: 'currency',
      currency: 'EGP',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat(isRTL ? 'ar-EG' : 'en-EG').format(value);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Access Denied</h2>
          <p className="text-ink-600">{error}</p>
          <p className="text-sm text-ink-500 mt-4">
            Please contact support if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-cream-50 ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Header */}
      <header className="bg-white border-b border-cream-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink-900">
              {isRTL ? 'لوحة التحليلات' : 'Analytics Dashboard'}
            </h1>
            {account && (
              <p className="text-sm text-ink-500">
                {account.name} • {account.subscription_tier} tier
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            {/* Period selector */}
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-2 border border-cream-300 rounded-lg text-sm"
            >
              <option value="3m">{isRTL ? '3 أشهر' : '3 months'}</option>
              <option value="6m">{isRTL ? '6 أشهر' : '6 months'}</option>
              <option value="12m">{isRTL ? '12 شهر' : '12 months'}</option>
              <option value="24m">{isRTL ? '24 شهر' : '24 months'}</option>
            </select>

            {/* Property type filter */}
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              className="px-3 py-2 border border-cream-300 rounded-lg text-sm"
            >
              <option value="">{isRTL ? 'كل الأنواع' : 'All types'}</option>
              <option value="apartment">{isRTL ? 'شقة' : 'Apartment'}</option>
              <option value="villa">{isRTL ? 'فيلا' : 'Villa'}</option>
              <option value="duplex">{isRTL ? 'دوبلكس' : 'Duplex'}</option>
              <option value="commercial_shop">{isRTL ? 'تجاري' : 'Commercial'}</option>
              <option value="office">{isRTL ? 'مكتب' : 'Office'}</option>
              <option value="building">{isRTL ? 'مبنى' : 'Building'}</option>
              <option value="compound_unit">{isRTL ? 'وحدة كمبوند' : 'Compound Unit'}</option>
              <option value="roof">{isRTL ? 'روف' : 'Roof'}</option>
            </select>

            {/* Governorate filter */}
            <select
              value={selectedGovernorate}
              onChange={(e) => setSelectedGovernorate(e.target.value)}
              className="px-3 py-2 border border-cream-300 rounded-lg text-sm"
            >
              <option value="">{isRTL ? 'كل المحافظات' : 'All governorates'}</option>
              {governorates.map((gov) => (
                <option key={gov.id} value={gov.id}>
                  {isRTL ? gov.name_ar : gov.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          </div>
        ) : (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <p className="text-sm text-ink-500 mb-1">
                  {isRTL ? 'إجمالي السجلات' : 'Total Records'}
                </p>
                <p className="text-3xl font-bold text-ink-900">
                  {formatNumber(overview?.totalRecords || 0)}
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6">
                <p className="text-sm text-ink-500 mb-1">
                  {isRTL ? 'السجلات الأخيرة (12 شهر)' : 'Recent Records (12mo)'}
                </p>
                <p className="text-3xl font-bold text-ink-900">
                  {formatNumber(overview?.recentRecords || 0)}
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6">
                <p className="text-sm text-ink-500 mb-1">
                  {isRTL ? 'متوسط السعر/م²' : 'Median Price/sqm'}
                </p>
                <p className="text-3xl font-bold text-emerald-600">
                  {formatCurrency(overview?.medianPricePerSqm || 0)}
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6">
                <p className="text-sm text-ink-500 mb-1">
                  {isRTL ? 'المتوسط الحسابي/م²' : 'Avg Price/sqm'}
                </p>
                <p className="text-3xl font-bold text-blue-600">
                  {formatCurrency(overview?.avgPricePerSqm || 0)}
                </p>
              </div>
            </div>

            {/* Price Trends Chart */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
              <h2 className="text-lg font-semibold text-ink-900 mb-4">
                {isRTL ? 'اتجاهات الأسعار' : 'Price Trends'}
              </h2>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => {
                        const [year, month] = value.split('-');
                        return `${month}/${year.slice(2)}`;
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => `Month: ${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="p75"
                      stackId="1"
                      stroke="none"
                      fill="#d1fae5"
                      name="75th percentile"
                    />
                    <Area
                      type="monotone"
                      dataKey="median"
                      stackId="2"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.6}
                      name="Median"
                    />
                    <Area
                      type="monotone"
                      dataKey="p25"
                      stackId="3"
                      stroke="none"
                      fill="#f0fdf4"
                      name="25th percentile"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Property Type Distribution */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-ink-900 mb-4">
                  {isRTL ? 'توزيع أنواع العقارات' : 'Property Type Distribution'}
                </h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(overview?.propertyTypeDistribution || {}).map(
                          ([name, value]) => ({ name, value })
                        )}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} (${(percent * 100).toFixed(0)}%)`
                        }
                      >
                        {Object.keys(overview?.propertyTypeDistribution || {}).map(
                          (_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          )
                        )}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatNumber(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Monthly Volume */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-ink-900 mb-4">
                  {isRTL ? 'حجم التقييمات الشهري' : 'Monthly Valuation Volume'}
                </h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => {
                          const [, month] = value.split('-');
                          return month;
                        }}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: number) => formatNumber(value)}
                        labelFormatter={(label) => `Month: ${label}`}
                      />
                      <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Zone Breakdown Table */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-ink-900 mb-4">
                {isRTL ? 'تحليل المناطق' : 'Zone Analysis'}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-cream-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-ink-500">
                        {isRTL ? 'المنطقة' : 'District'}
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-ink-500">
                        {isRTL ? 'المدينة' : 'City'}
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-ink-500">
                        {isRTL ? 'السجلات' : 'Records'}
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-ink-500">
                        {isRTL ? 'المتوسط/م²' : 'Median/sqm'}
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-ink-500">
                        {isRTL ? 'النطاق' : 'Range'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {zones.slice(0, 15).map((zone, index) => (
                      <tr
                        key={zone.district.id}
                        className={index % 2 === 0 ? 'bg-cream-50' : ''}
                      >
                        <td className="py-3 px-4">
                          <span className="font-medium text-ink-900">
                            {isRTL ? zone.district.nameAr : zone.district.name}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-ink-600">
                          {isRTL ? zone.city.nameAr : zone.city.name}
                        </td>
                        <td className="py-3 px-4 text-right text-ink-900">
                          {formatNumber(zone.recordCount)}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-emerald-600">
                          {formatCurrency(zone.medianPricePerSqm)}
                        </td>
                        <td className="py-3 px-4 text-right text-sm text-ink-500">
                          {formatCurrency(zone.minPricePerSqm)} -{' '}
                          {formatCurrency(zone.maxPricePerSqm)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {zones.length > 15 && (
                <p className="text-sm text-ink-500 mt-4 text-center">
                  {isRTL
                    ? `عرض 15 من ${zones.length} منطقة`
                    : `Showing 15 of ${zones.length} districts`}
                </p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
