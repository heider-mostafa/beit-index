import * as React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/src/components/ui';
import { useAuth } from '@/src/contexts/AuthContext';
import { SignaturePad } from '@/src/components/SignaturePad';
import { Upload, Loader2, Image as ImageIcon, FileSignature, Stamp, Check, AlertCircle, ExternalLink, ArrowLeft } from 'lucide-react';

interface ProfileData {
  fullName: string;
  status: string;
  photoUrl: string | null;
  signatureUrl: string | null;
  stampUrl: string | null;
}

type ImageField = 'photoStoragePath' | 'signatureStoragePath' | 'stampStoragePath';

export function ProfileSettingsPage() {
  const { session } = useAuth();
  const token = session?.access_token;

  const [profile, setProfile] = React.useState<ProfileData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState<ImageField | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState<ImageField | null>(null);

  const loadProfile = React.useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/appraiser/profile', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setProfile(await res.json());
    } catch (err) {
      console.error('Error loading profile:', err);
    }
    setLoading(false);
  }, [token]);

  React.useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const uploadAndSave = async (file: File, field: ImageField) => {
    if (!token) return;
    setUploading(field);
    setError(null);
    setSaved(null);
    try {
      // 1. Get a signed upload URL
      const urlRes = await fetch('/api/upload/get-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bucket: 'appraiser-assets', filename: file.name, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error('Failed to get upload URL');
      const { signedUrl, storagePath } = await urlRes.json();

      // 2. Upload the file
      const putRes = await fetch(signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      if (!putRes.ok) throw new Error('Failed to upload file');

      // 3. Save the new path on the profile
      const patchRes = await fetch('/api/appraiser/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [field]: storagePath }),
      });
      if (!patchRes.ok) throw new Error('Failed to save');

      setSaved(field);
      setTimeout(() => setSaved(null), 2500);
      await loadProfile();
    } catch (err) {
      console.error('Upload error:', err);
      setError((err as Error).message || 'Upload failed. Please try again.');
    }
    setUploading(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-100 pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-5">
        <Link to="/dashboard" className="text-body-s text-ink-400 hover:text-ink-600 flex items-center gap-1 mb-6">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-h2 text-ink-600 mb-1">My profile</h1>
            <p className="text-body-s text-ink-400">Update your photo, signature, and stamp.</p>
          </div>
          <Link to={`/appraisers`} className="text-body-s text-emerald-600 flex items-center gap-1 hover:gap-2 transition-all">
            View public profile <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-sm text-[13px] text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-5">
          <ImageUploader
            label="Profile photo"
            hint="Shown on your public profile. JPG or PNG."
            accept="image/*"
            round
            url={profile?.photoUrl ?? null}
            icon={<ImageIcon className="h-7 w-7 text-ink-200" />}
            uploading={uploading === 'photoStoragePath'}
            saved={saved === 'photoStoragePath'}
            onSelect={(file) => uploadAndSave(file, 'photoStoragePath')}
          />
          <div className="bg-cream-50 rounded-lg border-hairline p-6">
            <div className="flex items-center gap-2 mb-1">
              <FileSignature className="h-5 w-5 text-ink-400" />
              <h3 className="text-body-m font-medium text-ink-600">Signature</h3>
              {saved === 'signatureStoragePath' && (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
                  <Check className="h-3.5 w-3.5" /> Saved
                </span>
              )}
            </div>
            <p className="text-[12px] text-ink-400 mb-4">
              Draw your signature below — it's embedded on your appraisal report PDFs.
            </p>
            {profile?.signatureUrl && (
              <div className="mb-4">
                <p className="text-[11px] text-ink-300 mb-1">Current signature</p>
                <img
                  src={profile.signatureUrl}
                  alt="Current signature"
                  className="h-16 object-contain border border-ink-100 rounded bg-white p-1"
                />
              </div>
            )}
            <SignaturePad
              onSave={(file) => uploadAndSave(file, 'signatureStoragePath')}
              saving={uploading === 'signatureStoragePath'}
            />
          </div>
          <ImageUploader
            label="Stamp / seal"
            hint="Appears next to your signature on report PDFs. PNG preferred."
            accept="image/png,image/*"
            url={profile?.stampUrl ?? null}
            icon={<Stamp className="h-7 w-7 text-ink-200" />}
            uploading={uploading === 'stampStoragePath'}
            saved={saved === 'stampStoragePath'}
            onSelect={(file) => uploadAndSave(file, 'stampStoragePath')}
          />
        </div>

        <p className="text-[12px] text-ink-300 mt-8">
          To change your name, FRA license, or national ID, contact support — those require re-verification.
        </p>
      </div>
    </div>
  );
}

function ImageUploader({
  label,
  hint,
  accept,
  url,
  icon,
  round,
  uploading,
  saved,
  onSelect,
}: {
  label: string;
  hint: string;
  accept: string;
  url: string | null;
  icon: React.ReactNode;
  round?: boolean;
  uploading: boolean;
  saved: boolean;
  onSelect: (file: File) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="bg-cream-50 rounded-lg border-hairline p-6 flex items-center gap-6">
      <div
        className={`w-24 h-24 flex-shrink-0 bg-ink-50 flex items-center justify-center overflow-hidden border border-ink-100 ${
          round ? 'rounded-full' : 'rounded-md'
        }`}
      >
        {url ? (
          <img src={url} alt={label} className={`w-full h-full ${round ? 'object-cover' : 'object-contain'}`} />
        ) : (
          icon
        )}
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-body-m font-medium text-ink-600">{label}</h3>
          {saved && (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
              <Check className="h-3.5 w-3.5" /> Saved
            </span>
          )}
        </div>
        <p className="text-[12px] text-ink-400 mb-3">{hint}</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onSelect(file);
            e.target.value = '';
          }}
        />
        <Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
          {url ? 'Replace' : 'Upload'}
        </Button>
      </div>
    </div>
  );
}

export default ProfileSettingsPage;
