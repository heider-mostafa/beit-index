import * as React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input, Badge } from '@/src/components/ui';
import { SignaturePad } from '@/src/components/SignaturePad';
import { useAuth } from '@/src/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/src/lib/supabase/browser';
import type { OnboardingDraftData, AvailabilityStatus } from '@/src/lib/supabase/types';
import {
  Check,
  Upload,
  X,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Loader2,
  Save,
  Image,
  FileText,
} from 'lucide-react';

// Step schemas
const step1Schema = z.object({
  fullNameEn: z.string().min(2, 'Name is required'),
  fullNameAr: z.string().optional(),
  phone: z.string().regex(/^\+20\s?1[0125]\d{8}$/, 'Enter a valid Egyptian phone number (+20 1XXXXXXXXX)'),
  yearsExperience: z.number().min(1, 'Must have at least 1 year of experience').max(50),
  professionalTitle: z.string().min(5, 'Enter a professional title'),
});

const step2Schema = z.object({
  fraLicenseNumber: z.string().min(3, 'FRA license number is required'),
  fraLicenseIssueDate: z.string().min(1, 'Issue date is required'),
  fraLicenseExpiryDate: z.string().min(1, 'Expiry date is required'),
});

const step3Schema = z.object({
  nationalIdNumber: z.string().length(14, 'National ID must be 14 digits').regex(/^\d+$/, 'Only numbers allowed'),
});

const step4Schema = z.object({
  selectedDistrictIds: z.array(z.string()).min(1, 'Select at least one service area'),
});

const step5Schema = z.object({
  specialties: z.array(z.object({
    propertyTypeId: z.string(),
    yearsExperience: z.number().min(1),
  })).min(1, 'Select at least one specialty'),
});

const step6Schema = z.object({
  bioEn: z.string().min(100, 'Bio must be at least 100 characters').max(1000, 'Bio cannot exceed 1000 characters'),
  bioAr: z.string().optional(),
  startingPriceEgp: z.number().min(500, 'Minimum price is 500 EGP'),
  typicalTurnaroundDays: z.number().min(1, 'Minimum 1 day').max(30, 'Maximum 30 days'),
  availability: z.enum(['this_week', 'next_week', 'two_weeks']),
  codeOfConductAccepted: z.literal(true, { message: 'You must accept the code of conduct' }),
});

const STEPS = [
  { id: 1, title: 'Personal info', icon: '1' },
  { id: 2, title: 'FRA License', icon: '2' },
  { id: 3, title: 'National ID', icon: '3' },
  { id: 4, title: 'Service areas', icon: '4' },
  { id: 5, title: 'Specialties', icon: '5' },
  { id: 6, title: 'Final details', icon: '6' },
];

interface UploadedFile {
  storagePath: string;
  documentType: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
}

interface GazetteerDistrict {
  id: string;
  name_en: string;
  name_ar: string;
  city_id: string;
  cities: {
    name_en: string;
    name_ar: string;
    governorate_id: string;
    governorates: {
      name_en: string;
      name_ar: string;
    };
  };
}

interface PropertyType {
  id: string;
  name_en: string;
  name_ar: string;
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const { profile, session } = useAuth();

  const [currentStep, setCurrentStep] = React.useState(1);
  const [draftData, setDraftData] = React.useState<OnboardingDraftData>({});
  const [uploadedFiles, setUploadedFiles] = React.useState<UploadedFile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [lastSaved, setLastSaved] = React.useState<Date | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Gazetteer data
  const [districts, setDistricts] = React.useState<GazetteerDistrict[]>([]);
  const [propertyTypes, setPropertyTypes] = React.useState<PropertyType[]>([]);

  // File upload states
  const [uploadingPhoto, setUploadingPhoto] = React.useState(false);
  const [uploadingLicense, setUploadingLicense] = React.useState(false);
  const [uploadingIdFront, setUploadingIdFront] = React.useState(false);
  const [uploadingIdBack, setUploadingIdBack] = React.useState(false);
  const [uploadingSignature, setUploadingSignature] = React.useState(false);
  const [uploadingStamp, setUploadingStamp] = React.useState(false);

  // Load draft on mount
  React.useEffect(() => {
    if (!session?.access_token) return;

    const loadDraft = async () => {
      try {
        const res = await fetch('/api/onboarding/draft', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const draft = await res.json();
          setCurrentStep(draft.current_step || 1);
          setDraftData(draft.draft_data || {});
          setUploadedFiles(draft.uploaded_files || []);
        }
      } catch (err) {
        console.error('Error loading draft:', err);
      }
      setLoading(false);
    };

    loadDraft();
  }, [session]);

  // Load gazetteer data
  React.useEffect(() => {
    const loadGazetteer = async () => {
      try {
        const [districtsRes, typesRes] = await Promise.all([
          fetch('/api/gazetteer/districts'),
          fetch('/api/gazetteer/property-types'),
        ]);

        if (districtsRes.ok) {
          const data = await districtsRes.json();
          // The endpoint returns { districts: [...] }; tolerate a bare array too.
          setDistricts(Array.isArray(data) ? data : data.districts || []);
        }

        if (typesRes.ok) {
          const data = await typesRes.json();
          setPropertyTypes(data);
        }
      } catch (err) {
        console.error('Error loading gazetteer:', err);
      }
    };

    loadGazetteer();
  }, []);

  // Save draft to server
  const saveDraft = async (data: Partial<OnboardingDraftData>, step?: number) => {
    if (!session?.access_token) return;

    setSaving(true);
    try {
      const res = await fetch('/api/onboarding/draft', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          currentStep: step,
          draftData: { ...draftData, ...data },
          uploadedFiles,
        }),
      });

      if (res.ok) {
        setDraftData((prev) => ({ ...prev, ...data }));
        setLastSaved(new Date());
      }
    } catch (err) {
      console.error('Error saving draft:', err);
    }
    setSaving(false);
  };

  // File upload handler
  const uploadFile = async (
    file: File,
    bucket: 'verification-docs' | 'appraiser-assets',
    documentType: string,
    setUploading: (v: boolean) => void,
    storagePropName: keyof OnboardingDraftData
  ) => {
    if (!session?.access_token) return;

    setUploading(true);
    setError(null);

    try {
      // Get signed upload URL
      const urlRes = await fetch('/api/upload/get-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          bucket,
          filename: file.name,
          contentType: file.type,
        }),
      });

      if (!urlRes.ok) throw new Error('Failed to get upload URL');

      const { signedUrl, storagePath } = await urlRes.json();

      // Upload file
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      if (!uploadRes.ok) throw new Error('Failed to upload file');

      // Update uploaded files list
      const newFile: UploadedFile = {
        storagePath,
        documentType,
        originalFilename: file.name,
        mimeType: file.type,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
      };

      setUploadedFiles((prev) => {
        const filtered = prev.filter((f) => f.documentType !== documentType);
        return [...filtered, newFile];
      });

      // Save to draft
      await saveDraft({ [storagePropName]: storagePath } as Partial<OnboardingDraftData>);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload file. Please try again.');
    }

    setUploading(false);
  };

  // Handle step navigation
  const goToStep = (step: number) => {
    if (step >= 1 && step <= 6) {
      saveDraft({}, step);
      setCurrentStep(step);
    }
  };

  // Submit onboarding
  const handleSubmit = async () => {
    if (!session?.access_token) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/onboarding/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Submission failed');
      }

      navigate('/onboarding/under-review');
    } catch (err) {
      setError((err as Error).message);
    }

    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-100">
      <div className="max-w-7xl mx-auto px-5 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-h3 text-ink-600">Complete your profile</h1>
          <div className="flex items-center gap-4">
            {lastSaved && (
              <span className="text-[11px] text-ink-300 flex items-center gap-1">
                <Save className="h-3 w-3" />
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
            <Link to="/" className="text-body-s text-ink-400 hover:text-ink-600">
              Save & exit
            </Link>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Progress sidebar */}
          <div className="w-64 flex-shrink-0">
            <div className="sticky top-24 bg-cream-50 rounded-lg p-6 border-hairline">
              <div className="space-y-4">
                {STEPS.map((step, idx) => (
                  <button
                    key={step.id}
                    onClick={() => goToStep(step.id)}
                    className={`flex items-center gap-3 w-full text-left transition-colors ${
                      currentStep === step.id
                        ? 'text-emerald-600'
                        : currentStep > step.id
                        ? 'text-ink-400'
                        : 'text-ink-200'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-medium ${
                        currentStep === step.id
                          ? 'bg-emerald-500 text-white'
                          : currentStep > step.id
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'bg-ink-100 text-ink-300'
                      }`}
                    >
                      {currentStep > step.id ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        step.id
                      )}
                    </div>
                    <span className="text-body-s font-medium">{step.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 max-w-2xl">
            <div className="bg-cream-50 rounded-lg p-8 border-hairline">
              {error && (
                <div className="mb-6 flex items-start gap-2 p-4 bg-red-50 border border-red-100 rounded-sm text-[13px] text-red-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Step content */}
              {currentStep === 1 && (
                <Step1PersonalInfo
                  draftData={draftData}
                  onSave={saveDraft}
                  onNext={() => goToStep(2)}
                  uploadingPhoto={uploadingPhoto}
                  onPhotoUpload={(file) =>
                    uploadFile(file, 'appraiser-assets', 'photo', setUploadingPhoto, 'photoStoragePath')
                  }
                />
              )}

              {currentStep === 2 && (
                <Step2FRALicense
                  draftData={draftData}
                  onSave={saveDraft}
                  onNext={() => goToStep(3)}
                  onBack={() => goToStep(1)}
                  uploadingLicense={uploadingLicense}
                  onLicenseUpload={(file) =>
                    uploadFile(file, 'verification-docs', 'fra_license', setUploadingLicense, 'fraLicenseStoragePath')
                  }
                />
              )}

              {currentStep === 3 && (
                <Step3NationalID
                  draftData={draftData}
                  onSave={saveDraft}
                  onNext={() => goToStep(4)}
                  onBack={() => goToStep(2)}
                  uploadingIdFront={uploadingIdFront}
                  uploadingIdBack={uploadingIdBack}
                  onIdFrontUpload={(file) =>
                    uploadFile(file, 'verification-docs', 'national_id_front', setUploadingIdFront, 'nationalIdFrontStoragePath')
                  }
                  onIdBackUpload={(file) =>
                    uploadFile(file, 'verification-docs', 'national_id_back', setUploadingIdBack, 'nationalIdBackStoragePath')
                  }
                />
              )}

              {currentStep === 4 && (
                <Step4ServiceAreas
                  draftData={draftData}
                  districts={districts}
                  onSave={saveDraft}
                  onNext={() => goToStep(5)}
                  onBack={() => goToStep(3)}
                />
              )}

              {currentStep === 5 && (
                <Step5Specialties
                  draftData={draftData}
                  propertyTypes={propertyTypes}
                  onSave={saveDraft}
                  onNext={() => goToStep(6)}
                  onBack={() => goToStep(4)}
                />
              )}

              {currentStep === 6 && (
                <Step6FinalDetails
                  draftData={draftData}
                  uploadedFiles={uploadedFiles}
                  onSave={saveDraft}
                  onBack={() => goToStep(5)}
                  onSubmit={handleSubmit}
                  submitting={submitting}
                  uploadingSignature={uploadingSignature}
                  uploadingStamp={uploadingStamp}
                  onSignatureUpload={(file) =>
                    uploadFile(file, 'appraiser-assets', 'signature', setUploadingSignature, 'signatureStoragePath')
                  }
                  onStampUpload={(file) =>
                    uploadFile(file, 'appraiser-assets', 'stamp', setUploadingStamp, 'stampStoragePath')
                  }
                  goToStep={goToStep}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Step 1: Personal Info
function Step1PersonalInfo({
  draftData,
  onSave,
  onNext,
  uploadingPhoto,
  onPhotoUpload,
}: {
  draftData: OnboardingDraftData;
  onSave: (data: Partial<OnboardingDraftData>) => Promise<void>;
  onNext: () => void;
  uploadingPhoto: boolean;
  onPhotoUpload: (file: File) => void;
}) {
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      fullNameEn: draftData.fullNameEn || '',
      fullNameAr: draftData.fullNameAr || '',
      phone: draftData.phone || '+20 ',
      yearsExperience: draftData.yearsExperience || 1,
      professionalTitle: draftData.professionalTitle || '',
    },
  });

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const onSubmit = async (data: z.infer<typeof step1Schema>) => {
    await onSave(data);
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <h2 className="text-h3 text-ink-600 mb-6">Personal information</h2>

      {/* Photo upload */}
      <div className="mb-8">
        <label className="eyebrow text-ink-300 mb-3 block">Profile photo</label>
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-ink-100 flex items-center justify-center overflow-hidden">
            {draftData.photoStoragePath ? (
              <img
                src={`/api/download/get-url?bucket=appraiser-assets&storagePath=${draftData.photoStoragePath}`}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <Image className="h-8 w-8 text-ink-200" />
            )}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onPhotoUpload(file);
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Upload photo
            </Button>
            <p className="text-[11px] text-ink-300 mt-2">JPG or PNG, max 5MB</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <Input
            label="Full name (English)"
            {...register('fullNameEn')}
            onBlur={(e) => onSave({ fullNameEn: e.target.value })}
          />
          {errors.fullNameEn && (
            <p className="text-[11px] text-red-600 mt-1">{errors.fullNameEn.message}</p>
          )}
        </div>
        <div>
          <Input
            label="Full name (Arabic)"
            {...register('fullNameAr')}
            onBlur={(e) => onSave({ fullNameAr: e.target.value })}
            dir="rtl"
          />
        </div>
      </div>

      <div>
        <Input
          label="Phone number"
          {...register('phone')}
          placeholder="+20 1XXXXXXXXX"
          onBlur={(e) => onSave({ phone: e.target.value })}
        />
        {errors.phone && (
          <p className="text-[11px] text-red-600 mt-1">{errors.phone.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <Input
            label="Years of experience"
            type="number"
            {...register('yearsExperience', { valueAsNumber: true })}
            onBlur={(e) => onSave({ yearsExperience: parseInt(e.target.value) })}
          />
          {errors.yearsExperience && (
            <p className="text-[11px] text-red-600 mt-1">{errors.yearsExperience.message}</p>
          )}
        </div>
        <div>
          <Input
            label="Professional title"
            {...register('professionalTitle')}
            placeholder="Senior Real Estate Appraiser"
            onBlur={(e) => onSave({ professionalTitle: e.target.value })}
          />
          {errors.professionalTitle && (
            <p className="text-[11px] text-red-600 mt-1">{errors.professionalTitle.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-6">
        <Button type="submit">
          Next <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </form>
  );
}

// Step 2: FRA License
function Step2FRALicense({
  draftData,
  onSave,
  onNext,
  onBack,
  uploadingLicense,
  onLicenseUpload,
}: {
  draftData: OnboardingDraftData;
  onSave: (data: Partial<OnboardingDraftData>) => Promise<void>;
  onNext: () => void;
  onBack: () => void;
  uploadingLicense: boolean;
  onLicenseUpload: (file: File) => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      fraLicenseNumber: draftData.fraLicenseNumber || '',
      fraLicenseIssueDate: draftData.fraLicenseIssueDate || '',
      fraLicenseExpiryDate: draftData.fraLicenseExpiryDate || '',
    },
  });

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const onSubmit = async (data: z.infer<typeof step2Schema>) => {
    if (!draftData.fraLicenseStoragePath) {
      return;
    }
    await onSave(data);
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <h2 className="text-h3 text-ink-600 mb-6">FRA License</h2>

      <div>
        <Input
          label="FRA license number"
          {...register('fraLicenseNumber')}
          placeholder="FRA-XXXX"
          onBlur={(e) => onSave({ fraLicenseNumber: e.target.value })}
        />
        {errors.fraLicenseNumber && (
          <p className="text-[11px] text-red-600 mt-1">{errors.fraLicenseNumber.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <Input
            label="Issue date"
            type="date"
            {...register('fraLicenseIssueDate')}
            onBlur={(e) => onSave({ fraLicenseIssueDate: e.target.value })}
          />
          {errors.fraLicenseIssueDate && (
            <p className="text-[11px] text-red-600 mt-1">{errors.fraLicenseIssueDate.message}</p>
          )}
        </div>
        <div>
          <Input
            label="Expiry date"
            type="date"
            {...register('fraLicenseExpiryDate')}
            onBlur={(e) => onSave({ fraLicenseExpiryDate: e.target.value })}
          />
          {errors.fraLicenseExpiryDate && (
            <p className="text-[11px] text-red-600 mt-1">{errors.fraLicenseExpiryDate.message}</p>
          )}
        </div>
      </div>

      {/* License upload */}
      <div>
        <label className="eyebrow text-ink-300 mb-3 block">License document</label>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center ${
            draftData.fraLicenseStoragePath ? 'border-emerald-300 bg-emerald-50' : 'border-ink-200'
          }`}
        >
          {draftData.fraLicenseStoragePath ? (
            <div className="flex items-center justify-center gap-2 text-emerald-700">
              <FileText className="h-5 w-5" />
              <span className="text-body-s">License uploaded</span>
              <Check className="h-4 w-4" />
            </div>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onLicenseUpload(file);
                }}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLicense}
              >
                {uploadingLicense ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Upload license
              </Button>
              <p className="text-[11px] text-ink-300 mt-2">PDF or image, max 10MB</p>
            </>
          )}
        </div>
        {!draftData.fraLicenseStoragePath && (
          <p className="text-[11px] text-red-600 mt-1">License document is required</p>
        )}
      </div>

      <div className="flex justify-between pt-6">
        <Button type="button" variant="secondary" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button type="submit" disabled={!draftData.fraLicenseStoragePath}>
          Next <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </form>
  );
}

// Step 3: National ID
function Step3NationalID({
  draftData,
  onSave,
  onNext,
  onBack,
  uploadingIdFront,
  uploadingIdBack,
  onIdFrontUpload,
  onIdBackUpload,
}: {
  draftData: OnboardingDraftData;
  onSave: (data: Partial<OnboardingDraftData>) => Promise<void>;
  onNext: () => void;
  onBack: () => void;
  uploadingIdFront: boolean;
  uploadingIdBack: boolean;
  onIdFrontUpload: (file: File) => void;
  onIdBackUpload: (file: File) => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      nationalIdNumber: draftData.nationalIdNumber || '',
    },
  });

  const frontInputRef = React.useRef<HTMLInputElement>(null);
  const backInputRef = React.useRef<HTMLInputElement>(null);

  const onSubmit = async (data: z.infer<typeof step3Schema>) => {
    if (!draftData.nationalIdFrontStoragePath || !draftData.nationalIdBackStoragePath) {
      return;
    }
    await onSave(data);
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <h2 className="text-h3 text-ink-600 mb-2">National ID</h2>
      <p className="text-body-s text-ink-400 mb-6">
        Your ID is used solely for FRA verification and is never shared with clients.
      </p>

      <div>
        <Input
          label="National ID number"
          {...register('nationalIdNumber')}
          placeholder="14-digit number"
          maxLength={14}
          onBlur={(e) => onSave({ nationalIdNumber: e.target.value })}
        />
        {errors.nationalIdNumber && (
          <p className="text-[11px] text-red-600 mt-1">{errors.nationalIdNumber.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Front upload */}
        <div>
          <label className="eyebrow text-ink-300 mb-3 block">Front of ID</label>
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center ${
              draftData.nationalIdFrontStoragePath ? 'border-emerald-300 bg-emerald-50' : 'border-ink-200'
            }`}
          >
            {draftData.nationalIdFrontStoragePath ? (
              <div className="flex items-center justify-center gap-2 text-emerald-700">
                <Check className="h-4 w-4" />
                <span className="text-[12px]">Uploaded</span>
              </div>
            ) : (
              <>
                <input
                  ref={frontInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onIdFrontUpload(file);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => frontInputRef.current?.click()}
                  disabled={uploadingIdFront}
                  className="text-ink-400"
                >
                  {uploadingIdFront ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Back upload */}
        <div>
          <label className="eyebrow text-ink-300 mb-3 block">Back of ID</label>
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center ${
              draftData.nationalIdBackStoragePath ? 'border-emerald-300 bg-emerald-50' : 'border-ink-200'
            }`}
          >
            {draftData.nationalIdBackStoragePath ? (
              <div className="flex items-center justify-center gap-2 text-emerald-700">
                <Check className="h-4 w-4" />
                <span className="text-[12px]">Uploaded</span>
              </div>
            ) : (
              <>
                <input
                  ref={backInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onIdBackUpload(file);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => backInputRef.current?.click()}
                  disabled={uploadingIdBack}
                  className="text-ink-400"
                >
                  {uploadingIdBack ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {(!draftData.nationalIdFrontStoragePath || !draftData.nationalIdBackStoragePath) && (
        <p className="text-[11px] text-red-600">Both ID images are required</p>
      )}

      <div className="flex justify-between pt-6">
        <Button type="button" variant="secondary" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button
          type="submit"
          disabled={!draftData.nationalIdFrontStoragePath || !draftData.nationalIdBackStoragePath}
        >
          Next <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </form>
  );
}

// Step 4: Service Areas
function Step4ServiceAreas({
  draftData,
  districts,
  onSave,
  onNext,
  onBack,
}: {
  draftData: OnboardingDraftData;
  districts: GazetteerDistrict[];
  onSave: (data: Partial<OnboardingDraftData>) => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}) {
  const [selectedIds, setSelectedIds] = React.useState<string[]>(
    draftData.selectedDistrictIds || []
  );
  const [expandedCity, setExpandedCity] = React.useState<string | null>(null);

  // Group districts by city
  const citiesMap = React.useMemo(() => {
    const map = new Map<string, { city: GazetteerDistrict['cities']; districts: GazetteerDistrict[] }>();
    districts.forEach((d) => {
      if (!map.has(d.city_id)) {
        map.set(d.city_id, { city: d.cities, districts: [] });
      }
      map.get(d.city_id)!.districts.push(d);
    });
    return map;
  }, [districts]);

  const toggleDistrict = (id: string) => {
    const newIds = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    setSelectedIds(newIds);
  };

  const selectAllInCity = (cityId: string) => {
    const cityDistricts = citiesMap.get(cityId)?.districts || [];
    const cityDistrictIds = cityDistricts.map((d) => d.id);
    const allSelected = cityDistrictIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      setSelectedIds(selectedIds.filter((id) => !cityDistrictIds.includes(id)));
    } else {
      setSelectedIds([...new Set([...selectedIds, ...cityDistrictIds])]);
    }
  };

  const handleNext = async () => {
    if (selectedIds.length === 0) return;
    await onSave({ selectedDistrictIds: selectedIds });
    onNext();
  };

  const selectedDistricts = districts.filter((d) => selectedIds.includes(d.id));

  return (
    <div className="space-y-6">
      <h2 className="text-h3 text-ink-600 mb-6">Service areas</h2>

      {/* Selected chips */}
      {selectedDistricts.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {selectedDistricts.map((d) => (
            <Badge key={d.id} className="bg-emerald-100 text-emerald-700 flex items-center gap-1">
              {d.name_en}
              <button onClick={() => toggleDistrict(d.id)}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* City/District selector */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {Array.from(citiesMap.entries()).map(([cityId, { city, districts: cityDistricts }]) => (
          <div key={cityId} className="border-hairline rounded-md">
            <button
              type="button"
              className="w-full flex items-center justify-between p-3 text-left hover:bg-cream-200"
              onClick={() => setExpandedCity(expandedCity === cityId ? null : cityId)}
            >
              <span className="text-body-s font-medium text-ink-600">
                {city.name_en}, {city.governorates.name_en}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-[11px] text-emerald-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    selectAllInCity(cityId);
                  }}
                >
                  {cityDistricts.every((d) => selectedIds.includes(d.id)) ? 'Deselect all' : 'Select all'}
                </Button>
                <ChevronRight
                  className={`h-4 w-4 text-ink-300 transition-transform ${
                    expandedCity === cityId ? 'rotate-90' : ''
                  }`}
                />
              </div>
            </button>

            {expandedCity === cityId && (
              <div className="px-3 pb-3 grid grid-cols-2 gap-2">
                {cityDistricts.map((district) => (
                  <label
                    key={district.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-cream-200 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(district.id)}
                      onChange={() => toggleDistrict(district.id)}
                      className="w-4 h-4 rounded border-ink-200 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span className="text-body-s text-ink-500">{district.name_en}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedIds.length === 0 && (
        <p className="text-[11px] text-red-600">Select at least one service area</p>
      )}

      <div className="flex justify-between pt-6">
        <Button type="button" variant="secondary" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button onClick={handleNext} disabled={selectedIds.length === 0}>
          Next <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// Step 5: Specialties
function Step5Specialties({
  draftData,
  propertyTypes,
  onSave,
  onNext,
  onBack,
}: {
  draftData: OnboardingDraftData;
  propertyTypes: PropertyType[];
  onSave: (data: Partial<OnboardingDraftData>) => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}) {
  const [specialties, setSpecialties] = React.useState<Array<{ propertyTypeId: string; yearsExperience: number }>>(
    draftData.specialties || []
  );

  const toggleSpecialty = (typeId: string) => {
    const existing = specialties.find((s) => s.propertyTypeId === typeId);
    if (existing) {
      setSpecialties(specialties.filter((s) => s.propertyTypeId !== typeId));
    } else {
      setSpecialties([...specialties, { propertyTypeId: typeId, yearsExperience: 1 }]);
    }
  };

  const updateYears = (typeId: string, years: number) => {
    setSpecialties(
      specialties.map((s) =>
        s.propertyTypeId === typeId ? { ...s, yearsExperience: years } : s
      )
    );
  };

  const handleNext = async () => {
    if (specialties.length === 0) return;
    await onSave({ specialties });
    onNext();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-h3 text-ink-600 mb-6">Property type specialties</h2>

      <div className="grid grid-cols-2 gap-4">
        {propertyTypes.map((type) => {
          const selected = specialties.find((s) => s.propertyTypeId === type.id);
          return (
            <div
              key={type.id}
              className={`border rounded-md p-4 cursor-pointer transition-colors ${
                selected ? 'border-emerald-500 bg-emerald-50' : 'border-ink-200 hover:border-ink-300'
              }`}
              onClick={() => toggleSpecialty(type.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-body-s font-medium text-ink-600">{type.name_en}</span>
                {selected && <Check className="h-4 w-4 text-emerald-600" />}
              </div>

              {selected && (
                <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                  <label className="text-[11px] text-ink-400 block mb-1">Years of experience</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={selected.yearsExperience}
                    onChange={(e) => updateYears(type.id, parseInt(e.target.value) || 1)}
                    className="w-20 px-2 py-1 text-sm border border-ink-200 rounded focus:border-emerald-500 outline-none"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {specialties.length === 0 && (
        <p className="text-[11px] text-red-600">Select at least one specialty</p>
      )}

      <div className="flex justify-between pt-6">
        <Button type="button" variant="secondary" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button onClick={handleNext} disabled={specialties.length === 0}>
          Next <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// Step 6: Final Details & Review
function Step6FinalDetails({
  draftData,
  uploadedFiles,
  onSave,
  onBack,
  onSubmit,
  submitting,
  uploadingSignature,
  uploadingStamp,
  onSignatureUpload,
  onStampUpload,
  goToStep,
}: {
  draftData: OnboardingDraftData;
  uploadedFiles: UploadedFile[];
  onSave: (data: Partial<OnboardingDraftData>) => Promise<void>;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  uploadingSignature: boolean;
  uploadingStamp: boolean;
  onSignatureUpload: (file: File) => void;
  onStampUpload: (file: File) => void;
  goToStep: (step: number) => void;
}) {
  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<z.infer<typeof step6Schema>>({
    resolver: zodResolver(step6Schema),
    defaultValues: {
      bioEn: draftData.bioEn || '',
      bioAr: draftData.bioAr || '',
      startingPriceEgp: draftData.startingPriceEgp || 3000,
      typicalTurnaroundDays: draftData.typicalTurnaroundDays || 5,
      availability: (draftData.availability === 'unavailable' ? 'this_week' : draftData.availability) || 'this_week',
      codeOfConductAccepted: draftData.codeOfConductAccepted === true ? true : undefined as unknown as true,
    },
  });

  const bioEn = watch('bioEn');
  const stampRef = React.useRef<HTMLInputElement>(null);

  const onFormSubmit = async (data: z.infer<typeof step6Schema>) => {
    await onSave(data);
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      <h2 className="text-h3 text-ink-600 mb-6">Final details</h2>

      {/* Bio English */}
      <div>
        <label className="eyebrow text-ink-300 mb-2 block">Bio (English)</label>
        <textarea
          {...register('bioEn')}
          className="w-full h-32 px-3 py-2 border border-ink-200 rounded-md text-body-s focus:border-emerald-500 outline-none resize-none"
          placeholder="Write a professional summary of your experience and expertise..."
          onBlur={(e) => onSave({ bioEn: e.target.value })}
        />
        <div className="flex justify-between mt-1">
          {errors.bioEn && <p className="text-[11px] text-red-600">{errors.bioEn.message}</p>}
          <p className={`text-[11px] ml-auto ${bioEn.length < 100 ? 'text-red-600' : 'text-ink-300'}`}>
            {bioEn.length}/1000
          </p>
        </div>
      </div>

      {/* Bio Arabic */}
      <div>
        <label className="eyebrow text-ink-300 mb-2 block">Bio (Arabic, optional)</label>
        <textarea
          {...register('bioAr')}
          dir="rtl"
          className="w-full h-32 px-3 py-2 border border-ink-200 rounded-md text-body-s focus:border-emerald-500 outline-none resize-none"
          placeholder="اكتب ملخصًا احترافيًا لخبرتك..."
          onBlur={(e) => onSave({ bioAr: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div>
          <Input
            label="Starting price (EGP)"
            type="number"
            {...register('startingPriceEgp', { valueAsNumber: true })}
            onBlur={(e) => onSave({ startingPriceEgp: parseInt(e.target.value) })}
          />
          {errors.startingPriceEgp && (
            <p className="text-[11px] text-red-600 mt-1">{errors.startingPriceEgp.message}</p>
          )}
        </div>
        <div>
          <Input
            label="Turnaround (days)"
            type="number"
            {...register('typicalTurnaroundDays', { valueAsNumber: true })}
            onBlur={(e) => onSave({ typicalTurnaroundDays: parseInt(e.target.value) })}
          />
          {errors.typicalTurnaroundDays && (
            <p className="text-[11px] text-red-600 mt-1">{errors.typicalTurnaroundDays.message}</p>
          )}
        </div>
        <div>
          <label className="eyebrow text-ink-300 mb-2 block">Availability</label>
          <select
            {...register('availability')}
            onChange={(e) => onSave({ availability: e.target.value as AvailabilityStatus })}
            className="w-full px-3 py-2.5 border-b border-ink-200 bg-transparent text-base focus:border-emerald-500 outline-none"
          >
            <option value="this_week">This week</option>
            <option value="next_week">Next week</option>
            <option value="two_weeks">Two weeks out</option>
          </select>
        </div>
      </div>

      {/* Signature (draw pad) */}
      <div>
        <label className="eyebrow text-ink-300 mb-3 block">Signature</label>
        {draftData.signatureStoragePath && (
          <div className="flex items-center gap-2 text-emerald-700 mb-2 text-[12px]">
            <Check className="h-4 w-4" /> Signature saved — draw again to replace it.
          </div>
        )}
        <SignaturePad onSave={onSignatureUpload} saving={uploadingSignature} />
      </div>

      {/* Stamp/Seal */}
      <div className="max-w-xs">
        <div>
          <label className="eyebrow text-ink-300 mb-3 block">Stamp/Seal</label>
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center ${
              draftData.stampStoragePath ? 'border-emerald-300 bg-emerald-50' : 'border-ink-200'
            }`}
          >
            {draftData.stampStoragePath ? (
              <div className="flex items-center justify-center gap-2 text-emerald-700">
                <Check className="h-4 w-4" />
                <span className="text-[12px]">Uploaded</span>
              </div>
            ) : (
              <>
                <input
                  ref={stampRef}
                  type="file"
                  accept="image/png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onStampUpload(file);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => stampRef.current?.click()}
                  disabled={uploadingStamp}
                  className="text-ink-400"
                >
                  {uploadingStamp ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                </Button>
                <p className="text-[11px] text-ink-300 mt-2">PNG preferred</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Code of conduct */}
      <div className="p-4 bg-cream-200 rounded-md">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            {...register('codeOfConductAccepted')}
            onChange={(e) => onSave({ codeOfConductAccepted: e.target.checked })}
            className="mt-1 w-4 h-4 rounded border-ink-200 text-emerald-500 focus:ring-emerald-500"
          />
          <span className="text-body-s text-ink-600">
            I confirm all submitted documents are authentic, my FRA license is current and in good
            standing, and I agree to the Beit Index Code of Professional Conduct.
          </span>
        </label>
        {errors.codeOfConductAccepted && (
          <p className="text-[11px] text-red-600 mt-2">{errors.codeOfConductAccepted.message}</p>
        )}
      </div>

      {/* Review summary */}
      <div className="border-t border-ink-100 pt-6 mt-8">
        <h3 className="text-body-m font-medium text-ink-600 mb-4">Review your information</h3>
        <div className="space-y-4">
          <ReviewSection
            title="Personal info"
            onEdit={() => goToStep(1)}
            items={[
              { label: 'Name', value: draftData.fullNameEn },
              { label: 'Phone', value: draftData.phone },
              { label: 'Experience', value: `${draftData.yearsExperience} years` },
            ]}
          />
          <ReviewSection
            title="FRA License"
            onEdit={() => goToStep(2)}
            items={[
              { label: 'License #', value: draftData.fraLicenseNumber },
              { label: 'Expiry', value: draftData.fraLicenseExpiryDate },
            ]}
          />
          <ReviewSection
            title="Service areas"
            onEdit={() => goToStep(4)}
            items={[
              { label: 'Districts', value: `${draftData.selectedDistrictIds?.length || 0} selected` },
            ]}
          />
          <ReviewSection
            title="Specialties"
            onEdit={() => goToStep(5)}
            items={[
              { label: 'Types', value: `${draftData.specialties?.length || 0} selected` },
            ]}
          />
        </div>
      </div>

      <div className="flex justify-between pt-6">
        <Button type="button" variant="secondary" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Submitting...
            </>
          ) : (
            'Submit for verification'
          )}
        </Button>
      </div>
    </form>
  );
}

function ReviewSection({
  title,
  onEdit,
  items,
}: {
  title: string;
  onEdit: () => void;
  items: Array<{ label: string; value?: string | null }>;
}) {
  return (
    <div className="flex items-start justify-between p-3 bg-cream-100 rounded-md">
      <div>
        <p className="text-body-s font-medium text-ink-600 mb-1">{title}</p>
        <div className="text-[12px] text-ink-400 space-x-4">
          {items.map((item, idx) => (
            <span key={idx}>
              {item.label}: {item.value || '-'}
            </span>
          ))}
        </div>
      </div>
      <Button type="button" variant="ghost" onClick={onEdit} className="text-emerald-600 text-[12px]">
        Edit
      </Button>
    </div>
  );
}

export default OnboardingPage;
