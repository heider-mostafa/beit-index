import * as React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/src/components/ui';
import { useAuth } from '@/src/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/src/lib/supabase/browser';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Fetch a current (auto-refreshed) access token — used to recover from a 401
// when the token has expired mid-editing.
async function getFreshAccessToken(): Promise<string | null> {
  try {
    const { data } = await getSupabaseBrowserClient().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}
import {
  ArrowLeft,
  Save,
  CheckCircle,
  AlertCircle,
  FileDown,
  Building2,
  Users,
  LineChart,
  Calculator,
  Scale,
  DollarSign,
  TrendingUp,
  Image,
  FileCheck,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  X,
  Upload,
  Camera,
} from 'lucide-react';
import { evaluatePartial, formatEGP } from '@/src/lib/appraisal/engine';

// Section IDs for navigation
const SECTION_IDS = [
  'identification',
  'physical',
  'market',
  'cost',
  'sales',
  'income',
  'grm',
  'reconciliation',
  'photos',
  'declarations',
] as const;

const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  identification: Building2,
  physical: Building2,
  market: LineChart,
  cost: Calculator,
  sales: Scale,
  income: DollarSign,
  grm: TrendingUp,
  reconciliation: CheckCircle,
  photos: Image,
  declarations: FileCheck,
};

type SectionId = typeof SECTION_IDS[number];

interface Report {
  id: string;
  version: number;
  status: 'draft' | 'submitted' | 'finalized' | 'archived';
  template_id: string;
  property_id: string;
  // Identification
  project_name: string | null;
  report_kind: string;
  tenancy: string;
  client_name: string | null;
  owner_name: string | null;
  appraisal_date: string | null;
  valid_until: string | null;
  // Physical
  project_land_area: number | null;
  unit_gross_area: number | null;
  unit_net_area: number | null;
  unit_land_share: number | null;
  current_age: number | null;
  economic_life: number;
  effective_age: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  total_rooms: number | null;
  finishing_level: string | null;
  has_pool: boolean;
  orientation: string | null;
  // Market Study
  market_bldg_halffinish_low: number | null;
  market_bldg_halffinish_high: number | null;
  market_bldg_fullfinish_low: number | null;
  market_bldg_fullfinish_high: number | null;
  market_land_low: number | null;
  market_land_high: number | null;
  market_notes: string | null;
  // Cost Approach
  cost_land_price_per_sqm: number | null;
  cost_allowed_floors: number | null;
  cost_current_floors: number | null;
  cost_construction_per_sqm: number | null;
  cost_unit_area_to_value: number | null;
  cost_repairable_depreciation: number | null;
  cost_garden_value: number | null;
  cost_garage_value: number | null;
  cost_storage_value: number | null;
  cost_total: number | null;
  // Sales Comparison
  sales_subject_building_area: number | null;
  sales_subject_land_area: number | null;
  sales_final_value: number | null;
  sales_narrative: string | null;
  // Income Approach
  income_monthly_rent: number | null;
  income_vacancy_rate: number | null;
  income_remaining_life: number | null;
  income_interest_rate: number | null;
  income_total: number | null;
  // GRM
  grm_monthly_rent: number | null;
  grm_multiplier: number | null;
  grm_vacancy_amount: number | null;
  grm_total: number | null;
  // Reconciliation
  chosen_method: string | null;
  reconciliation_rationale: string | null;
  final_value: number | null;
  land_value: number | null;
  building_value: number | null;
  monthly_rent_reconciled: number | null;
  // Relations
  property: {
    id: string;
    property_type: string;
    address_description: string;
    governorate_id: string | null;
    city_id: string | null;
    district_id: string | null;
    building_number: string | null;
    unit_number: string | null;
    floor: string | null;
    governorate?: { name_en: string; name_ar: string } | null;
    city?: { name_en: string; name_ar: string } | null;
    district?: { name_en: string; name_ar: string } | null;
  };
  comparables: Array<{
    id: string;
    ord: number;
    address: string;
    source: string;
    proximity: string | null;
    floor: string | null;
    sale_timing: 'current_offer' | 'recent_sale' | 'historical';
    tenancy: 'owner_occupied' | 'vacant' | 'rented';
    age_years: number | null;
    orientation: string | null;
    payment_terms: 'cash' | 'installments' | 'mortgage';
    finishing_level: string | null;
    condition: string | null;
    location_quality: string | null;
    garage_share: number | null;
    building_area_sqm: number;
    land_area_sqm: number;
    has_pool: boolean;
    building_price_per_sqm: number;
    sale_price: number;
    derived_land_value: number | null;
    weight: number;
  }>;
  photos: Array<{
    id: string;
    storage_path: string;
    category: string;
    caption: string | null;
    ord: number;
  }>;
  [key: string]: unknown;
}

// Default comparable form data
interface ComparableFormData {
  id?: string;
  address: string;
  source: string;
  proximity: string;
  floor: string;
  sale_timing: 'current_offer' | 'recent_sale' | 'historical';
  tenancy: 'owner_occupied' | 'vacant' | 'rented';
  age_years: string;
  orientation: string;
  payment_terms: 'cash' | 'installments' | 'mortgage';
  finishing_level: string;
  condition: string;
  location_quality: string;
  garage_share: string;
  building_area_sqm: string;
  land_area_sqm: string;
  has_pool: boolean;
  building_price_per_sqm: string;
  sale_price: string;
  weight: string;
}

const defaultComparableForm: ComparableFormData = {
  address: '',
  source: '',
  proximity: '',
  floor: '',
  sale_timing: 'current_offer',
  tenancy: 'owner_occupied',
  age_years: '',
  orientation: '',
  payment_terms: 'cash',
  finishing_level: '',
  condition: '',
  location_quality: '',
  garage_share: '',
  building_area_sqm: '',
  land_area_sqm: '',
  has_pool: false,
  building_price_per_sqm: '',
  sale_price: '',
  weight: '1',
};

// Photo categories for upload
const PHOTO_CATEGORIES = [
  { value: 'facade', label: 'Facade' },
  { value: 'entrance', label: 'Entrance' },
  { value: 'living_room', label: 'Living Room' },
  { value: 'bedroom', label: 'Bedroom' },
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'balcony', label: 'Balcony' },
  { value: 'garden', label: 'Garden' },
  { value: 'pool', label: 'Pool' },
  { value: 'garage', label: 'Garage' },
  { value: 'roof', label: 'Roof' },
  { value: 'street_view', label: 'Street View' },
  { value: 'location_map', label: 'Location Map' },
  { value: 'other', label: 'Other' },
] as const;

export function ReportEditorPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();

  // State
  const [report, setReport] = React.useState<Report | null>(null);
  // Mirror of `report` that autosave reads from, so a debounced or queued save
  // always sees the latest fields and version — never a stale render closure.
  const reportRef = React.useRef<Report | null>(null);
  React.useEffect(() => {
    reportRef.current = report;
  }, [report]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [activeSection, setActiveSection] = React.useState<SectionId>('identification');
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [lastSaved, setLastSaved] = React.useState<Date | null>(null);

  // Comparable modal state
  const [comparableModalOpen, setComparableModalOpen] = React.useState(false);
  const [editingComparable, setEditingComparable] = React.useState<ComparableFormData>(defaultComparableForm);
  const [comparableSaving, setComparableSaving] = React.useState(false);

  // Photo upload state
  const [uploadingPhoto, setUploadingPhoto] = React.useState(false);
  const [photoCategory, setPhotoCategory] = React.useState<string>('other');
  const [photoCaption, setPhotoCaption] = React.useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  // report-photos is a private bucket, so each photo needs a short-lived signed
  // URL to render. Keyed by storage_path.
  const [photoUrls, setPhotoUrls] = React.useState<Record<string, string>>({});

  // Finalization modal state
  const [finalizeModalOpen, setFinalizeModalOpen] = React.useState(false);
  const [declarations, setDeclarations] = React.useState({
    fraCompliance: false,
    ethicsCompliance: false,
    independenceConfirm: false,
    dataAccuracy: false,
  });
  const [finalizing, setFinalizing] = React.useState(false);

  // Debounced save timer
  const saveTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  // Autosave concurrency control: prevent two PATCHes racing on the version
  // (a save in flight while the debounce fires again would send a stale version
  // and self-conflict with a 409). savingRef serializes; pendingSaveRef coalesces
  // a save requested while one was already running.
  const savingRef = React.useRef(false);
  const pendingSaveRef = React.useRef(false);

  // Fetch report
  React.useEffect(() => {
    const fetchReport = async () => {
      if (!session?.access_token || !id) return;

      try {
        const res = await fetch(`/api/reports/${id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (!res.ok) {
          if (res.status === 404) {
            setError('Report not found');
          } else if (res.status === 403) {
            setError('You do not have access to this report');
          } else {
            throw new Error('Failed to fetch report');
          }
          return;
        }

        const data = await res.json();
        setReport(data);
      } catch (err) {
        console.error('Error fetching report:', err);
        setError('Failed to load report');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [id, session?.access_token]);

  // Resolve short-lived signed URLs so private report-photos actually render.
  React.useEffect(() => {
    const photos = report?.photos;
    if (!photos || photos.length === 0 || !session?.access_token) return;
    const missing = photos.filter((p) => p.storage_path && !photoUrls[p.storage_path]);
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      const resolved = await Promise.all(
        missing.map(async (p) => {
          try {
            const res = await fetch('/api/download/get-url', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ bucket: 'report-photos', storagePath: p.storage_path }),
            });
            if (!res.ok) return null;
            const { signedUrl } = await res.json();
            return [p.storage_path, signedUrl] as const;
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      setPhotoUrls((prev) => {
        const next = { ...prev };
        for (const entry of resolved) if (entry) next[entry[0]] = entry[1];
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [report?.photos, session?.access_token, photoUrls]);

  // Auto-save with debounce
  const saveReport = React.useCallback(async (overrideVersion?: number) => {
    // Read the freshest report from the ref (shadows the state value for this
    // function), so the version and fields we send are never a stale snapshot
    // captured before an earlier in-flight save bumped the version.
    const report = reportRef.current;
    if (!report || !session?.access_token || report.status === 'finalized') return;

    // Serialize saves: if one is already in flight, mark that another is needed
    // and let the in-flight save flush it when it finishes. This prevents two
    // autosaves racing with the same stale version (the "modified by another
    // session" self-conflict).
    if (savingRef.current) {
      pendingSaveRef.current = true;
      return;
    }
    savingRef.current = true;
    setSaving(true);
    // When retrying after a version conflict we resend with the server's current
    // version; conflictVersion carries that value out to the finally block.
    let conflictVersion: number | null = null;
    const isRetry = overrideVersion !== undefined;
    let versionToSend = overrideVersion ?? report.version;
    try {
      // Defensive: a save must always carry a version — the API rejects one
      // without it ("Version is required"). If the local version is somehow
      // missing, recover the current one from the server before saving.
      if (versionToSend == null) {
        const vr = await fetch(`/api/reports/${report.id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (vr.ok) {
          const fresh = await vr.json();
          if (typeof fresh?.version === 'number') {
            versionToSend = fresh.version;
            if (reportRef.current) {
              reportRef.current = { ...reportRef.current, version: fresh.version };
            }
          }
        }
      }

      const payload = JSON.stringify({
          version: versionToSend,
          // Send all editable fields
          project_name: report.project_name,
          report_kind: report.report_kind,
          tenancy: report.tenancy,
          client_name: report.client_name,
          owner_name: report.owner_name,
          appraisal_date: report.appraisal_date,
          valid_until: report.valid_until,
          project_land_area: report.project_land_area,
          unit_gross_area: report.unit_gross_area,
          unit_net_area: report.unit_net_area,
          unit_land_share: report.unit_land_share,
          current_age: report.current_age,
          economic_life: report.economic_life,
          effective_age: report.effective_age,
          bedrooms: report.bedrooms,
          bathrooms: report.bathrooms,
          total_rooms: report.total_rooms,
          finishing_level: report.finishing_level,
          has_pool: report.has_pool,
          orientation: report.orientation,
          market_bldg_halffinish_low: report.market_bldg_halffinish_low,
          market_bldg_halffinish_high: report.market_bldg_halffinish_high,
          market_bldg_fullfinish_low: report.market_bldg_fullfinish_low,
          market_bldg_fullfinish_high: report.market_bldg_fullfinish_high,
          market_land_low: report.market_land_low,
          market_land_high: report.market_land_high,
          market_notes: report.market_notes,
          cost_land_price_per_sqm: report.cost_land_price_per_sqm,
          cost_allowed_floors: report.cost_allowed_floors,
          cost_current_floors: report.cost_current_floors,
          cost_construction_per_sqm: report.cost_construction_per_sqm,
          cost_unit_area_to_value: report.cost_unit_area_to_value,
          cost_repairable_depreciation: report.cost_repairable_depreciation,
          cost_garden_value: report.cost_garden_value,
          cost_garage_value: report.cost_garage_value,
          cost_storage_value: report.cost_storage_value,
          sales_subject_building_area: report.sales_subject_building_area,
          sales_subject_land_area: report.sales_subject_land_area,
          sales_final_value: report.sales_final_value,
          sales_narrative: report.sales_narrative,
          income_monthly_rent: report.income_monthly_rent,
          income_vacancy_rate: report.income_vacancy_rate,
          income_remaining_life: report.income_remaining_life,
          income_interest_rate: report.income_interest_rate,
          grm_monthly_rent: report.grm_monthly_rent,
          grm_multiplier: report.grm_multiplier,
          grm_vacancy_amount: report.grm_vacancy_amount,
          chosen_method: report.chosen_method,
          reconciliation_rationale: report.reconciliation_rationale,
          final_value: report.final_value,
          land_value: report.land_value,
          monthly_rent_reconciled: report.monthly_rent_reconciled,
      });

      // Retry loop: transient failures (network drop, expired token, server
      // hiccup) must never strand the appraiser's work. We keep local edits and
      // retry with backoff; only a genuine rejection (400/403/404) or an
      // unresolved version conflict stops. Whatever isn't saved stays flagged
      // unsaved, and the background flush keeps trying.
      const maxAttempts = 4;
      let token = session.access_token;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        let res: Response;
        try {
          res = await fetch(`/api/reports/${report.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: payload,
          });
        } catch {
          // Request never completed (offline / connection dropped).
          if (attempt < maxAttempts) {
            await delay(500 * attempt);
            continue;
          }
          setError("Can't reach the server — your changes are safe and will save automatically once you're back online.");
          return;
        }

        if (res.status === 409) {
          const data = await res.json().catch(() => ({} as { currentVersion?: number; message?: string }));
          if (!isRetry && typeof data.currentVersion === 'number') {
            conflictVersion = data.currentVersion;
          } else {
            setError(`Version conflict: ${data.message ?? 'please refresh and try again'}`);
          }
          return;
        }

        if (res.status === 401) {
          // Token likely expired mid-session — refresh it and retry.
          const fresh = await getFreshAccessToken();
          if (fresh) token = fresh;
          if (attempt < maxAttempts) {
            await delay(400);
            continue;
          }
          setError('Your session expired — please sign in again. Your changes are still here.');
          return;
        }

        if (res.status >= 500) {
          if (attempt < maxAttempts) {
            await delay(500 * attempt);
            continue;
          }
          setError('The server had trouble saving — your changes are kept and will retry automatically.');
          return;
        }

        if (!res.ok) {
          // 400/403/404 — a real rejection; retrying won't help.
          const data = await res.json().catch(() => ({} as { error?: string }));
          setError(data.error || 'Failed to save changes.');
          return;
        }

        // Success. Only sync the version — never merge the server echo back over
        // local state, or in-flight keystrokes get clobbered.
        const updated = await res.json().catch(() => ({} as { version?: number }));
        if (typeof updated?.version === 'number') {
          const nextVersion = updated.version;
          reportRef.current = reportRef.current
            ? { ...reportRef.current, version: nextVersion }
            : reportRef.current;
          setReport((prev) => (prev ? { ...prev, version: nextVersion } : null));
        }
        setHasUnsavedChanges(false);
        setLastSaved(new Date());
        setError(null);
        return;
      }
    } catch (err) {
      console.error('Save error:', err);
      setError('Couldn’t save just now — your changes are kept and will retry automatically.');
    } finally {
      savingRef.current = false;
      setSaving(false);
      if (conflictVersion !== null) {
        // Adopt the server's version locally, then retry with it explicitly so
        // the retry isn't tripped up by the stale version in this closure.
        const retryVersion = conflictVersion;
        reportRef.current = reportRef.current
          ? { ...reportRef.current, version: retryVersion }
          : reportRef.current;
        setReport((prev) => prev ? { ...prev, version: retryVersion } : prev);
        // Retry via the ref so the next tick uses the freshest field data/version.
        setTimeout(() => saveReportRef.current(retryVersion), 0);
      } else if (pendingSaveRef.current) {
        // Edits arrived while this save was in flight — flush them now, again via
        // the ref so the flush picks up the latest report state, not this closure.
        pendingSaveRef.current = false;
        setTimeout(() => saveReportRef.current(), 0);
      }
    }
    // Reads report from the ref, so it doesn't need `report` in deps — staying
    // stable across keystrokes avoids re-creating the debounced closure.
  }, [session?.access_token]);

  // Always points at the latest saveReport closure so deferred retries/flushes
  // scheduled from inside a save use current report data instead of a stale one.
  const saveReportRef = React.useRef(saveReport);
  React.useEffect(() => {
    saveReportRef.current = saveReport;
  }, [saveReport]);

  // Mirror of hasUnsavedChanges for the background flush + unload guard.
  const hasUnsavedRef = React.useRef(false);
  React.useEffect(() => {
    hasUnsavedRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  // Safety net: while anything is unsaved, keep trying to persist it every few
  // seconds. Combined with the in-request retry, this means a dropped
  // connection or an expired-then-refreshed session can never strand work —
  // once the tab can reach the server again, the next tick saves.
  React.useEffect(() => {
    const interval = setInterval(() => {
      if (hasUnsavedRef.current && !savingRef.current) {
        saveReportRef.current();
      }
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Warn before leaving with unsaved changes (last line of defence if the
  // network is down and retries haven't landed yet).
  React.useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // Trigger debounced save on field change
  const handleFieldChange = (field: string, value: unknown) => {
    if (report?.status === 'finalized') return;

    setReport((prev) => prev ? { ...prev, [field]: value } : null);
    setHasUnsavedChanges(true);

    // Clear existing timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Set new timer for 500ms
    saveTimerRef.current = setTimeout(() => {
      saveReport();
    }, 500);
  };

  // Compute live values
  const liveValues = React.useMemo(() => {
    if (!report) return null;

    return evaluatePartial({
      costApproach: {
        landPricePerSqm: report.cost_land_price_per_sqm ?? undefined,
        allowedFloors: report.cost_allowed_floors ?? undefined,
        currentFloors: report.cost_current_floors ?? undefined,
        projectLandArea: report.project_land_area ?? undefined,
        unitAreaToValue: report.cost_unit_area_to_value ?? report.unit_gross_area ?? undefined,
        constructionCostPerSqm: report.cost_construction_per_sqm ?? undefined,
        economicLife: report.economic_life,
        effectiveAge: report.effective_age ?? undefined,
        repairableDepreciation: report.cost_repairable_depreciation ?? 0,
        gardenShareValue: report.cost_garden_value ?? undefined,
        garageShareValue: report.cost_garage_value ?? undefined,
        storageRoomValue: report.cost_storage_value ?? undefined,
      },
      salesComparison: {
        comparables: report.comparables.map((c) => ({
          address: c.address,
          source: c.source,
          saleTiming: 'current_offer' as const,
          tenancy: 'owner_occupied' as const,
          paymentTerms: 'cash' as const,
          buildingAreaSqm: c.building_area_sqm,
          landAreaSqm: c.land_area_sqm,
          hasPool: false,
          buildingPricePerSqm: c.building_price_per_sqm,
          salePrice: c.sale_price,
        })),
        finalValue: report.sales_final_value ?? undefined,
        subjectBuildingArea: report.sales_subject_building_area ?? report.unit_gross_area ?? undefined,
      },
      incomeApproach: {
        monthlyRent: report.income_monthly_rent ?? undefined,
        vacancyAndExpensesRate: report.income_vacancy_rate ?? 0.1,
        remainingLife: report.income_remaining_life ?? (report.economic_life - (report.effective_age ?? 0)) ?? undefined,
        interestRate: report.income_interest_rate ?? undefined,
        unitLandShareValue: report.land_value ?? undefined,
      },
      grm: {
        incomeMultiplier: report.grm_multiplier ?? undefined,
        monthlyRent: report.grm_monthly_rent ?? undefined,
        vacancyAndExpenses: report.grm_vacancy_amount ?? undefined,
      },
    });
  }, [report]);

  // Handle section scroll
  const scrollToSection = (sectionId: SectionId) => {
    setActiveSection(sectionId);
    const element = document.getElementById(`section-${sectionId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Comparable CRUD functions
  const openAddComparable = () => {
    setEditingComparable(defaultComparableForm);
    setComparableModalOpen(true);
  };

  const openEditComparable = (comp: Report['comparables'][0]) => {
    setEditingComparable({
      id: comp.id,
      address: comp.address,
      source: comp.source,
      proximity: comp.proximity || '',
      floor: comp.floor || '',
      sale_timing: comp.sale_timing,
      tenancy: comp.tenancy,
      age_years: comp.age_years?.toString() || '',
      orientation: comp.orientation || '',
      payment_terms: comp.payment_terms,
      finishing_level: comp.finishing_level || '',
      condition: comp.condition || '',
      location_quality: comp.location_quality || '',
      garage_share: comp.garage_share?.toString() || '',
      building_area_sqm: comp.building_area_sqm.toString(),
      land_area_sqm: comp.land_area_sqm.toString(),
      has_pool: comp.has_pool,
      building_price_per_sqm: comp.building_price_per_sqm.toString(),
      sale_price: comp.sale_price.toString(),
      weight: comp.weight?.toString() || '1',
    });
    setComparableModalOpen(true);
  };

  const saveComparable = async () => {
    if (!report || !session?.access_token) return;

    setComparableSaving(true);
    try {
      const payload = {
        address: editingComparable.address,
        source: editingComparable.source,
        proximity: editingComparable.proximity || null,
        floor: editingComparable.floor || null,
        sale_timing: editingComparable.sale_timing,
        tenancy: editingComparable.tenancy,
        age_years: editingComparable.age_years ? parseInt(editingComparable.age_years) : null,
        orientation: editingComparable.orientation || null,
        payment_terms: editingComparable.payment_terms,
        finishing_level: editingComparable.finishing_level || null,
        condition: editingComparable.condition || null,
        location_quality: editingComparable.location_quality || null,
        garage_share: editingComparable.garage_share ? parseFloat(editingComparable.garage_share) : null,
        building_area_sqm: parseFloat(editingComparable.building_area_sqm),
        land_area_sqm: parseFloat(editingComparable.land_area_sqm),
        has_pool: editingComparable.has_pool,
        building_price_per_sqm: parseFloat(editingComparable.building_price_per_sqm),
        sale_price: parseFloat(editingComparable.sale_price),
        weight: parseFloat(editingComparable.weight) || 1,
      };

      let res: Response;
      if (editingComparable.id) {
        // Update existing
        res = await fetch(`/api/reports/${report.id}/comparables/${editingComparable.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(payload),
        });
      } else {
        // Create new
        res = await fetch(`/api/reports/${report.id}/comparables`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            ...payload,
            ord: report.comparables.length + 1,
          }),
        });
      }

      if (!res.ok) {
        throw new Error('Failed to save comparable');
      }

      const savedComp = await res.json();

      setReport((prev) => {
        if (!prev) return null;
        if (editingComparable.id) {
          // Update in list
          return {
            ...prev,
            comparables: prev.comparables.map((c) =>
              c.id === savedComp.id ? savedComp : c
            ),
          };
        } else {
          // Add to list
          return {
            ...prev,
            comparables: [...prev.comparables, savedComp],
          };
        }
      });

      setComparableModalOpen(false);
    } catch (err) {
      console.error('Error saving comparable:', err);
      setError('Failed to save comparable');
    } finally {
      setComparableSaving(false);
    }
  };

  const deleteComparable = async (compId: string) => {
    if (!report || !session?.access_token) return;
    if (!confirm('Delete this comparable?')) return;

    try {
      const res = await fetch(`/api/reports/${report.id}/comparables/${compId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to delete');
      }

      setReport((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          comparables: prev.comparables.filter((c) => c.id !== compId),
        };
      });
    } catch (err) {
      console.error('Error deleting comparable:', err);
      setError('Failed to delete comparable');
    }
  };

  // Photo upload functions
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !report || !session?.access_token) return;

    setUploadingPhoto(true);
    try {
      // 1) Get a signed upload URL for the report-photos bucket.
      const urlRes = await fetch('/api/upload/get-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          bucket: 'report-photos',
          filename: file.name,
          contentType: file.type,
          fileSize: file.size,
        }),
      });
      if (!urlRes.ok) {
        const data = await urlRes.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to get upload URL');
      }
      const { signedUrl, storagePath } = await urlRes.json();

      // 2) Upload the file bytes straight to storage.
      const putRes = await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!putRes.ok) {
        throw new Error('Failed to upload photo to storage');
      }

      // 3) Record the photo against the report (path only — no file body).
      const res = await fetch(`/api/reports/${report.id}/photos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          storage_path: storagePath,
          category: photoCategory,
          caption: photoCaption,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save photo');
      }

      const newPhoto = await res.json();
      setReport((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          photos: [...prev.photos, newPhoto],
        };
      });

      // Reset form
      setPhotoCategory('other');
      setPhotoCaption('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Error uploading photo:', err);
      setError('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const deletePhoto = async (photoId: string) => {
    if (!report || !session?.access_token) return;
    if (!confirm('Delete this photo?')) return;

    try {
      const res = await fetch(`/api/reports/${report.id}/photos/${photoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to delete');
      }

      setReport((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          photos: prev.photos.filter((p) => p.id !== photoId),
        };
      });
    } catch (err) {
      console.error('Error deleting photo:', err);
      setError('Failed to delete photo');
    }
  };

  // Finalization function
  const handleFinalize = async () => {
    if (!report || !session?.access_token) return;

    // Check all declarations
    if (!Object.values(declarations).every(Boolean)) {
      setError('Please confirm all declarations before finalizing');
      return;
    }

    setFinalizing(true);
    try {
      // Flush any pending autosave first so the finalized report includes the
      // latest edits (and reportRef.version is current for the check below).
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      await saveReport();

      const finalizeOnce = (version: number | undefined) =>
        fetch(`/api/reports/${report.id}/finalize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          // The finalize endpoint requires the current version for optimistic
          // locking — the previous code never sent it, so finalize always failed
          // with "Version is required".
          body: JSON.stringify({ declarations, version }),
        });

      let version = reportRef.current?.version ?? report.version;
      let res = await finalizeOnce(version);

      // On a version conflict, resync to the server's current version and retry.
      if (res.status === 409) {
        const data = await res.json().catch(() => ({} as { currentVersion?: number }));
        if (typeof data.currentVersion === 'number') {
          version = data.currentVersion;
          if (reportRef.current) reportRef.current = { ...reportRef.current, version };
          setReport((prev) => (prev ? { ...prev, version } : prev));
          res = await finalizeOnce(version);
        }
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(data.error || 'Finalization failed');
      }

      const finalized = await res.json();
      setReport((prev) => prev ? { ...prev, ...finalized } : null);
      setFinalizeModalOpen(false);
    } catch (err: any) {
      console.error('Error finalizing:', err);
      setError(err.message || 'Failed to finalize report');
    } finally {
      setFinalizing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-100 pt-24 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-body-s text-ink-400">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-cream-100 pt-24 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-h4 text-ink-600 mb-2">{error || t('reports.errors.loadFailed')}</h2>
          <Link to="/dashboard">
            <Button variant="secondary" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('reports.backToDashboard')}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const isReadOnly = report.status === 'finalized';

  return (
    <div className="min-h-screen bg-cream-100">
      {/* Header */}
      <div className="fixed top-16 left-0 right-0 bg-cream-50 border-b border-ink-100 z-40">
        <div className="max-w-7xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="text-ink-400 hover:text-ink-600 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-body-m font-medium text-ink-600">
                {report.project_name || report.property.address_description || t('dashboard.untitledReport')}
              </h1>
              <p className="text-[12px] text-ink-400">
                {t(`propertyTypes.${report.property.property_type}`, report.property.property_type)}
                {report.property.district && ` • ${report.property.district.name_en}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Save status */}
            <div className="flex items-center gap-2 text-[12px]">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-ink-400" />
                  <span className="text-ink-400">{t('reports.saving')}</span>
                </>
              ) : hasUnsavedChanges ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-ink-400">{t('reports.unsavedChanges', 'Unsaved changes')}</span>
                </>
              ) : lastSaved ? (
                <>
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  <span className="text-ink-400">
                    {t('reports.saved', 'Saved')} {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </>
              ) : null}
            </div>

            {/* Status badge */}
            <span
              className={`px-2 py-1 rounded-full text-[11px] font-medium ${
                report.status === 'finalized'
                  ? 'bg-emerald-100 text-emerald-700'
                  : report.status === 'draft'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {t(`reports.status.${report.status}`)}
            </span>

            {!isReadOnly && (
              <Button
                variant="secondary"
                onClick={saveReport}
                disabled={saving || !hasUnsavedChanges}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {t('reports.saveDraft')}
              </Button>
            )}

            {!isReadOnly && (
              <Button
                onClick={() => setFinalizeModalOpen(true)}
                className="flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                {t('reports.finalize')}
              </Button>
            )}

            {isReadOnly && (
              <Button
                variant="secondary"
                className="flex items-center gap-2"
                onClick={async () => {
                  // Fetch with the auth header (window.open can't send it) and
                  // download the resulting blob.
                  if (!session?.access_token) return;
                  try {
                    const res = await fetch(`/api/reports/${report.id}/pdf`, {
                      headers: { Authorization: `Bearer ${session.access_token}` },
                    });
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}));
                      throw new Error(data.error || 'Failed to generate PDF');
                    }
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `appraisal-${report.id.slice(0, 8)}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(url);
                  } catch (err) {
                    console.error('Error downloading PDF:', err);
                    alert(err instanceof Error ? err.message : 'Failed to download PDF');
                  }
                }}
              >
                <FileDown className="h-4 w-4" />
                Download PDF
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="pt-32 pb-16 flex">
        {/* Left sidebar - Section navigation */}
        <div className="fixed left-0 top-32 bottom-0 w-48 bg-cream-50 border-r border-ink-100 overflow-y-auto">
          <nav className="p-4 space-y-1">
            {SECTION_IDS.map((sectionId) => {
              const Icon = SECTION_ICONS[sectionId];
              return (
                <button
                  key={sectionId}
                  onClick={() => scrollToSection(sectionId)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-[13px] transition-colors ${
                    activeSection === sectionId
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'text-ink-400 hover:text-ink-600 hover:bg-cream-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t(`reports.sections.${sectionId}`)}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Center - Form */}
        <div className="ml-48 mr-72 flex-1 px-8">
          <div className="max-w-3xl mx-auto space-y-8">
            {/* Section 1: Identification */}
            <section id="section-identification" className="bg-cream-50 rounded-lg border border-ink-100 p-6">
              <h2 className="text-h5 text-ink-600 mb-6 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-500" />
                {t('reports.identification.title')}
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label={t('reports.identification.projectName')}
                  value={report.project_name || ''}
                  onChange={(v) => handleFieldChange('project_name', v || null)}
                  disabled={isReadOnly}
                />
                <SelectField
                  label={t('reports.identification.reportKind')}
                  value={report.report_kind}
                  onChange={(v) => handleFieldChange('report_kind', v)}
                  options={[
                    { value: 'brief', label: t('reports.identification.reportKinds.brief') },
                    { value: 'narrative_limited', label: t('reports.identification.reportKinds.narrative_limited') },
                    { value: 'narrative_full', label: t('reports.identification.reportKinds.narrative_full') },
                  ]}
                  disabled={isReadOnly}
                />
                <SelectField
                  label={t('reports.identification.tenancy')}
                  value={report.tenancy}
                  onChange={(v) => handleFieldChange('tenancy', v)}
                  options={[
                    { value: 'owner_occupied', label: t('reports.identification.tenancyTypes.owner_occupied') },
                    { value: 'vacant', label: t('reports.identification.tenancyTypes.vacant') },
                    { value: 'rented', label: t('reports.identification.tenancyTypes.rented') },
                  ]}
                  disabled={isReadOnly}
                />
                <InputField
                  label={t('reports.identification.clientName')}
                  value={report.client_name || ''}
                  onChange={(v) => handleFieldChange('client_name', v || null)}
                  disabled={isReadOnly}
                  required
                />
                <InputField
                  label={t('reports.identification.ownerName')}
                  value={report.owner_name || ''}
                  onChange={(v) => handleFieldChange('owner_name', v || null)}
                  disabled={isReadOnly}
                  required
                />
                <InputField
                  label={t('reports.identification.appraisalDate')}
                  type="date"
                  value={report.appraisal_date || ''}
                  onChange={(v) => handleFieldChange('appraisal_date', v || null)}
                  disabled={isReadOnly}
                  required
                />
                <InputField
                  label={t('reports.identification.validUntil')}
                  type="date"
                  value={report.valid_until || ''}
                  onChange={(v) => handleFieldChange('valid_until', v || null)}
                  disabled={isReadOnly}
                  required
                />
              </div>
            </section>

            {/* Section 2: Physical Characteristics */}
            <section id="section-physical" className="bg-cream-50 rounded-lg border border-ink-100 p-6">
              <h2 className="text-h5 text-ink-600 mb-6 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-500" />
                {t('reports.physical.title')}
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <NumberField
                  label={t('reports.physical.projectLandArea')}
                  value={report.project_land_area}
                  onChange={(v) => handleFieldChange('project_land_area', v)}
                  disabled={isReadOnly}
                />
                <NumberField
                  label={t('reports.physical.unitGrossArea')}
                  value={report.unit_gross_area}
                  onChange={(v) => handleFieldChange('unit_gross_area', v)}
                  disabled={isReadOnly}
                />
                <NumberField
                  label={t('reports.physical.unitNetArea')}
                  value={report.unit_net_area}
                  onChange={(v) => handleFieldChange('unit_net_area', v)}
                  disabled={isReadOnly}
                  required
                />
                <NumberField
                  label={t('reports.physical.unitLandShare')}
                  value={report.unit_land_share}
                  onChange={(v) => handleFieldChange('unit_land_share', v)}
                  disabled={isReadOnly}
                />
                <NumberField
                  label={t('reports.physical.currentAge')}
                  value={report.current_age}
                  onChange={(v) => handleFieldChange('current_age', v)}
                  disabled={isReadOnly}
                />
                <NumberField
                  label={t('reports.physical.economicLife')}
                  value={report.economic_life}
                  onChange={(v) => handleFieldChange('economic_life', v)}
                  disabled={isReadOnly}
                />
                <NumberField
                  label={t('reports.physical.effectiveAge')}
                  value={report.effective_age}
                  onChange={(v) => handleFieldChange('effective_age', v)}
                  disabled={isReadOnly}
                />
                <NumberField
                  label={t('reports.physical.bedrooms')}
                  value={report.bedrooms}
                  onChange={(v) => handleFieldChange('bedrooms', v)}
                  disabled={isReadOnly}
                />
                <NumberField
                  label={t('reports.physical.bathrooms')}
                  value={report.bathrooms}
                  onChange={(v) => handleFieldChange('bathrooms', v)}
                  disabled={isReadOnly}
                />
                <NumberField
                  label={t('reports.physical.totalRooms')}
                  value={report.total_rooms}
                  onChange={(v) => handleFieldChange('total_rooms', v)}
                  disabled={isReadOnly}
                />
                <SelectField
                  label={t('reports.physical.finishingLevel')}
                  value={report.finishing_level || ''}
                  onChange={(v) => handleFieldChange('finishing_level', v || null)}
                  options={[
                    { value: '', label: t('common.select') || 'Select...' },
                    { value: 'luxury', label: t('reports.physical.finishingLevels.luxury') },
                    { value: 'super_lux', label: t('reports.physical.finishingLevels.super_lux') },
                    { value: 'full', label: t('reports.physical.finishingLevels.full') },
                    { value: 'half', label: t('reports.physical.finishingLevels.half') },
                    { value: 'shell', label: t('reports.physical.finishingLevels.shell') },
                  ]}
                  disabled={isReadOnly}
                />
                <InputField
                  label={t('reports.physical.orientation')}
                  value={report.orientation || ''}
                  onChange={(v) => handleFieldChange('orientation', v || null)}
                  disabled={isReadOnly}
                />
              </div>
            </section>

            {/* Section 3: Market Study */}
            <section id="section-market" className="bg-cream-50 rounded-lg border border-ink-100 p-6">
              <h2 className="text-h5 text-ink-600 mb-6 flex items-center gap-2">
                <LineChart className="h-5 w-5 text-emerald-500" />
                {t('reports.market.title')}
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <p className="text-[11px] font-medium text-ink-400 uppercase tracking-wider mb-3">
                    {t('reports.market.buildingHalfFinish')} ({t('reports.market.perSqm')})
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <NumberField
                      label={t('reports.market.low')}
                      value={report.market_bldg_halffinish_low}
                      onChange={(v) => handleFieldChange('market_bldg_halffinish_low', v)}
                      disabled={isReadOnly}
                    />
                    <NumberField
                      label={t('reports.market.high')}
                      value={report.market_bldg_halffinish_high}
                      onChange={(v) => handleFieldChange('market_bldg_halffinish_high', v)}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
                <div className="col-span-2">
                  <p className="text-[11px] font-medium text-ink-400 uppercase tracking-wider mb-3">
                    {t('reports.market.buildingFullFinish')} ({t('reports.market.perSqm')})
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <NumberField
                      label={t('reports.market.low')}
                      value={report.market_bldg_fullfinish_low}
                      onChange={(v) => handleFieldChange('market_bldg_fullfinish_low', v)}
                      disabled={isReadOnly}
                    />
                    <NumberField
                      label={t('reports.market.high')}
                      value={report.market_bldg_fullfinish_high}
                      onChange={(v) => handleFieldChange('market_bldg_fullfinish_high', v)}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
                <div className="col-span-2">
                  <p className="text-[11px] font-medium text-ink-400 uppercase tracking-wider mb-3">
                    {t('reports.market.landPrices')} ({t('reports.market.perSqm')})
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <NumberField
                      label={t('reports.market.low')}
                      value={report.market_land_low}
                      onChange={(v) => handleFieldChange('market_land_low', v)}
                      disabled={isReadOnly}
                    />
                    <NumberField
                      label={t('reports.market.high')}
                      value={report.market_land_high}
                      onChange={(v) => handleFieldChange('market_land_high', v)}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] font-medium text-ink-400 uppercase tracking-wider block mb-2">
                    {t('reports.market.marketNotes')}
                  </label>
                  <textarea
                    value={report.market_notes || ''}
                    onChange={(e) => handleFieldChange('market_notes', e.target.value || null)}
                    disabled={isReadOnly}
                    rows={3}
                    className="w-full bg-cream-100 border border-ink-100 rounded-md px-3 py-2 text-body-s text-ink-600 placeholder:text-ink-300 focus:border-emerald-500 focus:outline-none resize-none disabled:opacity-60"
                  />
                </div>
              </div>
            </section>

            {/* Section 4: Cost Approach */}
            <section id="section-cost" className="bg-cream-50 rounded-lg border border-ink-100 p-6">
              <h2 className="text-h5 text-ink-600 mb-6 flex items-center gap-2">
                <Calculator className="h-5 w-5 text-emerald-500" />
                {t('reports.cost.title')}
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <NumberField
                  label={t('reports.cost.landPricePerSqm')}
                  value={report.cost_land_price_per_sqm}
                  onChange={(v) => handleFieldChange('cost_land_price_per_sqm', v)}
                  disabled={isReadOnly}
                />
                <NumberField
                  label={t('reports.cost.constructionPerSqm')}
                  value={report.cost_construction_per_sqm}
                  onChange={(v) => handleFieldChange('cost_construction_per_sqm', v)}
                  disabled={isReadOnly}
                />
                <NumberField
                  label={t('reports.cost.allowedFloors')}
                  value={report.cost_allowed_floors}
                  onChange={(v) => handleFieldChange('cost_allowed_floors', v)}
                  disabled={isReadOnly}
                />
                <NumberField
                  label={t('reports.cost.currentFloors')}
                  value={report.cost_current_floors}
                  onChange={(v) => handleFieldChange('cost_current_floors', v)}
                  disabled={isReadOnly}
                />
                <NumberField
                  label={t('reports.cost.unitAreaToValue')}
                  value={report.cost_unit_area_to_value}
                  onChange={(v) => handleFieldChange('cost_unit_area_to_value', v)}
                  disabled={isReadOnly}
                />
                <NumberField
                  label={t('reports.cost.repairableDepreciation')}
                  value={report.cost_repairable_depreciation}
                  onChange={(v) => handleFieldChange('cost_repairable_depreciation', v)}
                  disabled={isReadOnly}
                />
                <NumberField
                  label={t('reports.cost.gardenValue')}
                  value={report.cost_garden_value}
                  onChange={(v) => handleFieldChange('cost_garden_value', v)}
                  disabled={isReadOnly}
                />
                <NumberField
                  label={t('reports.cost.garageValue')}
                  value={report.cost_garage_value}
                  onChange={(v) => handleFieldChange('cost_garage_value', v)}
                  disabled={isReadOnly}
                />
                <NumberField
                  label={t('reports.cost.storageValue')}
                  value={report.cost_storage_value}
                  onChange={(v) => handleFieldChange('cost_storage_value', v)}
                  disabled={isReadOnly}
                />
              </div>
              {liveValues?.cost && (
                <div className="mt-6 p-4 bg-emerald-50 rounded-md">
                  <p className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider mb-2">
                    {t('reports.cost.totalValue')}
                  </p>
                  <p className="text-h4 text-emerald-700">EGP {formatEGP(liveValues.cost.total)}</p>
                </div>
              )}
            </section>

            {/* Section 5: Sales Comparison */}
            <section id="section-sales" className="bg-cream-50 rounded-lg border border-ink-100 p-6">
              <h2 className="text-h5 text-ink-600 mb-6 flex items-center gap-2">
                <Scale className="h-5 w-5 text-emerald-500" />
                {t('reports.sales.title')}
              </h2>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <NumberField
                  label={t('reports.sales.subjectBuildingArea')}
                  value={report.sales_subject_building_area}
                  onChange={(v) => handleFieldChange('sales_subject_building_area', v)}
                  disabled={isReadOnly}
                />
                <NumberField
                  label={t('reports.sales.subjectLandArea')}
                  value={report.sales_subject_land_area}
                  onChange={(v) => handleFieldChange('sales_subject_land_area', v)}
                  disabled={isReadOnly}
                />
              </div>

              {/* Comparables grid */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-medium text-ink-400 uppercase tracking-wider">
                    {t('reports.sales.comparables')} ({report.comparables.length})
                  </p>
                  {!isReadOnly && (
                    <Button variant="secondary" onClick={openAddComparable} className="flex items-center gap-1.5 text-[12px] px-2 py-1">
                      <Plus className="h-3.5 w-3.5" />
                      {t('reports.sales.addComparable')}
                    </Button>
                  )}
                </div>
                {report.comparables.length === 0 ? (
                  <div className="text-center py-8 bg-cream-100 rounded-md border border-dashed border-ink-200">
                    <Scale className="h-8 w-8 text-ink-300 mx-auto mb-2" />
                    <p className="text-body-s text-ink-400">{t('reports.sales.noComparables') || 'No comparables added yet'}</p>
                    {!isReadOnly && (
                      <button
                        onClick={openAddComparable}
                        className="text-[12px] text-emerald-600 hover:text-emerald-700 mt-1"
                      >
                        {t('reports.sales.addFirstComparable') || 'Add your first comparable'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="border-b border-ink-100">
                          <th className="text-left py-2 px-2 font-medium text-ink-500">#</th>
                          <th className="text-left py-2 px-2 font-medium text-ink-500">{t('reports.sales.address')}</th>
                          <th className="text-left py-2 px-2 font-medium text-ink-500">{t('reports.sales.source')}</th>
                          <th className="text-right py-2 px-2 font-medium text-ink-500">{t('reports.sales.buildingArea')}</th>
                          <th className="text-right py-2 px-2 font-medium text-ink-500">{t('reports.sales.salePrice')}</th>
                          <th className="text-right py-2 px-2 font-medium text-ink-500">{t('reports.market.perSqm')}</th>
                          <th className="text-right py-2 px-2 font-medium text-ink-500">{t('reports.sales.weight')}</th>
                          {!isReadOnly && <th className="py-2 px-2"></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {report.comparables.map((comp, i) => (
                          <tr key={comp.id} className="border-b border-ink-50 hover:bg-cream-100">
                            <td className="py-2 px-2 text-ink-400">{i + 1}</td>
                            <td className="py-2 px-2">
                              <p className="font-medium text-ink-600">{comp.address}</p>
                              <p className="text-[11px] text-ink-400">
                                {comp.finishing_level && `${comp.finishing_level} • `}
                                {t(`reports.sales.saleTimings.${comp.sale_timing}`)}
                              </p>
                            </td>
                            <td className="py-2 px-2 text-ink-500">{comp.source}</td>
                            <td className="py-2 px-2 text-right text-ink-600">{comp.building_area_sqm} m²</td>
                            <td className="py-2 px-2 text-right text-ink-600">{formatEGP(comp.sale_price)}</td>
                            <td className="py-2 px-2 text-right font-medium text-emerald-600">
                              {formatEGP(comp.building_price_per_sqm)}
                            </td>
                            <td className="py-2 px-2 text-right text-ink-500">{comp.weight}x</td>
                            {!isReadOnly && (
                              <td className="py-2 px-2">
                                <div className="flex items-center gap-1 justify-end">
                                  <button
                                    onClick={() => openEditComparable(comp)}
                                    className="p-1 text-ink-400 hover:text-emerald-600 transition-colors"
                                    title={t('common.edit')}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => deleteComparable(comp.id)}
                                    className="p-1 text-ink-400 hover:text-red-600 transition-colors"
                                    title={t('common.delete') || 'Delete'}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <NumberField
                  label={t('reports.sales.finalValue')}
                  value={report.sales_final_value}
                  onChange={(v) => handleFieldChange('sales_final_value', v)}
                  disabled={isReadOnly}
                />
              </div>
            </section>

            {/* Section 6: Income Approach */}
            <section id="section-income" className="bg-cream-50 rounded-lg border border-ink-100 p-6">
              <h2 className="text-h5 text-ink-600 mb-6 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-500" />
                {t('reports.income.title')}
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <NumberField
                  label={t('reports.income.monthlyRent')}
                  value={report.income_monthly_rent}
                  onChange={(v) => handleFieldChange('income_monthly_rent', v)}
                  disabled={isReadOnly}
                />
                <NumberField
                  label={t('reports.income.vacancyRate')}
                  value={report.income_vacancy_rate ? report.income_vacancy_rate * 100 : null}
                  onChange={(v) => handleFieldChange('income_vacancy_rate', v ? v / 100 : null)}
                  disabled={isReadOnly}
                />
                <NumberField
                  label={t('reports.income.remainingLife')}
                  value={report.income_remaining_life}
                  onChange={(v) => handleFieldChange('income_remaining_life', v)}
                  disabled={isReadOnly}
                />
                <NumberField
                  label={t('reports.income.interestRate')}
                  value={report.income_interest_rate}
                  onChange={(v) => handleFieldChange('income_interest_rate', v)}
                  disabled={isReadOnly}
                />
              </div>
              {liveValues?.income && (
                <div className="mt-6 p-4 bg-emerald-50 rounded-md">
                  <p className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider mb-2">
                    {t('reports.income.totalValue')}
                  </p>
                  <p className="text-h4 text-emerald-700">EGP {formatEGP(liveValues.income.total)}</p>
                </div>
              )}
            </section>

            {/* Section 7: GRM */}
            <section id="section-grm" className="bg-cream-50 rounded-lg border border-ink-100 p-6">
              <h2 className="text-h5 text-ink-600 mb-6 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                {t('reports.grm.title')}
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <NumberField
                  label={t('reports.grm.monthlyRent')}
                  value={report.grm_monthly_rent}
                  onChange={(v) => handleFieldChange('grm_monthly_rent', v)}
                  disabled={isReadOnly}
                />
                <NumberField
                  label={t('reports.grm.multiplier')}
                  value={report.grm_multiplier}
                  onChange={(v) => handleFieldChange('grm_multiplier', v)}
                  disabled={isReadOnly}
                />
                <NumberField
                  label={t('reports.grm.vacancyAmount')}
                  value={report.grm_vacancy_amount}
                  onChange={(v) => handleFieldChange('grm_vacancy_amount', v)}
                  disabled={isReadOnly}
                />
              </div>
              {liveValues?.grm && (
                <div className="mt-6 p-4 bg-emerald-50 rounded-md">
                  <p className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider mb-2">
                    {t('reports.grm.totalValue')}
                  </p>
                  <p className="text-h4 text-emerald-700">EGP {formatEGP(liveValues.grm.total)}</p>
                </div>
              )}
            </section>

            {/* Section 8: Reconciliation */}
            <section id="section-reconciliation" className="bg-cream-50 rounded-lg border border-ink-100 p-6">
              <h2 className="text-h5 text-ink-600 mb-6 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
                {t('reports.reconciliation.title')}
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <SelectField
                  label={t('reports.reconciliation.chosenMethod')}
                  value={report.chosen_method || ''}
                  onChange={(v) => handleFieldChange('chosen_method', v || null)}
                  options={[
                    { value: '', label: t('common.select') || 'Select...' },
                    { value: 'cost', label: t('reports.reconciliation.methods.cost') },
                    { value: 'sales_comparison', label: t('reports.reconciliation.methods.sales_comparison') },
                    { value: 'income', label: t('reports.reconciliation.methods.income') },
                    { value: 'grm', label: t('reports.reconciliation.methods.grm') },
                  ]}
                  disabled={isReadOnly}
                  required
                />
                <NumberField
                  label={t('reports.reconciliation.finalValue')}
                  value={report.final_value}
                  onChange={(v) => handleFieldChange('final_value', v)}
                  disabled={isReadOnly}
                  required
                />
                <NumberField
                  label={t('reports.reconciliation.landValue')}
                  value={report.land_value}
                  onChange={(v) => handleFieldChange('land_value', v)}
                  disabled={isReadOnly}
                  required
                />
                <NumberField
                  label={t('reports.reconciliation.monthlyRentReconciled')}
                  value={report.monthly_rent_reconciled}
                  onChange={(v) => handleFieldChange('monthly_rent_reconciled', v)}
                  disabled={isReadOnly}
                />
                <div className="col-span-2">
                  <label className="text-[11px] font-medium text-ink-400 uppercase tracking-wider block mb-2">
                    {t('reports.reconciliation.rationale')} *
                  </label>
                  <textarea
                    value={report.reconciliation_rationale || ''}
                    onChange={(e) => handleFieldChange('reconciliation_rationale', e.target.value || null)}
                    disabled={isReadOnly}
                    rows={4}
                    className="w-full bg-cream-100 border border-ink-100 rounded-md px-3 py-2 text-body-s text-ink-600 placeholder:text-ink-300 focus:border-emerald-500 focus:outline-none resize-none disabled:opacity-60"
                    placeholder={t('reports.reconciliation.rationalePlaceholder') || 'Explain why this method was chosen...'}
                  />
                </div>
              </div>
            </section>

            {/* Section 9: Photos */}
            <section id="section-photos" className="bg-cream-50 rounded-lg border border-ink-100 p-6">
              <h2 className="text-h5 text-ink-600 mb-6 flex items-center gap-2">
                <Image className="h-5 w-5 text-emerald-500" />
                {t('reports.photos.title')} ({report.photos.length})
              </h2>

              {/* Photo upload area */}
              {!isReadOnly && (
                <div className="mb-6 p-4 bg-cream-100 rounded-md border border-dashed border-ink-200">
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="text-[11px] font-medium text-ink-400 uppercase tracking-wider block mb-2">
                        {t('reports.photos.category') || 'Category'}
                      </label>
                      <select
                        value={photoCategory}
                        onChange={(e) => setPhotoCategory(e.target.value)}
                        className="w-full bg-cream-50 border border-ink-100 rounded-md px-3 py-2 text-body-s text-ink-600 focus:border-emerald-500 focus:outline-none"
                      >
                        {PHOTO_CATEGORIES.map((cat) => (
                          <option key={cat.value} value={cat.value}>{t(`reports.photos.categories.${cat.value}`) || cat.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-[11px] font-medium text-ink-400 uppercase tracking-wider block mb-2">
                        {t('reports.photos.caption') || 'Caption'} ({t('common.optional') || 'optional'})
                      </label>
                      <input
                        type="text"
                        value={photoCaption}
                        onChange={(e) => setPhotoCaption(e.target.value)}
                        placeholder={t('reports.photos.captionPlaceholder') || 'Describe this photo...'}
                        className="w-full bg-cream-50 border border-ink-100 rounded-md px-3 py-2 text-body-s text-ink-600 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoSelect}
                      className="hidden"
                      id="photo-upload"
                    />
                    <label
                      htmlFor="photo-upload"
                      className={`flex items-center gap-2 px-4 py-2 rounded-md cursor-pointer transition-colors ${
                        uploadingPhoto
                          ? 'bg-ink-200 text-ink-400 cursor-not-allowed'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      {uploadingPhoto ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t('reports.photos.uploading') || 'Uploading...'}
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          {t('reports.photos.uploadPhotos')}
                        </>
                      )}
                    </label>
                    <p className="text-[12px] text-ink-400">
                      {t('reports.photos.maxSize') || 'Max 10MB. JPG, PNG, or WebP.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Photo grid */}
              {report.photos.length === 0 ? (
                <div className="text-center py-8 bg-cream-100 rounded-md border border-dashed border-ink-200">
                  <Camera className="h-8 w-8 text-ink-300 mx-auto mb-2" />
                  <p className="text-body-s text-ink-400">{t('reports.photos.noPhotos') || 'No photos uploaded yet'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {report.photos.map((photo) => (
                    <div key={photo.id} className="relative group">
                      <div className="aspect-[4/3] bg-cream-100 rounded-md overflow-hidden">
                        {photoUrls[photo.storage_path] ? (
                          <img
                            src={photoUrls[photo.storage_path]}
                            alt={photo.caption || photo.category}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-ink-300">
                            <Loader2 className="h-5 w-5 animate-spin" />
                          </div>
                        )}
                      </div>
                      <div className="mt-1">
                        <p className="text-[11px] font-medium text-ink-500 capitalize">
                          {photo.category.replace('_', ' ')}
                        </p>
                        {photo.caption && (
                          <p className="text-[11px] text-ink-400 truncate">{photo.caption}</p>
                        )}
                      </div>
                      {!isReadOnly && (
                        <button
                          onClick={() => deletePhoto(photo.id)}
                          className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          title={t('reports.photos.deletePhoto') || 'Delete photo'}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Section 10: Declarations */}
            <section id="section-declarations" className="bg-cream-50 rounded-lg border border-ink-100 p-6">
              <h2 className="text-h5 text-ink-600 mb-6 flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-emerald-500" />
                {t('reports.declarations.title')}
              </h2>
              <div className="space-y-4">
                <p className="text-body-s text-ink-500">
                  By finalizing this report, you confirm compliance with FRA standards and professional ethics.
                </p>
                <p className="text-[12px] text-ink-400 italic">
                  Declaration checkboxes will appear during finalization.
                </p>
              </div>
            </section>
          </div>
        </div>

        {/* Right sidebar - Live calculations */}
        <div className="fixed right-0 top-32 bottom-0 w-72 bg-cream-50 border-l border-ink-100 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-[11px] font-medium text-ink-400 uppercase tracking-wider mb-4">
              {t('reports.liveCalculations', 'Live Calculations')}
            </h3>

            <div className="space-y-4">
              {/* Cost Approach */}
              <div className="p-3 rounded-md bg-cream-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] text-ink-400">{t('reports.reconciliation.methods.cost')}</span>
                  {report.chosen_method === 'cost' && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                      {t('reports.chosen', 'Chosen')}
                    </span>
                  )}
                </div>
                <p className="text-body-m font-medium text-ink-600">
                  {liveValues?.cost ? `EGP ${formatEGP(liveValues.cost.total)}` : '-'}
                </p>
              </div>

              {/* Sales Comparison */}
              <div className="p-3 rounded-md bg-cream-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] text-ink-400">{t('reports.reconciliation.methods.sales_comparison')}</span>
                  {report.chosen_method === 'sales_comparison' && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                      {t('reports.chosen', 'Chosen')}
                    </span>
                  )}
                </div>
                <p className="text-body-m font-medium text-ink-600">
                  {report.sales_final_value ? `EGP ${formatEGP(report.sales_final_value)}` : '-'}
                </p>
              </div>

              {/* Income Approach */}
              <div className="p-3 rounded-md bg-cream-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] text-ink-400">{t('reports.reconciliation.methods.income')}</span>
                  {report.chosen_method === 'income' && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                      {t('reports.chosen', 'Chosen')}
                    </span>
                  )}
                </div>
                <p className="text-body-m font-medium text-ink-600">
                  {liveValues?.income ? `EGP ${formatEGP(liveValues.income.total)}` : '-'}
                </p>
              </div>

              {/* GRM */}
              <div className="p-3 rounded-md bg-cream-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] text-ink-400">{t('reports.reconciliation.methods.grm')}</span>
                  {report.chosen_method === 'grm' && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                      {t('reports.chosen', 'Chosen')}
                    </span>
                  )}
                </div>
                <p className="text-body-m font-medium text-ink-600">
                  {liveValues?.grm ? `EGP ${formatEGP(liveValues.grm.total)}` : '-'}
                </p>
              </div>

              {/* Final Value */}
              {report.final_value && (
                <div className="p-3 rounded-md bg-emerald-100 mt-6">
                  <span className="text-[12px] text-emerald-700 mb-1 block">{t('reports.reconciliation.finalValue')}</span>
                  <p className="text-h4 font-medium text-emerald-700">
                    EGP {formatEGP(report.final_value)}
                  </p>
                  {report.land_value && (
                    <p className="text-[12px] text-emerald-600 mt-1">
                      {t('reports.reconciliation.landValue')}: EGP {formatEGP(report.land_value)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Comparable Modal */}
      {comparableModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-cream-50 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-ink-100 flex items-center justify-between sticky top-0 bg-cream-50">
              <h3 className="text-h5 text-ink-600">
                {editingComparable.id ? t('reports.sales.editComparable') || 'Edit Comparable' : t('reports.sales.addComparable')}
              </h3>
              <button
                onClick={() => setComparableModalOpen(false)}
                className="p-1 text-ink-400 hover:text-ink-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[11px] font-medium text-ink-400 uppercase tracking-wider block mb-2">
                    {t('reports.sales.address')} *
                  </label>
                  <input
                    type="text"
                    value={editingComparable.address}
                    onChange={(e) => setEditingComparable({ ...editingComparable, address: e.target.value })}
                    className="w-full bg-cream-100 border border-ink-100 rounded-md px-3 py-2 text-body-s"
                    placeholder={t('reports.sales.addressPlaceholder') || 'e.g., 15 Ahmed Orabi St, Mohandessin'}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-ink-400 uppercase tracking-wider block mb-2">
                    {t('reports.sales.source')} *
                  </label>
                  <input
                    type="text"
                    value={editingComparable.source}
                    onChange={(e) => setEditingComparable({ ...editingComparable, source: e.target.value })}
                    className="w-full bg-cream-100 border border-ink-100 rounded-md px-3 py-2 text-body-s"
                    placeholder={t('reports.sales.sourcePlaceholder') || 'e.g., OLX, Aqarmap, Direct'}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-ink-400 uppercase tracking-wider block mb-2">
                    {t('reports.sales.saleTiming')}
                  </label>
                  <select
                    value={editingComparable.sale_timing}
                    onChange={(e) => setEditingComparable({ ...editingComparable, sale_timing: e.target.value as any })}
                    className="w-full bg-cream-100 border border-ink-100 rounded-md px-3 py-2 text-body-s"
                  >
                    <option value="current_offer">{t('reports.sales.saleTimings.current_offer')}</option>
                    <option value="recent_sale">{t('reports.sales.saleTimings.recent_sale')}</option>
                    <option value="historical">{t('reports.sales.saleTimings.historical')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-ink-400 uppercase tracking-wider block mb-2">
                    {t('reports.identification.tenancy')}
                  </label>
                  <select
                    value={editingComparable.tenancy}
                    onChange={(e) => setEditingComparable({ ...editingComparable, tenancy: e.target.value as any })}
                    className="w-full bg-cream-100 border border-ink-100 rounded-md px-3 py-2 text-body-s"
                  >
                    <option value="owner_occupied">{t('reports.identification.tenancyTypes.owner_occupied')}</option>
                    <option value="vacant">{t('reports.identification.tenancyTypes.vacant')}</option>
                    <option value="rented">{t('reports.identification.tenancyTypes.rented')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-ink-400 uppercase tracking-wider block mb-2">
                    {t('reports.sales.paymentTerms')}
                  </label>
                  <select
                    value={editingComparable.payment_terms}
                    onChange={(e) => setEditingComparable({ ...editingComparable, payment_terms: e.target.value as any })}
                    className="w-full bg-cream-100 border border-ink-100 rounded-md px-3 py-2 text-body-s"
                  >
                    <option value="cash">{t('reports.sales.paymentTermsOptions.cash')}</option>
                    <option value="installments">{t('reports.sales.paymentTermsOptions.installments')}</option>
                    <option value="mortgage">{t('reports.sales.paymentTermsOptions.mortgage')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-ink-400 uppercase tracking-wider block mb-2">
                    {t('reports.sales.buildingArea')} *
                  </label>
                  <input
                    type="number"
                    value={editingComparable.building_area_sqm}
                    onChange={(e) => setEditingComparable({ ...editingComparable, building_area_sqm: e.target.value })}
                    className="w-full bg-cream-100 border border-ink-100 rounded-md px-3 py-2 text-body-s"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-ink-400 uppercase tracking-wider block mb-2">
                    {t('reports.sales.landArea')} *
                  </label>
                  <input
                    type="number"
                    value={editingComparable.land_area_sqm}
                    onChange={(e) => setEditingComparable({ ...editingComparable, land_area_sqm: e.target.value })}
                    className="w-full bg-cream-100 border border-ink-100 rounded-md px-3 py-2 text-body-s"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-ink-400 uppercase tracking-wider block mb-2">
                    {t('reports.sales.salePrice')} *
                  </label>
                  <input
                    type="number"
                    value={editingComparable.sale_price}
                    onChange={(e) => setEditingComparable({ ...editingComparable, sale_price: e.target.value })}
                    className="w-full bg-cream-100 border border-ink-100 rounded-md px-3 py-2 text-body-s"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-ink-400 uppercase tracking-wider block mb-2">
                    {t('reports.sales.buildingPricePerSqm')} *
                  </label>
                  <input
                    type="number"
                    value={editingComparable.building_price_per_sqm}
                    onChange={(e) => setEditingComparable({ ...editingComparable, building_price_per_sqm: e.target.value })}
                    className="w-full bg-cream-100 border border-ink-100 rounded-md px-3 py-2 text-body-s"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-ink-400 uppercase tracking-wider block mb-2">
                    {t('reports.sales.floor')}
                  </label>
                  <input
                    type="text"
                    value={editingComparable.floor}
                    onChange={(e) => setEditingComparable({ ...editingComparable, floor: e.target.value })}
                    className="w-full bg-cream-100 border border-ink-100 rounded-md px-3 py-2 text-body-s"
                    placeholder={t('reports.sales.floorPlaceholder') || 'e.g., Ground, 3rd'}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-ink-400 uppercase tracking-wider block mb-2">
                    {t('reports.sales.ageYears')}
                  </label>
                  <input
                    type="number"
                    value={editingComparable.age_years}
                    onChange={(e) => setEditingComparable({ ...editingComparable, age_years: e.target.value })}
                    className="w-full bg-cream-100 border border-ink-100 rounded-md px-3 py-2 text-body-s"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-ink-400 uppercase tracking-wider block mb-2">
                    {t('reports.physical.finishingLevel')}
                  </label>
                  <input
                    type="text"
                    value={editingComparable.finishing_level}
                    onChange={(e) => setEditingComparable({ ...editingComparable, finishing_level: e.target.value })}
                    className="w-full bg-cream-100 border border-ink-100 rounded-md px-3 py-2 text-body-s"
                    placeholder={t('reports.sales.finishingPlaceholder') || 'e.g., Super Lux, Full'}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-ink-400 uppercase tracking-wider block mb-2">
                    {t('reports.sales.condition')}
                  </label>
                  <input
                    type="text"
                    value={editingComparable.condition}
                    onChange={(e) => setEditingComparable({ ...editingComparable, condition: e.target.value })}
                    className="w-full bg-cream-100 border border-ink-100 rounded-md px-3 py-2 text-body-s"
                    placeholder={t('reports.sales.conditionPlaceholder') || 'e.g., Excellent, Good'}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-ink-400 uppercase tracking-wider block mb-2">
                    {t('reports.sales.weight')}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingComparable.weight}
                    onChange={(e) => setEditingComparable({ ...editingComparable, weight: e.target.value })}
                    className="w-full bg-cream-100 border border-ink-100 rounded-md px-3 py-2 text-body-s"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="comp-has-pool"
                    checked={editingComparable.has_pool}
                    onChange={(e) => setEditingComparable({ ...editingComparable, has_pool: e.target.checked })}
                    className="rounded border-ink-300"
                  />
                  <label htmlFor="comp-has-pool" className="text-body-s text-ink-600">
                    {t('reports.physical.hasPool')}
                  </label>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-ink-100 flex justify-end gap-3 sticky bottom-0 bg-cream-50">
              <Button variant="secondary" onClick={() => setComparableModalOpen(false)}>
                {t('common.cancel') || 'Cancel'}
              </Button>
              <Button
                onClick={saveComparable}
                disabled={comparableSaving || !editingComparable.address || !editingComparable.source || !editingComparable.building_area_sqm || !editingComparable.sale_price}
              >
                {comparableSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {t('reports.saving')}
                  </>
                ) : (
                  t('reports.sales.saveComparable') || 'Save Comparable'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Finalization Modal */}
      {finalizeModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-cream-50 rounded-lg w-full max-w-lg">
            <div className="p-4 border-b border-ink-100 flex items-center justify-between">
              <h3 className="text-h5 text-ink-600">Finalize Report</h3>
              <button
                onClick={() => setFinalizeModalOpen(false)}
                className="p-1 text-ink-400 hover:text-ink-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <div className="mb-6">
                <p className="text-body-s text-ink-500 mb-4">
                  By finalizing this report, you confirm the following declarations as required by FRA standards:
                </p>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={declarations.fraCompliance}
                      onChange={(e) => setDeclarations({ ...declarations, fraCompliance: e.target.checked })}
                      className="mt-0.5 rounded border-ink-300"
                    />
                    <span className="text-body-s text-ink-600">
                      This appraisal complies with all applicable FRA regulations and guidelines.
                    </span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={declarations.ethicsCompliance}
                      onChange={(e) => setDeclarations({ ...declarations, ethicsCompliance: e.target.checked })}
                      className="mt-0.5 rounded border-ink-300"
                    />
                    <span className="text-body-s text-ink-600">
                      I have adhered to all professional ethics and standards of practice.
                    </span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={declarations.independenceConfirm}
                      onChange={(e) => setDeclarations({ ...declarations, independenceConfirm: e.target.checked })}
                      className="mt-0.5 rounded border-ink-300"
                    />
                    <span className="text-body-s text-ink-600">
                      I have no undisclosed interest in the property and my fee is not contingent on the value reported.
                    </span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={declarations.dataAccuracy}
                      onChange={(e) => setDeclarations({ ...declarations, dataAccuracy: e.target.checked })}
                      className="mt-0.5 rounded border-ink-300"
                    />
                    <span className="text-body-s text-ink-600">
                      All data and information provided in this report is accurate to the best of my knowledge.
                    </span>
                  </label>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-body-s text-red-700">
                  {error}
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4">
                <p className="text-body-s text-amber-800">
                  <strong>Note:</strong> Once finalized, this report cannot be edited. A PDF will be generated and the valuation will be recorded for analytics.
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-ink-100 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setFinalizeModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleFinalize}
                disabled={finalizing || !Object.values(declarations).every(Boolean)}
              >
                {finalizing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Finalizing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Finalize Report
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper components
function InputField({
  label,
  value,
  onChange,
  type = 'text',
  disabled = false,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-[11px] font-medium text-ink-400 uppercase tracking-wider block mb-2">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full bg-cream-100 border border-ink-100 rounded-md px-3 py-2 text-body-s text-ink-600 focus:border-emerald-500 focus:outline-none disabled:opacity-60"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled = false,
  required = false,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-[11px] font-medium text-ink-400 uppercase tracking-wider block mb-2">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : null)}
        disabled={disabled}
        className="w-full bg-cream-100 border border-ink-100 rounded-md px-3 py-2 text-body-s text-ink-600 focus:border-emerald-500 focus:outline-none disabled:opacity-60"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-[11px] font-medium text-ink-400 uppercase tracking-wider block mb-2">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full bg-cream-100 border border-ink-100 rounded-md px-3 py-2 text-body-s text-ink-600 focus:border-emerald-500 focus:outline-none disabled:opacity-60"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default ReportEditorPage;
