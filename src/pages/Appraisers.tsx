import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Badge, Button } from '@/src/components/ui';
import { Link } from 'react-router-dom';
import { MapPin, ChevronDown, ChevronLeft, ChevronRight, Loader2, Users } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { MOCK_APPRAISERS } from '@/src/lib/mock/appraisers';

interface Appraiser {
  id: string;
  full_name_en: string;
  full_name_ar: string | null;
  professional_title_en: string | null;
  professional_title_ar: string | null;
  years_experience: number | null;
  photo_url: string | null;
  fra_license_number: string | null;
  starting_price_egp: number | null;
  averageRating: number;
  reviewCount: number;
  appraiser_service_areas: Array<{
    district_id: string;
    districts: {
      name_en: string;
      name_ar: string;
      cities: {
        name_en: string;
        name_ar: string;
        governorate_id: string;
        governorates: { name_en: string; name_ar: string };
      };
    };
  }>;
  appraiser_specialties: Array<{
    property_type_id: string;
    years_experience: number;
    property_types: { name_en: string; name_ar: string };
  }>;
}

interface Governorate {
  id: string;
  name_en: string;
  name_ar: string;
}

interface PropertyType {
  id: string;
  name_en: string;
  name_ar: string;
}

export const AppraisersPage = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const [appraisers, setAppraisers] = React.useState<Appraiser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  // Filters
  const [governorates, setGovernorates] = React.useState<Governorate[]>([]);
  const [propertyTypes, setPropertyTypes] = React.useState<PropertyType[]>([]);
  const [selectedGovernorate, setSelectedGovernorate] = React.useState<string>('');
  const [selectedPropertyType, setSelectedPropertyType] = React.useState<string>('');
  const [minExperience, setMinExperience] = React.useState<string>('');
  const [sortBy, setSortBy] = React.useState<string>('rating');
  const [useMockData, setUseMockData] = React.useState(false);

  // Load filter options
  React.useEffect(() => {
    const loadFilters = async () => {
      try {
        const [govRes, typeRes] = await Promise.all([
          fetch('/api/gazetteer/governorates'),
          fetch('/api/gazetteer/property-types'),
        ]);

        if (govRes.ok) {
          const govData = await govRes.json();
          setGovernorates(govData.governorates || []);
        }
        if (typeRes.ok) {
          const typeData = await typeRes.json();
          // property-types returns array directly
          setPropertyTypes(Array.isArray(typeData) ? typeData : []);
        }
      } catch (err) {
        console.error('Error loading filters:', err);
      }
    };

    loadFilters();
  }, []);

  // Load appraisers
  React.useEffect(() => {
    const loadAppraisers = async () => {
      setLoading(true);

      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '12',
          sortBy,
        });

        if (selectedGovernorate) params.set('governorateId', selectedGovernorate);
        if (selectedPropertyType) params.set('propertyTypeId', selectedPropertyType);
        if (minExperience) params.set('minExperience', minExperience);

        const res = await fetch(`/api/appraisers?${params}`);

        if (res.ok) {
          const data = await res.json();
          if (data.appraisers && data.appraisers.length > 0) {
            setAppraisers(data.appraisers);
            setTotal(data.total || 0);
            setTotalPages(data.totalPages || 1);
            setUseMockData(false);
          } else {
            // Fall back to mock data if no real data
            setUseMockData(true);
          }
        } else {
          // Fall back to mock data on error
          setUseMockData(true);
        }
      } catch (err) {
        console.error('Error loading appraisers:', err);
        setUseMockData(true);
      }

      setLoading(false);
    };

    loadAppraisers();
  }, [page, selectedGovernorate, selectedPropertyType, minExperience, sortBy]);

  // Transform mock data to match real data structure
  const displayAppraisers = useMockData
    ? MOCK_APPRAISERS.map((a) => ({
        id: a.id,
        full_name_en: a.fullNameEn,
        full_name_ar: a.fullNameAr,
        professional_title_en: a.titleEn,
        professional_title_ar: a.titleAr,
        years_experience: a.yearsExperience,
        photo_url: a.photoUrl,
        fra_license_number: a.fraLicenseNumber,
        starting_price_egp: a.startingPriceEgp,
        averageRating: a.averageRating,
        reviewCount: a.reviewCount,
        appraiser_service_areas: a.serviceDistrictsEn.map((d, i) => ({
          district_id: `mock-${i}`,
          districts: {
            name_en: d,
            name_ar: a.serviceDistrictsAr[i] || d,
            cities: {
              name_en: a.primaryGovernorateEn,
              name_ar: a.primaryGovernorateAr,
              governorate_id: 'mock',
              governorates: {
                name_en: a.primaryGovernorateEn,
                name_ar: a.primaryGovernorateAr,
              },
            },
          },
        })),
        appraiser_specialties: a.specialties.map((s, i) => ({
          property_type_id: `mock-${i}`,
          years_experience: s.yearsExperience,
          property_types: {
            name_en: s.propertyTypeEn,
            name_ar: s.propertyTypeAr,
          },
        })),
      }))
    : appraisers;

  return (
    <div className="pt-32 pb-24 px-5 md:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-h2 text-ink-600 mb-4">{t('directory.title')}</h1>
          <p className="text-body-l text-ink-300 max-w-2xl">{t('directory.subheadline')}</p>
        </div>

        {/* Filter Bar - Sticky */}
        <div className="sticky top-16 z-40 bg-cream-100 py-4 border-y border-ink-100 mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <FilterDropdown
              label={t('directory.filters.governorate')}
              value={selectedGovernorate}
              onChange={setSelectedGovernorate}
              options={[
                { value: '', label: isAr ? 'الكل' : 'All' },
                ...governorates.map((g) => ({
                  value: g.id,
                  label: isAr ? g.name_ar : g.name_en,
                })),
              ]}
            />
            <FilterDropdown
              label={t('directory.filters.propertyType')}
              value={selectedPropertyType}
              onChange={setSelectedPropertyType}
              options={[
                { value: '', label: isAr ? 'الكل' : 'All' },
                ...propertyTypes.map((p) => ({
                  value: p.id,
                  label: isAr ? p.name_ar : p.name_en,
                })),
              ]}
            />
            <FilterDropdown
              label={t('directory.filters.experience')}
              value={minExperience}
              onChange={setMinExperience}
              options={[
                { value: '', label: isAr ? 'الكل' : 'All' },
                { value: '5', label: '5+ years' },
                { value: '10', label: '10+ years' },
                { value: '15', label: '15+ years' },
              ]}
            />
            <FilterDropdown
              label={t('directory.filters.sortBy')}
              value={sortBy}
              onChange={setSortBy}
              options={[
                { value: 'rating', label: isAr ? 'التقييم' : 'Rating' },
                { value: 'experience', label: isAr ? 'الخبرة' : 'Experience' },
                { value: 'price', label: isAr ? 'السعر' : 'Price' },
              ]}
            />
          </div>
          <div className="text-[13px] text-ink-300 italic">
            {t('directory.showing', { count: useMockData ? MOCK_APPRAISERS.length : total })}
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        ) : displayAppraisers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-ink-400">
            <Users className="h-12 w-12 mb-4 text-ink-200" />
            <p className="text-body-m">No appraisers found</p>
          </div>
        ) : (
          <>
            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {displayAppraisers.map((appraiser) => (
                <AppraiserCard key={appraiser.id} appraiser={appraiser} isAr={isAr} />
              ))}
            </div>

            {/* Pagination */}
            {!useMockData && totalPages > 1 && (
              <div className="mt-20 pt-8 border-t border-ink-100 flex items-center justify-between">
                <div className="text-body-s text-ink-200">
                  Page {page} of {totalPages}
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className={cn(
                      'p-2 border border-ink-100 rounded-sm transition-colors',
                      page === 1 ? 'text-ink-100 opacity-50' : 'text-ink-400 hover:border-emerald-500 hover:text-emerald-500'
                    )}
                  >
                    <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className={cn(
                      'p-2 border border-ink-100 rounded-sm transition-colors',
                      page === totalPages ? 'text-ink-100 opacity-50' : 'text-ink-400 hover:border-emerald-500 hover:text-emerald-500'
                    )}
                  >
                    <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const FilterDropdown = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) => (
  <div className="relative">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="appearance-none bg-transparent text-[13px] font-medium text-ink-400 hover:text-ink-600 transition-colors pr-6 cursor-pointer focus:outline-none"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {label}: {opt.label}
        </option>
      ))}
    </select>
    <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-200 pointer-events-none" />
  </div>
);

interface AppraiserCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  appraiser: Appraiser;
  isAr: boolean;
}

const AppraiserCard = ({ appraiser, isAr, ...props }: AppraiserCardProps) => {
  const name = isAr ? (appraiser.full_name_ar || appraiser.full_name_en) : appraiser.full_name_en;
  const primaryArea = appraiser.appraiser_service_areas?.[0];
  const gov = primaryArea
    ? (isAr
        ? primaryArea.districts?.cities?.governorates?.name_ar
        : primaryArea.districts?.cities?.governorates?.name_en)
    : '';

  return (
    <Link to={`/appraisers/${appraiser.id}`} className="group h-full">
      <Card className="h-full flex flex-col group-hover:border-ink-200 transition-all">
        <div className="aspect-square bg-ink-50 rounded-sm mb-6 overflow-hidden grayscale group-hover:grayscale-0 transition-all duration-500">
          {appraiser.photo_url ? (
            <img
              src={appraiser.photo_url}
              alt={name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-ink-200">
              <Users className="h-16 w-16" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-start mb-2">
            <h4 className="text-eyebrow text-emerald-500">{appraiser.fra_license_number || 'FRA Licensed'}</h4>
            <span className="text-body-s text-ink-200">{appraiser.years_experience || 0} yrs exp.</span>
          </div>
          <h3 className="text-xl mb-2 font-serif group-hover:text-emerald-500 transition-colors">{name}</h3>
          {gov && (
            <p className="text-body-s text-ink-300 mb-6 flex items-center gap-1.5">
              <MapPin className="h-3 w-3" />
              {gov}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-4 border-t border-ink-50">
            {appraiser.appraiser_specialties?.slice(0, 2).map((s, idx) => (
              <Badge key={idx}>
                {isAr ? s.property_types?.name_ar : s.property_types?.name_en}
              </Badge>
            ))}
          </div>
        </div>
      </Card>
    </Link>
  );
};

export default AppraisersPage;
