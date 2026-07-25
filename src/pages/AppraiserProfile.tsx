import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Button, Card, Badge } from '@/src/components/ui';
import {
  MapPin,
  ShieldCheck,
  Calendar,
  Clock,
  CircleDollarSign,
  Star,
  ChevronLeft,
  ShieldAlert,
  Loader2,
  Users,
  Info,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useAuth } from '@/src/contexts/AuthContext';

interface AppraiserData {
  id: string;
  full_name_en: string;
  full_name_ar: string | null;
  professional_title_en: string | null;
  professional_title_ar: string | null;
  years_experience: number | null;
  photo_url: string | null;
  fra_license_number: string | null;
  cbe_registration_number: string | null;
  cbe_issue_date: string | null;
  cbe_expiry_date: string | null;
  syndicate_name: string | null;
  syndicate_membership_number: string | null;
  bio_en: string | null;
  bio_ar: string | null;
  starting_price_egp: number | null;
  typical_turnaround_days: number | null;
  availability: 'this_week' | 'next_week' | 'two_weeks' | null;
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
        governorates: { name_en: string; name_ar: string };
      };
    };
  }>;
  appraiser_specialties: Array<{
    property_type_id: string;
    years_experience: number;
    property_types: { name_en: string; name_ar: string };
  }>;
  reviews: Array<{
    id: string;
    rating: number;
    comment: string | null;
    reviewer_first_name: string | null;
    reviewer_last_initial: string | null;
    created_at: string;
  }>;
}

export const AppraiserProfilePage = () => {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { profile: userProfile } = useAuth();
  const isAr = i18n.language === 'ar';

  const [appraiser, setAppraiser] = React.useState<AppraiserData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState('about');

  // Load appraiser data
  React.useEffect(() => {
    const loadAppraiser = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/appraisers/${id}`);

        if (res.ok) {
          const data = await res.json();
          setAppraiser(data);
        } else if (res.status === 404) {
          setError('Appraiser not found');
        } else {
          setError('Failed to load appraiser profile');
        }
      } catch (err) {
        console.error('Error loading appraiser:', err);
        setError('Network error. Please check your connection.');
      }

      setLoading(false);
    };

    loadAppraiser();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-32 px-5 text-center">
        <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
        <h2 className="text-h3 text-ink-600 mb-2">{error}</h2>
        <p className="text-ink-400 mb-6">
          {t('common.tryAgainLater', 'Please try again later or contact support.')}
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            {t('common.goBack', 'Go Back')}
          </Button>
          <Button onClick={() => window.location.reload()}>
            {t('common.tryAgain', 'Try Again')}
          </Button>
        </div>
      </div>
    );
  }

  if (!appraiser) {
    return (
      <div className="pt-32 px-5 text-center">
        <Users className="h-16 w-16 text-ink-200 mx-auto mb-4" />
        <h2 className="text-h3 text-ink-600 mb-4">{t('appraiser.notFound', 'Appraiser not found')}</h2>
        <Link to="/appraisers" className="text-emerald-500 hover:underline">
          {t('appraiser.backToDirectory', 'Back to directory')}
        </Link>
      </div>
    );
  }

  const name = isAr ? (appraiser.full_name_ar || appraiser.full_name_en) : appraiser.full_name_en;
  const title = isAr ? (appraiser.professional_title_ar || appraiser.professional_title_en) : appraiser.professional_title_en;
  const primaryArea = appraiser.appraiser_service_areas?.[0];
  const gov = primaryArea
    ? (isAr ? primaryArea.districts?.cities?.governorates?.name_ar : primaryArea.districts?.cities?.governorates?.name_en)
    : '';
  const bio = isAr ? (appraiser.bio_ar || appraiser.bio_en) : appraiser.bio_en;

  const tabs = [
    { id: 'about', label: t('profile.tabs.about') },
    { id: 'specialties', label: t('profile.tabs.specialties') },
    { id: 'areas', label: t('profile.tabs.areas') },
    { id: 'work', label: t('profile.tabs.work') },
    { id: 'reviews', label: t('profile.tabs.reviews') },
  ];

  const availabilityText: Record<string, string> = {
    this_week: isAr ? 'هذا الأسبوع' : 'this week',
    next_week: isAr ? 'الأسبوع القادم' : 'next week',
    two_weeks: isAr ? 'بعد أسبوعين' : 'in 2 weeks',
  };

  const handleRequestAppraisal = () => {
    if (!userProfile) {
      navigate('/login');
    } else {
      // Navigate to request page with appraiser pre-selected
      navigate(`/marketplace/request?appraiserId=${id}`);
    }
  };

  return (
    <div className="pt-32 pb-24 px-5 md:px-8">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-body-s text-ink-300 hover:text-ink-600 mb-8 transition-colors"
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          {isAr ? 'العودة للملفات' : 'Back to results'}
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 items-start">
          {/* Left Column */}
          <div className="lg:col-span-2">
            <div className="flex flex-col md:flex-row gap-8 mb-12">
              <div className="w-40 h-40 shrink-0 bg-ink-50 rounded-sm overflow-hidden">
                {appraiser.photo_url ? (
                  <img src={appraiser.photo_url} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Users className="h-16 w-16 text-ink-200" />
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-h2 text-ink-600 mb-2">{name}</h1>
                <p className="text-body-l text-ink-300 mb-6">{title}</p>

                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-sm text-xs font-medium">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {t('hero.stats.fra')}
                  </div>
                  <div className="flex items-center gap-1.5 bg-ink-50 text-ink-400 px-3 py-1 rounded-sm text-xs font-medium">
                    {appraiser.years_experience} {isAr ? 'سنة خبرة' : 'years exp.'}
                  </div>
                  {gov && (
                    <div className="flex items-center gap-1.5 bg-ink-50 text-ink-400 px-3 py-1 rounded-sm text-xs font-medium">
                      <MapPin className="h-3.5 w-3.5" />
                      {gov}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-ink-100 flex gap-8 mb-8 overflow-x-auto no-scrollbar">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "pb-4 text-[13px] font-medium transition-all relative whitespace-nowrap",
                    activeTab === tab.id ? "text-ink-600" : "text-ink-300 hover:text-ink-400"
                  )}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 inset-x-0 h-[2px] bg-emerald-500" />
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="min-h-[300px]">
              {activeTab === 'about' && (
                <div className="max-w-xl space-y-6">
                  <p className="text-body-m text-ink-400 leading-relaxed whitespace-pre-wrap">
                    {bio || 'No biography provided.'}
                  </p>
                </div>
              )}

              {activeTab === 'specialties' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {appraiser.appraiser_specialties?.length > 0 ? (
                    appraiser.appraiser_specialties.map((s, i) => (
                      <div key={i} className="p-4 border-[0.5px] border-ink-100 rounded-sm">
                        <h5 className="text-[13px] font-medium text-ink-500 mb-1">
                          {isAr ? s.property_types?.name_ar : s.property_types?.name_en}
                        </h5>
                        <p className="text-[11px] text-ink-300 uppercase tracking-wider">
                          {s.years_experience} {isAr ? 'سنة خبرة تخصصية' : 'years specialty exp.'}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-body-s text-ink-300">No specialties listed.</p>
                  )}
                </div>
              )}

              {activeTab === 'areas' && (
                <div className="space-y-4">
                  {gov && (
                    <div className="flex items-center gap-4 p-4 border-[0.5px] border-emerald-100 bg-emerald-50/30 rounded-sm">
                      <MapPin className="h-4 w-4 text-emerald-500" />
                      <span className="text-body-m font-medium text-emerald-700">{gov}</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3">
                    {appraiser.appraiser_service_areas?.map((area, i) => (
                      <div key={i} className="px-4 py-2 border-[0.5px] border-ink-100 rounded-sm text-body-s text-ink-500">
                        {isAr ? area.districts?.name_ar : area.districts?.name_en}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'work' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-sm border-[0.5px] border-amber-100">
                    <ShieldAlert className="h-4 w-4 text-amber-600" />
                    <p className="text-[12px] text-amber-700 font-medium">{t('profile.anonymized')}</p>
                  </div>

                  <div className="flex flex-col items-center justify-center py-12 text-ink-300">
                    <Info className="h-8 w-8 mb-3 text-ink-200" />
                    <p className="text-body-s">Sample work coming soon</p>
                    <p className="text-[12px] text-ink-200 mt-1">
                      Detailed sample reports available upon direct inquiry for institutional clients.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'reviews' && (
                <div className="space-y-8">
                  <div className="flex items-center gap-6 mb-8">
                    <div className="flex items-baseline gap-1">
                      <span className="text-h3">{appraiser.averageRating.toFixed(1)}</span>
                      <span className="text-body-s text-ink-200">/ 5.0</span>
                    </div>
                    <div className="flex text-gold">
                      {[1,2,3,4,5].map(i => (
                        <Star
                          key={i}
                          className={cn(
                            "h-4 w-4",
                            i <= Math.floor(appraiser.averageRating) ? "fill-current" : "opacity-20"
                          )}
                        />
                      ))}
                    </div>
                    <span className="text-body-s text-ink-300">
                      ({appraiser.reviewCount} total reviews)
                    </span>
                  </div>

                  {appraiser.reviews?.length > 0 ? (
                    <div className="space-y-8 divide-y divide-ink-50">
                      {appraiser.reviews.map((r, i) => (
                        <div key={r.id || i} className="pt-8 first:pt-0">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <div className="text-body-m font-medium mb-1">
                                {r.reviewer_first_name} {r.reviewer_last_initial}
                              </div>
                              <div className="text-[11px] text-ink-200 font-mono tracking-tighter">
                                {new Date(r.created_at).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="flex text-gold">
                              {[1,2,3,4,5].map(star => (
                                <Star
                                  key={star}
                                  className={cn(
                                    "h-3 w-3",
                                    star <= r.rating ? "fill-current" : "opacity-20"
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                          {r.comment && (
                            <p className="text-body-m text-ink-400 leading-relaxed italic">
                              "{r.comment}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-ink-300">
                      <Star className="h-8 w-8 mb-3 text-ink-200" />
                      <p className="text-body-s">No reviews yet</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Sticky Engagement Card */}
          <div className="lg:sticky lg:top-32 h-fit">
            <Card className="bg-white p-8">
              <div className="space-y-6 mb-10">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-ink-200 mb-0.5">
                      {t('profile.card.turnaround')}
                    </p>
                    <p className="text-body-m font-medium text-ink-600">
                      {appraiser.typical_turnaround_days} {isAr ? 'أيام عمل' : 'business days'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                    <CircleDollarSign className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-ink-200 mb-0.5">
                      {t('profile.card.startingAt')}
                    </p>
                    <p className="text-body-m font-medium text-ink-600">
                      EGP {appraiser.starting_price_egp?.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-ink-200 mb-0.5">
                      {t('profile.card.available')}
                    </p>
                    <p className={cn(
                      "text-body-m font-medium capitalize",
                      appraiser.availability === 'this_week' ? "text-emerald-600" : "text-amber-600"
                    )}>
                      {availabilityText[appraiser.availability || 'this_week']}
                    </p>
                  </div>
                </div>
              </div>

              <Button className="w-full mb-6" withArrow onClick={handleRequestAppraisal}>
                {t('common.requestAppraisal')}
              </Button>

              <p className="text-[12px] leading-relaxed text-ink-200 text-center px-4 mb-8">
                {t('profile.card.disclaimer')}
              </p>

              <div className="pt-6 border-t border-ink-50">
                <button
                  onClick={handleRequestAppraisal}
                  className="w-full text-center text-body-s font-medium text-ink-400 hover:text-ink-600 transition-colors"
                >
                  {t('profile.card.message')}
                </button>
                <p className="text-[10px] text-ink-200 text-center mt-2">
                  {isAr ? 'المراسلة متاحة بعد تقديم طلب التقييم' : 'Messaging available after submitting a request'}
                </p>
              </div>
            </Card>

            <div className="mt-8 p-6 border-[0.5px] border-ink-100 rounded-md bg-cream-50/50">
              <h5 className="text-[11px] uppercase tracking-wider text-ink-300 mb-3">Credentials</h5>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <ShieldCheck className="h-4 w-4 text-emerald-700" />
                  </div>
                  <p className="text-[12px] text-ink-500 leading-tight">
                    FRA-Verified License<br/>
                    <span className="text-ink-200 font-mono text-[10px] uppercase">
                      {appraiser.fra_license_number || 'Validated'}
                    </span>
                  </p>
                </div>

                {appraiser.cbe_registration_number && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center">
                      <ShieldCheck className="h-4 w-4 text-sky-700" />
                    </div>
                    <p className="text-[12px] text-ink-500 leading-tight">
                      CBE Accredited Valuator<br/>
                      <span className="text-ink-200 font-mono text-[10px] uppercase">
                        {appraiser.cbe_registration_number}
                      </span>
                    </p>
                  </div>
                )}

                {appraiser.syndicate_name && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                      <ShieldCheck className="h-4 w-4 text-amber-700" />
                    </div>
                    <p className="text-[12px] text-ink-500 leading-tight">
                      {appraiser.syndicate_name}<br/>
                      <span className="text-ink-200 font-mono text-[10px] uppercase">
                        {appraiser.syndicate_membership_number || 'Member'}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default AppraiserProfilePage;
