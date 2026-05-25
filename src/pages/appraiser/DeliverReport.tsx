/**
 * Deliver Report Page
 *
 * Allows appraisers to upload and deliver their valuation report.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/src/lib/supabase/browser';
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';

interface Job {
  id: string;
  property_type: string;
  report_kind: string;
  status: string;
  address_description: string;
  total_price: number;
  appraiser_earnings: number;
  due_date: string;
  governorates: { name_en: string; name_ar: string } | null;
  cities: { name_en: string; name_ar: string } | null;
  client?: { full_name: string } | null;
}

const PROPERTY_TYPE_LABELS: Record<string, { en: string; ar: string }> = {
  apartment: { en: 'Apartment', ar: 'شقة' },
  villa: { en: 'Villa', ar: 'فيلا' },
  duplex: { en: 'Duplex', ar: 'دوبلكس' },
  commercial_shop: { en: 'Commercial', ar: 'تجاري' },
  office: { en: 'Office', ar: 'مكتب' },
  building: { en: 'Building', ar: 'مبنى' },
  compound_unit: { en: 'Compound Unit', ar: 'وحدة كمبوند' },
  roof: { en: 'Roof', ar: 'روف' },
};

export default function DeliverReport() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { session } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isRTL = i18n.language === 'ar';

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [delivering, setDelivering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [reportType, setReportType] = useState('valuation_report');

  useEffect(() => {
    async function fetchJob() {
      if (!id || !session?.access_token) return;

      try {
        const res = await fetch(`/api/jobs/${id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setJob(data.job);

          // Verify job is in progress
          if (data.job.status !== 'in_progress') {
            setError(isRTL ? 'لا يمكن تسليم تقرير لهذا الطلب' : 'Cannot deliver report for this job');
          }
        } else {
          setError(isRTL ? 'فشل في تحميل بيانات الطلب' : 'Failed to load job data');
        }
      } catch (err) {
        console.error('Failed to fetch job:', err);
        setError(isRTL ? 'فشل في تحميل البيانات' : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    fetchJob();
  }, [id, session?.access_token, isRTL]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        setError(isRTL ? 'يرجى رفع ملف PDF أو Word' : 'Please upload a PDF or Word document');
        return;
      }

      // Validate file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        setError(isRTL ? 'حجم الملف يجب أن يكون أقل من 50 ميجابايت' : 'File size must be less than 50MB');
        return;
      }

      setSelectedFile(file);
      setError(null);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (allowedTypes.includes(file.type) && file.size <= 50 * 1024 * 1024) {
        setSelectedFile(file);
        setError(null);
      }
    }
  };

  const handleDeliver = async () => {
    if (!selectedFile || !id || !session?.access_token) return;

    setDelivering(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();

      // Generate unique file path: job-deliverables/{job_id}/{timestamp}_{filename}
      const timestamp = Date.now();
      const sanitizedName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${id}/${timestamp}_${sanitizedName}`;

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('job-deliverables')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(isRTL ? 'فشل في رفع الملف' : 'Failed to upload file');
      }

      // Get the public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from('job-deliverables')
        .getPublicUrl(filePath);

      const publicUrl = urlData?.publicUrl || '';

      // Deliver the report with the actual file path
      const res = await fetch(`/api/appraiser/jobs/${id}/deliver`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: selectedFile.name,
          filePath: uploadData.path,
          fileUrl: publicUrl,
          fileSize: selectedFile.size,
          fileType: selectedFile.type,
          reportType: reportType,
          notes: notes || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to deliver report');
      }

      setSuccess(true);

      // Redirect after 2 seconds
      setTimeout(() => {
        navigate('/appraiser/jobs');
      }, 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to deliver report';
      setError(message);
    } finally {
      setDelivering(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-50 pt-16 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-cream-50 pt-16 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-ink-900 mb-2">
            {isRTL ? 'تم تسليم التقرير بنجاح!' : 'Report Delivered Successfully!'}
          </h2>
          <p className="text-ink-500 mb-4">
            {isRTL
              ? 'سيتم إخطار العميل وسيقوم بمراجعة التقرير.'
              : 'The client has been notified and will review the report.'}
          </p>
          <p className="text-sm text-ink-400">
            {isRTL ? 'جارٍ التحويل...' : 'Redirecting...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-cream-50 pt-16 ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Header */}
      <header className="bg-white border-b border-cream-200 px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <Link to="/appraiser/jobs" className="text-sm text-ink-500 hover:text-ink-700 mb-2 inline-block">
            &larr; {isRTL ? 'العودة للوحة الطلبات' : 'Back to Jobs Dashboard'}
          </Link>
          <h1 className="text-2xl font-bold text-ink-900">
            {isRTL ? 'تسليم التقرير' : 'Deliver Report'}
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* Job Summary */}
        {job && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-sm font-medium text-ink-500 mb-2">
              {isRTL ? 'ملخص الطلب' : 'Job Summary'}
            </h2>
            <h3 className="text-lg font-semibold text-ink-900">
              {isRTL
                ? PROPERTY_TYPE_LABELS[job.property_type]?.ar
                : PROPERTY_TYPE_LABELS[job.property_type]?.en}
              {' - '}
              {job.governorates ? (isRTL ? job.governorates.name_ar : job.governorates.name_en) : ''}
            </h3>
            <p className="text-sm text-ink-500 mt-1">{job.address_description}</p>
            {job.client && (
              <p className="text-sm text-ink-500 mt-1">
                {isRTL ? 'العميل:' : 'Client:'} {job.client.full_name}
              </p>
            )}
          </div>
        )}

        {/* Upload Area */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-ink-900 mb-4">
            {isRTL ? 'رفع ملف التقرير' : 'Upload Report File'}
          </h2>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={handleFileSelect}
            className="hidden"
          />

          {!selectedFile ? (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-cream-300 rounded-lg p-12 text-center cursor-pointer hover:border-emerald-400 transition"
            >
              <Upload className="w-12 h-12 text-ink-300 mx-auto mb-4" />
              <p className="text-ink-700 font-medium mb-2">
                {isRTL ? 'اسحب الملف هنا أو اضغط للرفع' : 'Drag file here or click to upload'}
              </p>
              <p className="text-sm text-ink-400">
                {isRTL ? 'PDF أو Word (حتى 50 ميجابايت)' : 'PDF or Word documents (up to 50MB)'}
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-ink-900">{selectedFile.name}</p>
                  <p className="text-xs text-ink-500">{formatFileSize(selectedFile.size)}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedFile(null)}
                className="p-2 text-ink-400 hover:text-red-500 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Report Type */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-ink-900 mb-4">
            {isRTL ? 'نوع الملف' : 'File Type'}
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'valuation_report', en: 'Valuation Report', ar: 'تقرير التقييم' },
              { value: 'supporting_docs', en: 'Supporting Docs', ar: 'مستندات داعمة' },
              { value: 'photos', en: 'Photos', ar: 'صور' },
            ].map((type) => (
              <button
                key={type.value}
                onClick={() => setReportType(type.value)}
                className={`p-3 rounded-lg border text-center transition ${
                  reportType === type.value
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-cream-200 text-ink-600 hover:border-cream-300'
                }`}
              >
                {isRTL ? type.ar : type.en}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-ink-900 mb-4">
            {isRTL ? 'ملاحظات (اختياري)' : 'Notes (Optional)'}
          </h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={isRTL ? 'أضف أي ملاحظات للعميل...' : 'Add any notes for the client...'}
            className="w-full h-24 px-4 py-3 border border-cream-200 rounded-lg text-ink-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={handleDeliver}
            disabled={!selectedFile || delivering || !!error}
            className="flex-1 px-6 py-4 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2"
          >
            {delivering ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {isRTL ? 'جارٍ التسليم...' : 'Delivering...'}
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                {isRTL ? 'تسليم التقرير' : 'Deliver Report'}
              </>
            )}
          </button>
          <Link
            to="/appraiser/jobs"
            className="px-6 py-4 border border-cream-300 text-ink-700 rounded-lg hover:bg-cream-50 font-semibold"
          >
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Link>
        </div>
      </main>
    </div>
  );
}
