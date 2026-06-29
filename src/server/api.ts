import { Router, Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import WebSocket from 'ws';
import * as paymob from './payments/paymob';

/**
 * Hash a token using SHA-256.
 * Used for admin invite tokens - we store the hash, not the raw token.
 * This prevents token exposure if the database is compromised.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Type definitions
type UserRole = 'owner' | 'appraiser' | 'bank' | 'admin';
type ProfileStatus = 'pending' | 'under_review' | 'verified' | 'rejected' | 'suspended';
type AuditAction = 'admin_override' | 'verification_doc_viewed' | 'profile_approved' | 'profile_rejected' | 'changes_requested' | 'admin_invited' | 'admin_invite_consumed';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    authId: string;
    email: string;
    fullName: string;
    role: UserRole;
  };
  supabase?: SupabaseClient;
}

const router = Router();

// ============================================================================
// SUPABASE CLIENT HELPERS
// ============================================================================

// Singleton clients to avoid recreating on each request
let serviceClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

// Public client using anon key - respects RLS policies
function getAnonClient(): SupabaseClient {
  if (anonClient) return anonClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase environment variables (SUPABASE_URL, SUPABASE_ANON_KEY)');
  }
  anonClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
  });
  return anonClient;
}

// Service client - bypasses RLS, use only for admin operations
function getServiceClient(): SupabaseClient {
  if (serviceClient) return serviceClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || key === 'your-service-role-key') {
    throw new Error('Missing or invalid SUPABASE_SERVICE_ROLE_KEY - get it from Supabase Dashboard > Settings > API');
  }
  serviceClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
  });
  return serviceClient;
}

function getClientWithAuth(accessToken: string): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
  });
}

// ============================================================================
// IMAGE HELPERS FOR PDF GENERATION
// ============================================================================

// Transparent 1x1 PNG placeholder for failed images
const PLACEHOLDER_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

// Known storage buckets in the system
const KNOWN_BUCKETS = ['imports', 'report-photos', 'appraiser-assets', 'verification_documents', 'job-deliverables'];

/**
 * Convert a storage URL to a base64 data URL.
 * This is needed because Puppeteer can't access private Supabase storage URLs.
 * We fetch the image server-side and embed it directly in the HTML.
 *
 * Includes retry logic and proper bucket detection.
 */
async function convertImageToBase64(
  supabase: SupabaseClient,
  storagePathOrUrl: string,
  bucketHint?: string,
  maxRetries: number = 2
): Promise<string> {
  // If it's already a data URL, return as-is
  if (!storagePathOrUrl || storagePathOrUrl.startsWith('data:')) {
    return storagePathOrUrl || PLACEHOLDER_IMAGE;
  }

  // Extract the storage path and bucket from a Supabase public URL
  // URL format: https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}
  let bucket = bucketHint || 'imports';
  let storagePath = storagePathOrUrl;

  if (storagePathOrUrl.includes('supabase.co/storage/')) {
    // Handle both /public/ and /sign/ URLs (bucket is encoded in the URL)
    const publicMatch = storagePathOrUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/([^\/]+)\/(.+)/);
    if (publicMatch) {
      bucket = publicMatch[1];
      storagePath = publicMatch[2];
      // Remove query params if present (signed URLs have tokens)
      storagePath = storagePath.split('?')[0];
    }
  } else if (bucketHint) {
    // Caller told us the bucket; the value is a bare object key. Uploaded paths
    // are stored without a bucket prefix (e.g. "{userId}/{ts}_{uuid}.png"), so
    // prefix-guessing would wrongly fall back to "imports".
    bucket = bucketHint;
    storagePath = storagePathOrUrl;
  } else {
    // It's a raw storage path - try to detect bucket from path prefix
    for (const knownBucket of KNOWN_BUCKETS) {
      if (storagePathOrUrl.startsWith(knownBucket + '/')) {
        bucket = knownBucket;
        storagePath = storagePathOrUrl.substring(knownBucket.length + 1);
        break;
      }
    }
  }

  // Retry logic with exponential backoff
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // Wait before retry (exponential backoff: 100ms, 400ms, 900ms...)
        await new Promise(resolve => setTimeout(resolve, attempt * attempt * 100));
        console.log(`[Image] Retry ${attempt}/${maxRetries} for ${storagePath}`);
      }

      // Download the image using service client (bypasses RLS)
      const serviceClient = getServiceClient();
      const { data, error } = await serviceClient.storage
        .from(bucket)
        .download(storagePath);

      if (error) {
        lastError = new Error(error.message);
        continue; // Try next attempt
      }

      if (!data) {
        lastError = new Error('No data returned');
        continue;
      }

      // Convert to base64
      const buffer = Buffer.from(await data.arrayBuffer());
      const base64 = buffer.toString('base64');

      // Determine MIME type from file extension
      const ext = storagePath.split('.').pop()?.toLowerCase() || 'jpeg';
      const mimeTypes: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'svg': 'image/svg+xml',
      };
      const mimeType = mimeTypes[ext] || 'image/jpeg';

      return `data:${mimeType};base64,${base64}`;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  // All retries failed
  console.error(`[Image] Failed to convert image after ${maxRetries + 1} attempts:`, {
    bucket,
    path: storagePath,
    error: lastError?.message,
  });

  // Return placeholder instead of broken URL (Puppeteer can't access private URLs anyway)
  return PLACEHOLDER_IMAGE;
}

/**
 * Process all photos in a report, converting storage URLs to base64 data URLs.
 * This ensures PDF generation works with private storage buckets.
 */
async function processPhotosForPDF(
  supabase: SupabaseClient,
  photos: Array<{ storage_path: string; category: string; caption: string | null }>
): Promise<Array<{ storage_path: string; category: string; caption: string | null }>> {
  if (!photos || photos.length === 0) {
    return [];
  }

  const processedPhotos = await Promise.all(
    photos.map(async (photo) => ({
      ...photo,
      storage_path: await convertImageToBase64(supabase, photo.storage_path, 'report-photos'),
    }))
  );

  return processedPhotos;
}

// ============================================================================
// AUTH MIDDLEWARE
// ============================================================================

async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.substring(7);

  try {
    // Use service client to verify JWT (req.supabase doesn't exist yet)
    const supabase = getServiceClient();

    // Verify the JWT and get user
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get user profile from our users table
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(401).json({ error: 'User profile not found' });
    }

    req.user = {
      id: profile.id,
      authId: profile.auth_id,
      email: profile.email,
      fullName: profile.full_name,
      role: profile.role,
    };
    req.supabase = getClientWithAuth(token);
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

function adminMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function appraiserMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'appraiser') {
    return res.status(403).json({ error: 'Appraiser access required' });
  }
  next();
}

// ============================================================================
// AUDIT LOGGING HELPER
// ============================================================================

async function logAudit(
  supabase: SupabaseClient,
  userId: string | null,
  action: AuditAction,
  targetTable?: string,
  targetId?: string,
  metadata?: Record<string, unknown>,
  req?: Request
) {
  await supabase.from('audit_log').insert({
    user_id: userId,
    action,
    target_table: targetTable,
    target_id: targetId,
    metadata: metadata || {},
    ip_address: req?.ip,
    user_agent: req?.headers['user-agent'],
  });
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ============================================================================
// AUTH ROUTES
// ============================================================================

// Create user profile after signup (called from frontend)
router.post('/auth/create-profile', async (req: Request, res: Response) => {
  const { authId, email, fullName, role, inviteToken, bankInviteToken } = req.body;

  if (!authId || !email || !fullName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Use service client for bootstrapping new user (no auth yet)
    const supabase = getServiceClient();

    // Check if this is an admin invite.
    // Only self-serve roles are accepted from the client; 'admin' can never be
    // set directly via the request body — it is granted solely by consuming a
    // valid invite token below.
    let userRole = ['owner', 'appraiser', 'bank'].includes(role) ? role : 'owner';

    // Bank invite: grants the 'bank' role and links the user to a bank account.
    let bankInvite: { id: string; bank_account_id: string; bank_role: string; invited_by: string } | null = null;
    if (bankInviteToken) {
      const { data: bi } = await supabase
        .from('bank_invites')
        .select('id, bank_account_id, bank_role, invited_by, email')
        .eq('token', hashToken(bankInviteToken))
        .is('consumed_at', null)
        .gt('expires_at', new Date().toISOString())
        .single();
      if (bi && bi.email.toLowerCase() === email.toLowerCase()) {
        userRole = 'bank';
        bankInvite = bi;
      }
    }

    if (inviteToken) {
      // Hash the incoming token to compare against stored hash
      const hashedInviteToken = hashToken(inviteToken);

      const { data: invite, error: inviteError } = await supabase
        .from('admin_invites')
        .select('*')
        .eq('token', hashedInviteToken)  // Compare hashed tokens
        .is('consumed_at', null)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (invite && !inviteError && invite.email.toLowerCase() === email.toLowerCase()) {
        userRole = 'admin';

        // Consume the invite
        await supabase
          .from('admin_invites')
          .update({
            consumed_at: new Date().toISOString(),
            consumed_by: authId,
          })
          .eq('id', invite.id);

        // Log the invite consumption
        await logAudit(supabase, null, 'admin_invite_consumed', 'admin_invites', invite.id, {
          email,
          invited_by: invite.invited_by,
        }, req);
      }
    }

    // Ensure the app-side user row exists. The handle_new_user DB trigger
    // normally creates it atomically at signup; this upsert is idempotent and
    // also (a) elevates an invited admin — the trigger never grants admin from
    // client metadata — and (b) serves as the self-heal path for any auth user
    // that was orphaned before the trigger existed.
    const { data, error } = await supabase
      .from('users')
      .upsert(
        {
          auth_id: authId,
          email,
          full_name: fullName,
          role: userRole,
        },
        { onConflict: 'auth_id' }
      )
      .select()
      .single();

    if (error) {
      // Unique violation = email already registered under another account.
      // This is a "please log in" situation, not a server error.
      if ((error as { code?: string }).code === '23505') {
        return res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
      }
      console.error('Error creating user profile:', error);
      return res.status(500).json({ error: 'Failed to create user profile' });
    }

    // Link the user to the bank account and consume the bank invite.
    if (bankInvite) {
      await supabase
        .from('bank_users')
        .upsert(
          {
            user_id: data.id,
            bank_account_id: bankInvite.bank_account_id,
            role: bankInvite.bank_role || 'viewer',
          },
          { onConflict: 'user_id,bank_account_id', ignoreDuplicates: true }
        );

      await supabase
        .from('bank_invites')
        .update({ consumed_at: new Date().toISOString(), consumed_by: data.id })
        .eq('id', bankInvite.id);
    }

    // Ensure an onboarding draft exists for appraisers. ignoreDuplicates keeps
    // any in-progress draft intact on repeat calls.
    if (userRole === 'appraiser') {
      await supabase
        .from('appraiser_onboarding_drafts')
        .upsert(
          {
            user_id: data.id,
            current_step: 1,
            draft_data: { fullNameEn: fullName },
            uploaded_files: [],
          },
          { onConflict: 'user_id', ignoreDuplicates: true }
        );
    }

    res.json({ user: data });
  } catch (err) {
    console.error('Create profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Validate admin invite token
router.get('/auth/validate-invite/:token', async (req: Request, res: Response) => {
  const { token } = req.params;

  try {
    // Hash the incoming token to compare against stored hash
    const hashedToken = hashToken(token);

    // Use anon client - RLS policy allows public lookup of unexpired invites
    const supabase = getAnonClient();
    const { data: invite, error } = await supabase
      .from('admin_invites')
      .select('email, expires_at')
      .eq('token', hashedToken)  // Compare hashed tokens
      .is('consumed_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !invite) {
      return res.status(404).json({ error: 'Invalid or expired invite' });
    }

    res.json({ email: invite.email, valid: true });
  } catch (err) {
    console.error('Validate invite error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Validate a bank invite token (public). Uses the service client since bank_invites
// is admin-only under RLS.
router.get('/auth/validate-bank-invite/:token', async (req: Request, res: Response) => {
  const { token } = req.params;

  try {
    const supabase = getServiceClient();
    const { data: invite, error } = await supabase
      .from('bank_invites')
      .select('email, expires_at, bank_accounts!inner(name, name_ar)')
      .eq('token', hashToken(token))
      .is('consumed_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !invite) {
      return res.status(404).json({ error: 'Invalid or expired invite' });
    }

    const bank = (Array.isArray(invite.bank_accounts) ? invite.bank_accounts[0] : invite.bank_accounts) as
      | { name: string; name_ar: string | null }
      | undefined;

    res.json({ email: invite.email, bankName: bank?.name || null, valid: true });
  } catch (err) {
    console.error('Validate bank invite error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// GAZETTEER ROUTES
// ============================================================================

router.get('/gazetteer/governorates', async (req: Request, res: Response) => {
  try {
    const supabase = getAnonClient();
    const { data, error } = await supabase
      .from('governorates')
      .select('*')
      .order('name_en');

    if (error) throw error;
    res.json({ governorates: data || [] });
  } catch (err) {
    console.error('Error fetching governorates:', err);
    res.status(500).json({ error: 'Failed to fetch governorates', governorates: [] });
  }
});

router.get('/gazetteer/cities', async (req: Request, res: Response) => {
  const { governorate_id } = req.query;

  try {
    const supabase = getAnonClient();
    let query = supabase.from('cities').select('*, governorates(name_en, name_ar)').order('name_en');

    if (governorate_id) {
      query = query.eq('governorate_id', governorate_id as string);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ cities: data || [] });
  } catch (err) {
    console.error('Error fetching cities:', err);
    res.status(500).json({ error: 'Failed to fetch cities', cities: [] });
  }
});

router.get('/gazetteer/districts', async (req: Request, res: Response) => {
  const { city_id } = req.query;

  try {
    const supabase = getAnonClient();
    let query = supabase
      .from('districts')
      .select('*, cities(name_en, name_ar, governorate_id, governorates(name_en, name_ar))')
      .order('name_en');

    if (city_id) {
      query = query.eq('city_id', city_id as string);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ districts: data || [] });
  } catch (err) {
    console.error('Error fetching districts:', err);
    res.status(500).json({ error: 'Failed to fetch districts', districts: [] });
  }
});

router.get('/gazetteer/property-types', async (req: Request, res: Response) => {
  try {
    const supabase = getAnonClient();
    const { data, error } = await supabase
      .from('property_types')
      .select('*')
      .order('name_en');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error fetching property types:', err);
    res.status(500).json({ error: 'Failed to fetch property types' });
  }
});

// ============================================================================
// ONBOARDING ROUTES
// ============================================================================

// Get onboarding draft
router.get('/onboarding/draft', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'appraiser') {
    return res.status(403).json({ error: 'Only appraisers can access onboarding' });
  }

  try {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from('appraiser_onboarding_drafts')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // If no draft exists, create one
    if (!data) {
      const { data: newDraft, error: insertError } = await supabase
        .from('appraiser_onboarding_drafts')
        .insert({
          user_id: req.user.id,
          current_step: 1,
          draft_data: { fullNameEn: req.user.fullName },
          uploaded_files: [],
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return res.json(newDraft);
    }

    res.json(data);
  } catch (err) {
    console.error('Error fetching draft:', err);
    res.status(500).json({ error: 'Failed to fetch onboarding draft' });
  }
});

// Save onboarding draft
router.patch('/onboarding/draft', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'appraiser') {
    return res.status(403).json({ error: 'Only appraisers can access onboarding' });
  }

  const { currentStep, draftData, uploadedFiles } = req.body;

  try {
    const supabase = req.supabase!;

    const updateData: Record<string, unknown> = {};
    if (currentStep !== undefined) updateData.current_step = currentStep;
    if (draftData !== undefined) updateData.draft_data = draftData;
    if (uploadedFiles !== undefined) updateData.uploaded_files = uploadedFiles;

    const { data, error } = await supabase
      .from('appraiser_onboarding_drafts')
      .update(updateData)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error saving draft:', err);
    res.status(500).json({ error: 'Failed to save onboarding draft' });
  }
});

// Submit onboarding (convert draft to profile)
router.post('/onboarding/submit', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'appraiser') {
    return res.status(403).json({ error: 'Only appraisers can submit onboarding' });
  }

  try {
    const supabase = req.supabase!;

    // Get the draft
    const { data: draft, error: draftError } = await supabase
      .from('appraiser_onboarding_drafts')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    if (draftError || !draft) {
      return res.status(404).json({ error: 'Onboarding draft not found' });
    }

    const draftData = draft.draft_data as Record<string, unknown>;

    // Validate required fields
    const requiredFields = [
      'fullNameEn', 'phone', 'fraLicenseNumber', 'fraLicenseIssueDate',
      'fraLicenseExpiryDate', 'nationalIdNumber', 'selectedDistrictIds',
      'specialties', 'bioEn', 'startingPriceEgp', 'typicalTurnaroundDays',
      'codeOfConductAccepted'
    ];

    for (const field of requiredFields) {
      if (!draftData[field]) {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }

    if (!(draftData.codeOfConductAccepted as boolean)) {
      return res.status(400).json({ error: 'Code of conduct must be accepted' });
    }

    // Create appraiser profile
    const { data: profile, error: profileError } = await supabase
      .from('appraiser_profiles')
      .insert({
        user_id: req.user.id,
        full_name_en: draftData.fullNameEn as string,
        full_name_ar: (draftData.fullNameAr as string) || null,
        phone: draftData.phone as string,
        years_experience: (draftData.yearsExperience as number) || null,
        professional_title_en: (draftData.professionalTitle as string) || null,
        photo_url: (draftData.photoStoragePath as string) || null,
        fra_license_number: draftData.fraLicenseNumber as string,
        fra_license_issue_date: draftData.fraLicenseIssueDate as string,
        fra_license_expiry_date: draftData.fraLicenseExpiryDate as string,
        national_id_number: draftData.nationalIdNumber as string,
        bio_en: draftData.bioEn as string,
        bio_ar: (draftData.bioAr as string) || null,
        starting_price_egp: draftData.startingPriceEgp as number,
        typical_turnaround_days: draftData.typicalTurnaroundDays as number,
        availability: (draftData.availability as string) || 'this_week',
        signature_url: (draftData.signatureStoragePath as string) || null,
        stamp_url: (draftData.stampStoragePath as string) || null,
        status: 'pending',
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (profileError) {
      console.error('Error creating profile:', profileError);
      return res.status(500).json({ error: 'Failed to create appraiser profile' });
    }

    // Create verification documents
    const uploadedFiles = draft.uploaded_files as Array<{
      storagePath: string;
      documentType: string;
      originalFilename: string;
      mimeType: string;
      fileSize: number;
    }>;

    if (uploadedFiles && uploadedFiles.length > 0) {
      const docs = uploadedFiles.map((file) => ({
        appraiser_id: profile.id,
        document_type: file.documentType,
        storage_path: file.storagePath,
        original_filename: file.originalFilename,
        mime_type: file.mimeType,
        file_size: file.fileSize,
      }));

      await supabase.from('verification_documents').insert(docs);
    }

    // Create service areas
    const districtIds = draftData.selectedDistrictIds as string[];
    if (districtIds && districtIds.length > 0) {
      const areas = districtIds.map((districtId) => ({
        appraiser_id: profile.id,
        district_id: districtId,
      }));

      await supabase.from('appraiser_service_areas').insert(areas);
    }

    // Create specialties
    const specialties = draftData.specialties as Array<{
      propertyTypeId: string;
      yearsExperience: number;
    }>;

    if (specialties && specialties.length > 0) {
      const specs = specialties.map((s) => ({
        appraiser_id: profile.id,
        property_type_id: s.propertyTypeId,
        years_experience: s.yearsExperience,
      }));

      await supabase.from('appraiser_specialties').insert(specs);
    }

    // Delete the draft
    await supabase
      .from('appraiser_onboarding_drafts')
      .delete()
      .eq('user_id', req.user.id);

    res.json({ success: true, profileId: profile.id });
  } catch (err) {
    console.error('Error submitting onboarding:', err);
    res.status(500).json({ error: 'Failed to submit onboarding' });
  }
});

// Get appraiser profile status (for redirect logic)
router.get('/onboarding/status', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const supabase = req.supabase!;

    // Check for existing profile
    const { data: profile } = await supabase
      .from('appraiser_profiles')
      .select('id, status')
      .eq('user_id', req.user.id)
      .single();

    // Check for draft
    const { data: draft } = await supabase
      .from('appraiser_onboarding_drafts')
      .select('current_step')
      .eq('user_id', req.user.id)
      .single();

    res.json({
      role: req.user.role,
      hasProfile: !!profile,
      profileStatus: profile?.status || null,
      profileId: profile?.id || null,
      hasDraft: !!draft,
      draftStep: draft?.current_step || null,
    });
  } catch (err) {
    console.error('Error getting status:', err);
    res.status(500).json({ error: 'Failed to get onboarding status' });
  }
});

// ============================================================================
// FILE UPLOAD ROUTES
// ============================================================================

// File validation configuration
interface FileLimits {
  maxSize: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
}

const FILE_LIMITS: Record<string, FileLimits> = {
  'verification-docs': {
    maxSize: 10 * 1024 * 1024, // 10 MB
    allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
  },
  'appraiser-assets': {
    maxSize: 5 * 1024 * 1024, // 5 MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
  },
  'reports': {
    maxSize: 50 * 1024 * 1024, // 50 MB
    allowedMimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    allowedExtensions: ['pdf', 'doc', 'docx'],
  },
  'imports': {
    maxSize: 100 * 1024 * 1024, // 100 MB
    allowedMimeTypes: [
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ],
    allowedExtensions: ['pdf', 'xls', 'xlsx', 'csv'],
  },
};

function validateFileUpload(
  bucket: string,
  filename: string,
  contentType: string,
  fileSize?: number
): { valid: boolean; error?: string } {
  const limits = FILE_LIMITS[bucket];

  if (!limits) {
    return { valid: false, error: 'Invalid bucket' };
  }

  // Validate MIME type
  if (!limits.allowedMimeTypes.includes(contentType)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${limits.allowedMimeTypes.join(', ')}`,
    };
  }

  // Validate extension
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext || !limits.allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `Invalid file extension. Allowed extensions: ${limits.allowedExtensions.join(', ')}`,
    };
  }

  // Validate file size if provided
  if (fileSize && fileSize > limits.maxSize) {
    const maxMB = Math.round(limits.maxSize / 1024 / 1024);
    return {
      valid: false,
      error: `File too large. Maximum size: ${maxMB} MB`,
    };
  }

  return { valid: true };
}

// Get signed upload URL
router.post('/upload/get-url', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { bucket, filename, contentType, fileSize } = req.body;

  if (!bucket || !filename || !contentType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Validate bucket
  const allowedBuckets = ['verification-docs', 'appraiser-assets', 'reports', 'imports'];
  if (!allowedBuckets.includes(bucket)) {
    return res.status(400).json({ error: 'Invalid bucket' });
  }

  // Validate file
  const validation = validateFileUpload(bucket, filename, contentType, fileSize);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const supabase = req.supabase!;
    const timestamp = Date.now();
    const ext = filename.split('.').pop()?.toLowerCase();
    const storagePath = `${req.user.id}/${timestamp}_${uuidv4()}.${ext}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(storagePath);

    if (error) throw error;

    res.json({
      signedUrl: data.signedUrl,
      storagePath,
      token: data.token,
    });
  } catch (err) {
    console.error('Error creating upload URL:', err);
    res.status(500).json({ error: 'Failed to create upload URL' });
  }
});

// Get signed download URL (for viewing documents)
router.post('/download/get-url', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { bucket, storagePath, expiresIn } = req.body;

  if (!bucket || !storagePath) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Only admins can view verification docs
  if (bucket === 'verification-docs' && req.user.role !== 'admin') {
    // Check if it's the user's own document
    const userId = storagePath.split('/')[0];
    if (userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  try {
    const supabase = req.supabase!;

    // Default expiry: 15 mins for verification docs, 1 hour for photos
    const expiry = expiresIn || (bucket === 'verification-docs' ? 900 : 3600);

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, expiry);

    if (error) throw error;

    // Log document view if admin viewing verification docs
    if (req.user.role === 'admin' && bucket === 'verification-docs') {
      await logAudit(
        supabase,
        req.user.id,
        'verification_doc_viewed',
        'verification_documents',
        undefined,
        { storagePath },
        req
      );
    }

    res.json({ signedUrl: data.signedUrl });
  } catch (err) {
    console.error('Error creating download URL:', err);
    res.status(500).json({ error: 'Failed to create download URL' });
  }
});

// ============================================================================
// ADMIN ROUTES
// ============================================================================

// Get pending verifications
router.get('/admin/verifications', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { status, page = '1', limit = '50' } = req.query;

  try {
    const supabase = req.supabase!;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    // ------------------------------------------------------------------
    // Submitted profiles (rows that exist in appraiser_profiles).
    // Skipped entirely when viewing the synthetic 'incomplete' tab.
    // ------------------------------------------------------------------
    let profiles: Record<string, unknown>[] = [];
    let submittedCount = 0;

    if (status !== 'incomplete') {
      let query = supabase
        .from('appraiser_profiles')
        .select(`
          *,
          users!appraiser_profiles_user_id_fkey(email, full_name),
          appraiser_service_areas(
            district_id,
            districts(name_en, name_ar, city_id, cities(name_en, name_ar))
          ),
          appraiser_specialties(
            property_type_id,
            years_experience,
            property_types(name_en, name_ar)
          ),
          verification_documents(*)
        `, { count: 'exact' })
        .order('submitted_at', { ascending: false })
        .range(offset, offset + parseInt(limit as string) - 1);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      profiles = data || [];
      submittedCount = count || 0;
    }

    // ------------------------------------------------------------------
    // Incomplete appraisers: role='appraiser' users who have not yet
    // submitted onboarding, so no appraiser_profiles row exists. We
    // synthesize read-only queue entries from the user + draft so admins
    // can see them. (They are not approvable until they submit.)
    // ------------------------------------------------------------------
    const { data: appraiserUsers } = await supabase
      .from('users')
      .select('id, email, full_name, created_at')
      .eq('role', 'appraiser');

    const { data: profileUsers } = await supabase
      .from('appraiser_profiles')
      .select('user_id');

    const withProfile = new Set((profileUsers || []).map((p) => p.user_id));
    const incompleteUsers = (appraiserUsers || []).filter((u) => !withProfile.has(u.id));
    const incompleteCount = incompleteUsers.length;

    let incompleteProfiles: Record<string, unknown>[] = [];
    if ((!status || status === 'incomplete') && incompleteUsers.length > 0) {
      const { data: drafts } = await supabase
        .from('appraiser_onboarding_drafts')
        .select('user_id, current_step, updated_at')
        .in('user_id', incompleteUsers.map((u) => u.id));

      const draftMap = new Map((drafts || []).map((d) => [d.user_id, d]));

      incompleteProfiles = incompleteUsers
        .map((u) => {
          const draft = draftMap.get(u.id);
          return {
            id: `draft:${u.id}`,
            user_id: u.id,
            full_name_en: u.full_name,
            full_name_ar: null,
            phone: null,
            fra_license_number: null,
            photo_url: null,
            status: 'incomplete',
            is_draft: true,
            current_step: draft?.current_step ?? 1,
            submitted_at: null,
            created_at: u.created_at,
            users: { email: u.email, full_name: u.full_name },
            appraiser_service_areas: [],
            appraiser_specialties: [],
            verification_documents: [],
          };
        })
        // newest signups first
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    }

    // Get counts for submitted statuses
    const { data: counts } = await supabase
      .from('appraiser_profiles')
      .select('status')
      .then(({ data }) => {
        const statusCounts: Record<string, number> = {
          incomplete: incompleteCount,
          pending: 0,
          under_review: 0,
          verified: 0,
          rejected: 0,
        };
        data?.forEach((p) => {
          if (statusCounts[p.status] !== undefined) {
            statusCounts[p.status]++;
          }
        });
        return { data: statusCounts };
      });

    // Merge: incomplete-only, all (incomplete first), or a specific status
    let merged: Record<string, unknown>[];
    if (status === 'incomplete') {
      merged = incompleteProfiles;
    } else if (!status) {
      merged = [...incompleteProfiles, ...profiles];
    } else {
      merged = profiles;
    }

    res.json({
      profiles: merged,
      total: submittedCount + (status && status !== 'incomplete' ? 0 : incompleteCount),
      statusCounts: counts,
    });
  } catch (err) {
    console.error('Error fetching verifications:', err);
    res.status(500).json({ error: 'Failed to fetch verifications' });
  }
});

// Get single appraiser for review
router.get('/admin/verifications/:id', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const supabase = req.supabase!;

    const { data, error } = await supabase
      .from('appraiser_profiles')
      .select(`
        *,
        users!appraiser_profiles_user_id_fkey(email, full_name),
        appraiser_service_areas(
          district_id,
          districts(name_en, name_ar, city_id, cities(name_en, name_ar, governorate_id, governorates(name_en, name_ar)))
        ),
        appraiser_specialties(
          property_type_id,
          years_experience,
          property_types(name_en, name_ar)
        ),
        verification_documents(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error fetching appraiser:', err);
    res.status(500).json({ error: 'Failed to fetch appraiser' });
  }
});

// Approve appraiser
router.post('/admin/verifications/:id/approve', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const supabase = req.supabase!;

    const { data, error } = await supabase
      .from('appraiser_profiles')
      .update({
        status: 'verified',
        verified_at: new Date().toISOString(),
        verified_by: req.user!.id,
        rejection_reason: null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log the action
    await logAudit(
      supabase,
      req.user!.id,
      'profile_approved',
      'appraiser_profiles',
      id,
      { decision: 'approved' },
      req
    );

    res.json({ success: true, profile: data });
  } catch (err) {
    console.error('Error approving appraiser:', err);
    res.status(500).json({ error: 'Failed to approve appraiser' });
  }
});

// Request changes
router.post('/admin/verifications/:id/request-changes', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason) {
    return res.status(400).json({ error: 'Reason is required' });
  }

  try {
    const supabase = req.supabase!;

    const { data, error } = await supabase
      .from('appraiser_profiles')
      .update({
        status: 'under_review',
        rejection_reason: reason,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log the action
    await logAudit(
      supabase,
      req.user!.id,
      'changes_requested',
      'appraiser_profiles',
      id,
      { decision: 'changes_requested', reason },
      req
    );

    res.json({ success: true, profile: data });
  } catch (err) {
    console.error('Error requesting changes:', err);
    res.status(500).json({ error: 'Failed to request changes' });
  }
});

// Reject appraiser
router.post('/admin/verifications/:id/reject', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason) {
    return res.status(400).json({ error: 'Reason is required' });
  }

  try {
    const supabase = req.supabase!;

    const { data, error } = await supabase
      .from('appraiser_profiles')
      .update({
        status: 'rejected',
        rejection_reason: reason,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log the action
    await logAudit(
      supabase,
      req.user!.id,
      'profile_rejected',
      'appraiser_profiles',
      id,
      { decision: 'rejected', reason },
      req
    );

    res.json({ success: true, profile: data });
  } catch (err) {
    console.error('Error rejecting appraiser:', err);
    res.status(500).json({ error: 'Failed to reject appraiser' });
  }
});

// ============================================================================
// ADMIN INVITES
// ============================================================================

// List invites
router.get('/admin/invites', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = req.supabase!;

    const { data, error } = await supabase
      .from('admin_invites')
      .select(`
        *,
        inviter:users!admin_invites_invited_by_fkey(full_name, email),
        consumer:users!admin_invites_consumed_by_fkey(full_name, email)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error fetching invites:', err);
    res.status(500).json({ error: 'Failed to fetch invites' });
  }
});

// Create invite
router.post('/admin/invites', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const supabase = req.supabase!;

    // Check if email already has pending invite
    const { data: existing } = await supabase
      .from('admin_invites')
      .select('id')
      .eq('email', email.toLowerCase())
      .is('consumed_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Email already has a pending invite' });
    }

    // Generate token and hash it for storage
    // The raw token is sent in the invite URL, but we store only the hash
    const rawToken = uuidv4();
    const hashedToken = hashToken(rawToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data, error } = await supabase
      .from('admin_invites')
      .insert({
        email: email.toLowerCase(),
        token: hashedToken,  // Store hashed token
        invited_by: req.user!.id,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Log the action
    await logAudit(
      supabase,
      req.user!.id,
      'admin_invited',
      'admin_invites',
      data.id,
      { email: email.toLowerCase() },
      req
    );

    res.json({
      invite: data,
      inviteUrl: `${process.env.APP_URL || 'http://localhost:3000'}/signup?invite=${rawToken}`,
    });
  } catch (err) {
    console.error('Error creating invite:', err);
    res.status(500).json({ error: 'Failed to create invite' });
  }
});

// Revoke invite
router.delete('/admin/invites/:id', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const supabase = req.supabase!;

    const { error } = await supabase
      .from('admin_invites')
      .delete()
      .eq('id', id)
      .is('consumed_at', null);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Error revoking invite:', err);
    res.status(500).json({ error: 'Failed to revoke invite' });
  }
});

// ============================================================================
// ADMIN: BANK MANAGEMENT
// ============================================================================

// List bank accounts (with member counts)
router.get('/admin/banks', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const { data: banks, error } = await supabase
      .from('bank_accounts')
      .select('*, bank_users(count)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ banks: banks || [] });
  } catch (err) {
    console.error('Error listing banks:', err);
    res.status(500).json({ error: 'Failed to list banks' });
  }
});

// Create a bank account
router.post('/admin/banks', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const {
    name,
    nameAr,
    contactEmail,
    contactPhone,
    subscriptionTier,
    monthlyQueryLimit,
    address,
    taxId,
  } = req.body;

  if (!name || !contactEmail) {
    return res.status(400).json({ error: 'Bank name and contact email are required' });
  }

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('bank_accounts')
      .insert({
        name,
        name_ar: nameAr || null,
        contact_email: contactEmail,
        contact_phone: contactPhone || null,
        subscription_tier: subscriptionTier || 'trial',
        monthly_query_limit: monthlyQueryLimit || 100,
        address: address || null,
        tax_id: taxId || null,
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ bank: data });
  } catch (err) {
    console.error('Error creating bank:', err);
    res.status(500).json({ error: 'Failed to create bank' });
  }
});

// Get one bank account with members and pending invites
router.get('/admin/banks/:id', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const supabase = getServiceClient();

    const { data: bank, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !bank) {
      return res.status(404).json({ error: 'Bank not found' });
    }

    const { data: members } = await supabase
      .from('bank_users')
      .select('id, role, created_at, users!inner(email, full_name)')
      .eq('bank_account_id', id);

    const { data: invites } = await supabase
      .from('bank_invites')
      .select('id, email, bank_role, expires_at, consumed_at, created_at')
      .eq('bank_account_id', id)
      .is('consumed_at', null)
      .order('created_at', { ascending: false });

    res.json({ bank, members: members || [], invites: invites || [] });
  } catch (err) {
    console.error('Error fetching bank:', err);
    res.status(500).json({ error: 'Failed to fetch bank' });
  }
});

// Invite a user to a bank account
router.post('/admin/banks/:id/invite', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { email, bankRole } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const supabase = getServiceClient();

    // Bank must exist
    const { data: bank } = await supabase.from('bank_accounts').select('id').eq('id', id).single();
    if (!bank) {
      return res.status(404).json({ error: 'Bank not found' });
    }

    // No duplicate pending invite for this email + bank
    const { data: existing } = await supabase
      .from('bank_invites')
      .select('id')
      .eq('email', email.toLowerCase())
      .eq('bank_account_id', id)
      .is('consumed_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (existing) {
      return res.status(400).json({ error: 'This email already has a pending invite for this bank' });
    }

    const rawToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data, error } = await supabase
      .from('bank_invites')
      .insert({
        email: email.toLowerCase(),
        token: hashToken(rawToken),
        bank_account_id: id,
        bank_role: ['viewer', 'analyst', 'admin'].includes(bankRole) ? bankRole : 'viewer',
        invited_by: req.user!.id,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      invite: data,
      inviteUrl: `${process.env.APP_URL || 'http://localhost:3000'}/signup?bankInvite=${rawToken}`,
    });
  } catch (err) {
    console.error('Error creating bank invite:', err);
    res.status(500).json({ error: 'Failed to create bank invite' });
  }
});

// Revoke a bank invite
router.delete('/admin/bank-invites/:id', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const supabase = getServiceClient();
    const { error } = await supabase
      .from('bank_invites')
      .delete()
      .eq('id', id)
      .is('consumed_at', null);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Error revoking bank invite:', err);
    res.status(500).json({ error: 'Failed to revoke bank invite' });
  }
});

// ============================================================================
// AUDIT LOG
// ============================================================================

router.get('/admin/audit-log', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { page = '1', limit = '50', action, userId } = req.query;

  try {
    const supabase = req.supabase!;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let query = supabase
      .from('audit_log')
      .select(`
        *,
        users(full_name, email)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit as string) - 1);

    if (action) {
      query = query.eq('action', action);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      logs: data,
      total: count,
      page: parseInt(page as string),
      totalPages: Math.ceil((count || 0) / parseInt(limit as string)),
    });
  } catch (err) {
    console.error('Error fetching audit log:', err);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// ============================================================================
// PUBLIC APPRAISER ROUTES
// ============================================================================

// Profile photos live in the private appraiser-assets bucket, so the stored
// path can't be loaded directly by a browser. Return a short-lived signed URL.
async function signAppraiserPhoto(photoUrl: string | null | undefined): Promise<string | null> {
  if (!photoUrl || photoUrl.startsWith('http') || photoUrl.startsWith('data:')) {
    return photoUrl ?? null;
  }
  try {
    const { data } = await getServiceClient()
      .storage.from('appraiser-assets')
      .createSignedUrl(photoUrl, 60 * 60); // 1 hour
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

// List verified appraisers
router.get('/appraisers', async (req: Request, res: Response) => {
  const {
    page = '1',
    limit = '12',
    governorateId,
    propertyTypeId,
    minExperience,
    sortBy = 'rating',
  } = req.query;

  try {
    const supabase = getAnonClient();
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let query = supabase
      .from('appraiser_profiles')
      .select(`
        *,
        appraiser_service_areas(
          district_id,
          districts(name_en, name_ar, city_id, cities(name_en, name_ar, governorate_id, governorates(name_en, name_ar)))
        ),
        appraiser_specialties(
          property_type_id,
          years_experience,
          property_types(name_en, name_ar)
        ),
        reviews(rating)
      `, { count: 'exact' })
      .eq('status', 'verified')
      .range(offset, offset + parseInt(limit as string) - 1);

    // Filter by governorate
    if (governorateId) {
      query = query.contains('appraiser_service_areas', [{ districts: { cities: { governorate_id: governorateId } } }]);
    }

    // Filter by property type
    if (propertyTypeId) {
      query = query.contains('appraiser_specialties', [{ property_type_id: propertyTypeId }]);
    }

    // Filter by experience
    if (minExperience) {
      query = query.gte('years_experience', parseInt(minExperience as string));
    }

    const { data, error, count } = await query;

    if (error) throw error;

    // Calculate average ratings and sort
    const appraisersWithRatings = data?.map((appraiser) => {
      const ratings = appraiser.reviews?.map((r: { rating: number }) => r.rating) || [];
      const avgRating = ratings.length > 0
        ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length
        : 0;
      return {
        ...appraiser,
        averageRating: Math.round(avgRating * 10) / 10,
        reviewCount: ratings.length,
      };
    }) || [];

    // Sort
    if (sortBy === 'rating') {
      appraisersWithRatings.sort((a, b) => b.averageRating - a.averageRating);
    } else if (sortBy === 'experience') {
      appraisersWithRatings.sort((a, b) => (b.years_experience || 0) - (a.years_experience || 0));
    } else if (sortBy === 'price') {
      appraisersWithRatings.sort((a, b) => (a.starting_price_egp || 0) - (b.starting_price_egp || 0));
    }

    // Replace stored photo paths with signed URLs so they display.
    await Promise.all(
      appraisersWithRatings.map(async (a: { photo_url?: string | null }) => {
        a.photo_url = await signAppraiserPhoto(a.photo_url);
      })
    );

    res.json({
      appraisers: appraisersWithRatings,
      total: count,
      page: parseInt(page as string),
      totalPages: Math.ceil((count || 0) / parseInt(limit as string)),
    });
  } catch (err) {
    console.error('Error fetching appraisers:', err);
    res.status(500).json({ error: 'Failed to fetch appraisers' });
  }
});

// Get single appraiser
router.get('/appraisers/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const supabase = getAnonClient();

    const { data, error } = await supabase
      .from('appraiser_profiles')
      .select(`
        *,
        appraiser_service_areas(
          district_id,
          districts(name_en, name_ar, city_id, cities(name_en, name_ar, governorate_id, governorates(name_en, name_ar)))
        ),
        appraiser_specialties(
          property_type_id,
          years_experience,
          property_types(name_en, name_ar)
        ),
        reviews(
          id,
          rating,
          comment,
          reviewer_first_name,
          reviewer_last_initial,
          created_at
        )
      `)
      .eq('id', id)
      .eq('status', 'verified')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Appraiser not found' });
      }
      throw error;
    }

    // Calculate average rating
    const ratings = data.reviews?.map((r: { rating: number }) => r.rating) || [];
    const avgRating = ratings.length > 0
      ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length
      : 0;

    res.json({
      ...data,
      photo_url: await signAppraiserPhoto(data.photo_url),
      averageRating: Math.round(avgRating * 10) / 10,
      reviewCount: ratings.length,
    });
  } catch (err) {
    console.error('Error fetching appraiser:', err);
    res.status(500).json({ error: 'Failed to fetch appraiser' });
  }
});

// ============================================================================
// REPORT ROUTES (Sprint 3)
// ============================================================================

// List reports for dashboard
router.get('/reports', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'appraiser') {
    return res.status(403).json({ error: 'Only appraisers can access reports' });
  }

  const { status, page = '1', limit = '20', sortBy = 'updated_at', sortOrder = 'desc' } = req.query;

  try {
    const supabase = req.supabase!;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let query = supabase
      .from('reports')
      .select(`
        id,
        project_name,
        status,
        property_type:properties(property_type),
        report_kind,
        client_name,
        owner_name,
        appraisal_date,
        final_value,
        created_at,
        updated_at,
        version,
        address:properties(address_description, district_id, districts(name_en, name_ar))
      `, { count: 'exact' })
      .eq('appraiser_id', req.user.id)
      .order(sortBy as string, { ascending: sortOrder === 'asc' })
      .range(offset, offset + parseInt(limit as string) - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    // Get status counts
    const { data: allReports } = await supabase
      .from('reports')
      .select('status')
      .eq('appraiser_id', req.user.id);

    const statusCounts: Record<string, number> = {
      draft: 0,
      submitted: 0,
      finalized: 0,
      archived: 0,
    };

    allReports?.forEach((r) => {
      if (statusCounts[r.status] !== undefined) {
        statusCounts[r.status]++;
      }
    });

    res.json({
      reports: data,
      total: count,
      page: parseInt(page as string),
      totalPages: Math.ceil((count || 0) / parseInt(limit as string)),
      statusCounts,
    });
  } catch (err) {
    console.error('Error fetching reports:', err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Create new report
router.post('/reports', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'appraiser') {
    return res.status(403).json({ error: 'Only appraisers can create reports' });
  }

  const { templateId = 'fra-residential-v1.0', propertyData } = req.body;

  if (!propertyData?.property_type || !propertyData?.address_description) {
    return res.status(400).json({ error: 'Property type and address are required' });
  }

  try {
    // Use service client for inserts since we've already verified the user is an appraiser
    // The RLS policy relies on JWT claims which aren't being parsed correctly by the auth client
    const serviceSupabase = getServiceClient();

    // Create property first
    const { data: property, error: propError } = await serviceSupabase
      .from('properties')
      .insert({
        property_type: propertyData.property_type,
        governorate_id: propertyData.governorate_id || null,
        city_id: propertyData.city_id || null,
        district_id: propertyData.district_id || null,
        compound_id: propertyData.compound_id || null,
        building_number: propertyData.building_number || null,
        unit_number: propertyData.unit_number || null,
        floor: propertyData.floor || null,
        address_description: propertyData.address_description,
        plot_number: propertyData.plot_number || null,
      })
      .select()
      .single();

    if (propError) {
      console.error('Error creating property:', propError);
      return res.status(500).json({ error: 'Failed to create property' });
    }

    // Create report
    const { data: report, error: reportError } = await serviceSupabase
      .from('reports')
      .insert({
        template_id: templateId,
        property_id: property.id,
        appraiser_id: req.user.id,
        source: 'platform',
        status: 'draft',
        project_name: propertyData.project_name || null,
        report_kind: 'narrative_full',
        tenancy: 'owner_occupied',
        economic_life: 60,
      })
      .select()
      .single();

    if (reportError) {
      console.error('Error creating report:', reportError);
      return res.status(500).json({ error: 'Failed to create report' });
    }

    res.json({ report, property });
  } catch (err) {
    console.error('Error creating report:', err);
    res.status(500).json({ error: 'Failed to create report' });
  }
});

// Get single report with all data
router.get('/reports/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { id } = req.params;

  try {
    const supabase = req.supabase!;

    const { data: report, error } = await supabase
      .from('reports')
      .select(`
        *,
        property:properties(
          id,
          property_type,
          governorate_id,
          city_id,
          district_id,
          compound_id,
          building_number,
          unit_number,
          floor,
          address_description,
          plot_number,
          governorate:governorates(name_en, name_ar),
          city:cities(name_en, name_ar),
          district:districts(name_en, name_ar),
          compound:compounds(name_en, name_ar)
        ),
        comparables:report_comparables(
          id,
          ord,
          address,
          source,
          proximity,
          floor,
          sale_timing,
          tenancy,
          age_years,
          orientation,
          payment_terms,
          finishing_level,
          condition,
          location_quality,
          garage_share,
          building_area_sqm,
          land_area_sqm,
          has_pool,
          building_price_per_sqm,
          sale_price,
          derived_land_value,
          weight
        ),
        photos:report_photos(
          id,
          storage_path,
          category,
          caption,
          ord
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Report not found' });
      }
      throw error;
    }

    // Check access (RLS handles this but double-check)
    if (report.appraiser_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Sort comparables and photos by ord
    if (report.comparables) {
      report.comparables.sort((a: { ord: number }, b: { ord: number }) => a.ord - b.ord);
    }
    if (report.photos) {
      report.photos.sort((a: { ord: number }, b: { ord: number }) => a.ord - b.ord);
    }

    res.json(report);
  } catch (err) {
    console.error('Error fetching report:', err);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// Update report (with optimistic locking)
router.patch('/reports/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { id } = req.params;
  const { version, ...updateData } = req.body;

  if (version === undefined) {
    return res.status(400).json({ error: 'Version is required for optimistic locking' });
  }

  try {
    const supabase = req.supabase!;

    // Check current version first
    const { data: current, error: checkError } = await supabase
      .from('reports')
      .select('version, status, appraiser_id')
      .eq('id', id)
      .single();

    if (checkError || !current) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (current.appraiser_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (current.status === 'finalized') {
      return res.status(400).json({ error: 'Cannot edit finalized report' });
    }

    if (current.version !== version) {
      return res.status(409).json({
        error: 'Version conflict',
        currentVersion: current.version,
        yourVersion: version,
        message: 'Report was modified by another session. Please refresh and try again.',
      });
    }

    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.appraiser_id;
    delete updateData.template_id;
    delete updateData.created_at;
    delete updateData.finalized_at;
    delete updateData.property;
    delete updateData.comparables;
    delete updateData.photos;

    // Update report (version will be auto-incremented by trigger)
    const { data: updated, error: updateError } = await supabase
      .from('reports')
      .update(updateData)
      .eq('id', id)
      .eq('version', version) // Double-check version hasn't changed
      .select()
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        return res.status(409).json({
          error: 'Version conflict',
          message: 'Report was modified. Please refresh and try again.',
        });
      }
      throw updateError;
    }

    res.json(updated);
  } catch (err) {
    console.error('Error updating report:', err);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

// ============================================================================
// COMPARABLES ROUTES
// ============================================================================

// Add comparable
router.post('/reports/:reportId/comparables', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { reportId } = req.params;
  const comparableData = req.body;

  try {
    const supabase = req.supabase!;

    // Verify ownership and draft status
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('appraiser_id, status')
      .eq('id', reportId)
      .single();

    if (reportError || !report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (report.appraiser_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (report.status !== 'draft') {
      return res.status(400).json({ error: 'Can only add comparables to draft reports' });
    }

    // Get next ord value
    const { data: existing } = await supabase
      .from('report_comparables')
      .select('ord')
      .eq('report_id', reportId)
      .order('ord', { ascending: false })
      .limit(1);

    const nextOrd = existing && existing.length > 0 ? existing[0].ord + 1 : 1;

    // Compute derived land value
    const derivedLandValue = comparableData.sale_price -
      (comparableData.building_price_per_sqm * comparableData.building_area_sqm);

    const { data: comparable, error } = await supabase
      .from('report_comparables')
      .insert({
        report_id: reportId,
        ord: comparableData.ord || nextOrd,
        address: comparableData.address,
        source: comparableData.source,
        proximity: comparableData.proximity,
        floor: comparableData.floor,
        sale_timing: comparableData.sale_timing || 'current_offer',
        tenancy: comparableData.tenancy || 'owner_occupied',
        age_years: comparableData.age_years,
        orientation: comparableData.orientation,
        payment_terms: comparableData.payment_terms || 'cash',
        finishing_level: comparableData.finishing_level,
        condition: comparableData.condition,
        location_quality: comparableData.location_quality,
        garage_share: comparableData.garage_share,
        building_area_sqm: comparableData.building_area_sqm,
        land_area_sqm: comparableData.land_area_sqm,
        has_pool: comparableData.has_pool || false,
        building_price_per_sqm: comparableData.building_price_per_sqm,
        sale_price: comparableData.sale_price,
        derived_land_value: derivedLandValue,
        weight: comparableData.weight || 1,
      })
      .select()
      .single();

    if (error) throw error;

    res.json(comparable);
  } catch (err) {
    console.error('Error adding comparable:', err);
    res.status(500).json({ error: 'Failed to add comparable' });
  }
});

// Update comparable
router.patch('/reports/:reportId/comparables/:comparableId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { reportId, comparableId } = req.params;
  const updateData = req.body;

  try {
    const supabase = req.supabase!;

    // Verify ownership
    const { data: report } = await supabase
      .from('reports')
      .select('appraiser_id, status')
      .eq('id', reportId)
      .single();

    if (!report || report.appraiser_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (report.status !== 'draft') {
      return res.status(400).json({ error: 'Can only update comparables in draft reports' });
    }

    // Recompute derived land value if needed
    if (updateData.sale_price !== undefined || updateData.building_price_per_sqm !== undefined || updateData.building_area_sqm !== undefined) {
      const { data: current } = await supabase
        .from('report_comparables')
        .select('sale_price, building_price_per_sqm, building_area_sqm')
        .eq('id', comparableId)
        .single();

      if (current) {
        const salePrice = updateData.sale_price ?? current.sale_price;
        const buildingPrice = updateData.building_price_per_sqm ?? current.building_price_per_sqm;
        const buildingArea = updateData.building_area_sqm ?? current.building_area_sqm;
        updateData.derived_land_value = salePrice - (buildingPrice * buildingArea);
      }
    }

    delete updateData.id;
    delete updateData.report_id;

    const { data: comparable, error } = await supabase
      .from('report_comparables')
      .update(updateData)
      .eq('id', comparableId)
      .eq('report_id', reportId)
      .select()
      .single();

    if (error) throw error;

    res.json(comparable);
  } catch (err) {
    console.error('Error updating comparable:', err);
    res.status(500).json({ error: 'Failed to update comparable' });
  }
});

// Delete comparable
router.delete('/reports/:reportId/comparables/:comparableId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { reportId, comparableId } = req.params;

  try {
    const supabase = req.supabase!;

    // Verify ownership
    const { data: report } = await supabase
      .from('reports')
      .select('appraiser_id, status')
      .eq('id', reportId)
      .single();

    if (!report || report.appraiser_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (report.status !== 'draft') {
      return res.status(400).json({ error: 'Can only delete comparables from draft reports' });
    }

    const { error } = await supabase
      .from('report_comparables')
      .delete()
      .eq('id', comparableId)
      .eq('report_id', reportId);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting comparable:', err);
    res.status(500).json({ error: 'Failed to delete comparable' });
  }
});

// ============================================================================
// PHOTOS ROUTES
// ============================================================================

// Add photo
router.post('/reports/:reportId/photos', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { reportId } = req.params;
  const { storage_path, category, caption, ord } = req.body;

  if (!storage_path) {
    return res.status(400).json({ error: 'storage_path is required' });
  }

  try {
    const supabase = req.supabase!;

    // Verify ownership
    const { data: report } = await supabase
      .from('reports')
      .select('appraiser_id, status')
      .eq('id', reportId)
      .single();

    if (!report || report.appraiser_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (report.status !== 'draft') {
      return res.status(400).json({ error: 'Can only add photos to draft reports' });
    }

    // Get next ord value if not provided
    let photoOrd = ord;
    if (photoOrd === undefined) {
      const { data: existing } = await supabase
        .from('report_photos')
        .select('ord')
        .eq('report_id', reportId)
        .order('ord', { ascending: false })
        .limit(1);

      photoOrd = existing && existing.length > 0 ? existing[0].ord + 1 : 0;
    }

    const { data: photo, error } = await supabase
      .from('report_photos')
      .insert({
        report_id: reportId,
        storage_path,
        category: category || 'other',
        caption,
        ord: photoOrd,
      })
      .select()
      .single();

    if (error) throw error;

    res.json(photo);
  } catch (err) {
    console.error('Error adding photo:', err);
    res.status(500).json({ error: 'Failed to add photo' });
  }
});

// Delete photo
router.delete('/reports/:reportId/photos/:photoId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { reportId, photoId } = req.params;

  try {
    const supabase = req.supabase!;

    // Verify ownership
    const { data: report } = await supabase
      .from('reports')
      .select('appraiser_id, status')
      .eq('id', reportId)
      .single();

    if (!report || report.appraiser_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (report.status !== 'draft') {
      return res.status(400).json({ error: 'Can only delete photos from draft reports' });
    }

    // Get photo to delete from storage too
    const { data: photo } = await supabase
      .from('report_photos')
      .select('storage_path')
      .eq('id', photoId)
      .single();

    const { error } = await supabase
      .from('report_photos')
      .delete()
      .eq('id', photoId)
      .eq('report_id', reportId);

    if (error) throw error;

    // Delete from storage
    if (photo?.storage_path) {
      await supabase.storage.from('report-photos').remove([photo.storage_path]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting photo:', err);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

// ============================================================================
// FINALIZATION ROUTE
// ============================================================================

// Finalize report
router.post('/reports/:id/finalize', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { id } = req.params;
  const { version } = req.body;

  if (version === undefined) {
    return res.status(400).json({ error: 'Version is required' });
  }

  try {
    const supabase = req.supabase!;

    // Get current report
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('*')
      .eq('id', id)
      .single();

    if (reportError || !report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (report.appraiser_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (report.status === 'finalized') {
      return res.status(400).json({ error: 'Report is already finalized' });
    }

    if (report.version !== version) {
      return res.status(409).json({
        error: 'Version conflict',
        currentVersion: report.version,
        yourVersion: version,
      });
    }

    // Validate required fields for finalization
    const missingFields: string[] = [];

    if (!report.client_name) missingFields.push('client_name');
    if (!report.owner_name) missingFields.push('owner_name');
    if (!report.appraisal_date) missingFields.push('appraisal_date');
    if (!report.valid_until) missingFields.push('valid_until');
    if (!report.unit_net_area) missingFields.push('unit_net_area');
    if (!report.chosen_method) missingFields.push('chosen_method');
    if (!report.final_value) missingFields.push('final_value');
    if (!report.land_value) missingFields.push('land_value');
    if (!report.reconciliation_rationale) missingFields.push('reconciliation_rationale');

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields for finalization',
        missingFields,
      });
    }

    // Finalize (trigger will set finalized_at and create valuation record)
    const { data: finalized, error: finalizeError } = await supabase
      .from('reports')
      .update({
        status: 'finalized',
        building_value: report.final_value - report.land_value,
      })
      .eq('id', id)
      .eq('version', version)
      .select()
      .single();

    if (finalizeError) {
      console.error('Finalization error:', finalizeError);
      return res.status(500).json({ error: 'Failed to finalize report' });
    }

    res.json({
      success: true,
      report: finalized,
      message: 'Report finalized successfully. PDF generation available via /reports/:id/pdf endpoint.',
    });
  } catch (err) {
    console.error('Error finalizing report:', err);
    res.status(500).json({ error: 'Failed to finalize report' });
  }
});

// ============================================================================
// PDF GENERATION ROUTE
// ============================================================================

// Generate PDF for finalized report
router.get('/reports/:id/pdf', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { id } = req.params;

  try {
    const supabase = req.supabase!;

    // Get report with all related data
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select(`
        *,
        property:properties!inner(
          *,
          governorate:governorates(name_en, name_ar),
          city:cities(name_en, name_ar),
          district:districts(name_en, name_ar)
        ),
        comparables:report_comparables(
          id, ord, address, source, floor, sale_timing, tenancy, age_years,
          orientation, payment_terms, finishing_level, has_pool,
          building_area_sqm, land_area_sqm, building_price_per_sqm, sale_price
        ),
        photos:report_photos(storage_path, category, caption)
      `)
      .eq('id', id)
      .single();

    if (reportError || !report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Check access
    if (report.appraiser_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Must be finalized
    if (report.status !== 'finalized') {
      return res.status(400).json({ error: 'Report must be finalized before generating PDF' });
    }

    // Finalized reports are immutable, so the PDF only needs rendering once.
    // Serve a cached copy from job-deliverables when present — instant download,
    // no Puppeteer. Pass ?refresh=1 to force regeneration.
    const serviceClient = getServiceClient();
    const pdfCachePath = `reports/${id}.pdf`;
    const filename = `appraisal-${report.project_name || report.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.pdf`;

    if (!req.query.refresh) {
      const { data: cached } = await serviceClient.storage
        .from('job-deliverables')
        .download(pdfCachePath);
      if (cached) {
        const cachedBuffer = Buffer.from(await cached.arrayBuffer());
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', cachedBuffer.length);
        return res.send(cachedBuffer);
      }
    }

    // Get appraiser info including signature and stamp
    const { data: appraiser } = await supabase
      .from('users')
      .select(`
        full_name,
        appraiser_profiles(fra_license_number, signature_url, stamp_url)
      `)
      .eq('id', report.appraiser_id)
      .single();

    // Extract appraiser profile data
    const appraiserProfile = appraiser?.appraiser_profiles as {
      fra_license_number?: string;
      signature_url?: string | null;
      stamp_url?: string | null;
    } | null;

    // Convert signature and stamp URLs to base64 for PDF embedding
    let signatureBase64: string | null = null;
    let stampBase64: string | null = null;

    // A missing/broken image resolves to PLACEHOLDER_IMAGE; treat that as "no
    // image" so the PDF falls back to the appraiser's typed name (signature)
    // and the dashed stamp box, rather than embedding an invisible 1x1 pixel.
    if (appraiserProfile?.signature_url) {
      const sig = await convertImageToBase64(supabase, appraiserProfile.signature_url, 'appraiser-assets');
      signatureBase64 = sig === PLACEHOLDER_IMAGE ? null : sig;
    }
    if (appraiserProfile?.stamp_url) {
      const stamp = await convertImageToBase64(supabase, appraiserProfile.stamp_url, 'appraiser-assets');
      stampBase64 = stamp === PLACEHOLDER_IMAGE ? null : stamp;
    }

    // Flatten appraiser data for PDF generation
    const appraiserForPdf = appraiser ? {
      full_name: appraiser.full_name,
      license_number: appraiserProfile?.fra_license_number || null,
      signature_url: signatureBase64,
      stamp_url: stampBase64,
    } : undefined;

    // Convert photo storage URLs to base64 data URLs for PDF embedding
    // This is necessary because Puppeteer can't access private Supabase storage
    const processedPhotos = await processPhotosForPDF(
      supabase,
      report.photos as Array<{ storage_path: string; category: string; caption: string | null }>
    );

    // Dynamic import to avoid loading puppeteer when not needed
    const { generatePDF } = await import('./pdf');

    const pdfBuffer = await generatePDF({
      ...report,
      photos: processedPhotos,
      appraiser: appraiserForPdf,
    });

    // Cache the rendered PDF so future downloads skip Puppeteer entirely.
    // Non-fatal: still return the PDF even if caching fails.
    const { error: cacheError } = await serviceClient.storage
      .from('job-deliverables')
      .upload(pdfCachePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });
    if (cacheError) {
      console.error('Failed to cache report PDF:', cacheError.message);
    }

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating PDF:', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Get report templates
router.get('/report-templates', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = req.supabase!;

    const { data, error } = await supabase
      .from('report_templates')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error fetching templates:', err);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get compounds
router.get('/gazetteer/compounds', async (req: Request, res: Response) => {
  const { districtId } = req.query;

  try {
    const supabase = getAnonClient();
    let query = supabase.from('compounds').select('*').order('name_en');

    if (districtId) {
      query = query.eq('district_id', districtId as string);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error fetching compounds:', err);
    res.status(500).json({ error: 'Failed to fetch compounds' });
  }
});

// ============================================================================
// BACKLOG IMPORT ROUTES (Sprint 4)
// ============================================================================

// Middleware for verified appraisers only
function verifiedAppraiserMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'appraiser') {
    return res.status(403).json({ error: 'Only appraisers can access this resource' });
  }
  // In production, should also check if appraiser is verified
  next();
}

// Get import jobs for current appraiser
router.get('/imports', authMiddleware, verifiedAppraiserMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { status, page = '1', limit = '20' } = req.query;

  try {
    const supabase = req.supabase!;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let query = supabase
      .from('import_jobs')
      .select('*', { count: 'exact' })
      .eq('appraiser_id', req.user!.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit as string) - 1);

    if (status) {
      // Handle "approved" filter to include both approved and auto_approved
      if (status === 'approved') {
        query = query.in('status', ['approved', 'auto_approved']);
      } else {
        query = query.eq('status', status as string);
      }
    }

    const { data, error, count } = await query;

    if (error) throw error;

    // Get status counts
    const { data: allImports } = await supabase
      .from('import_jobs')
      .select('status')
      .eq('appraiser_id', req.user!.id);

    const statusCounts: Record<string, number> = {
      queued: 0,
      parsing: 0,
      auto_approved: 0,
      pending_review: 0,
      approved: 0,
      rejected: 0,
      parse_failed: 0,
    };

    allImports?.forEach((i) => {
      if (statusCounts[i.status] !== undefined) {
        statusCounts[i.status]++;
      }
    });

    res.json({
      imports: data,
      total: count,
      page: parseInt(page as string),
      totalPages: Math.ceil((count || 0) / parseInt(limit as string)),
      statusCounts,
    });
  } catch (err) {
    console.error('Error fetching imports:', err);
    res.status(500).json({ error: 'Failed to fetch imports' });
  }
});

// Get single import job with full details
router.get('/imports/:id', authMiddleware, verifiedAppraiserMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const supabase = req.supabase!;

    const { data, error } = await supabase
      .from('import_jobs')
      .select(`
        *,
        resulting_report:reports!import_jobs_resulting_report_id_fkey(id, status, final_value)
      `)
      .eq('id', id)
      .eq('appraiser_id', req.user!.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Import job not found' });
      }
      throw error;
    }

    res.json(data);
  } catch (err) {
    console.error('Error fetching import:', err);
    res.status(500).json({ error: 'Failed to fetch import' });
  }
});

// Upload file for import
router.post('/imports/upload', authMiddleware, verifiedAppraiserMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { filename, contentType, batchId } = req.body;

  if (!filename || !contentType) {
    return res.status(400).json({ error: 'filename and contentType are required' });
  }

  // Determine source type
  let sourceType: 'excel' | 'pdf';
  if (contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      contentType === 'application/vnd.ms-excel' ||
      filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
    sourceType = 'excel';
  } else if (contentType === 'application/pdf' || filename.endsWith('.pdf')) {
    sourceType = 'pdf';
  } else {
    return res.status(400).json({ error: 'Unsupported file type. Only Excel (.xlsx, .xls) and PDF files are allowed.' });
  }

  try {
    const supabase = req.supabase!;
    const serviceSupabase = getServiceClient(); // Use service client for storage operations
    const timestamp = Date.now();
    const ext = filename.split('.').pop();
    const storagePath = `${req.user!.id}/${timestamp}_${uuidv4()}.${ext}`;

    // Get signed upload URL (requires service client)
    const { data: uploadData, error: uploadError } = await serviceSupabase.storage
      .from('imports')
      .createSignedUploadUrl(storagePath);

    if (uploadError) throw uploadError;

    // Create import job record (status: queued)
    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .insert({
        appraiser_id: req.user!.id,
        batch_id: batchId || uuidv4(),
        source_type: sourceType,
        source_storage_path: storagePath,
        original_filename: filename,
        status: 'queued',
      })
      .select()
      .single();

    if (jobError) throw jobError;

    res.json({
      jobId: job.id,
      signedUrl: uploadData.signedUrl,
      storagePath,
      token: uploadData.token,
      sourceType,
    });
  } catch (err) {
    console.error('Error creating import upload:', err);
    res.status(500).json({ error: 'Failed to create import upload' });
  }
});

// Confirm upload complete and trigger processing
router.post('/imports/:id/process', authMiddleware, verifiedAppraiserMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const supabase = req.supabase!;

    // Get job and verify ownership
    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', id)
      .eq('appraiser_id', req.user!.id)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: 'Import job not found' });
    }

    if (job.status !== 'queued') {
      return res.status(400).json({ error: 'Job has already been processed' });
    }

    // Import Inngest client and send event
    const { inngest } = await import('./inngest');

    await inngest.send({
      name: 'import/job.started',
      data: {
        jobId: job.id,
        appraiserId: req.user!.id,
        sourceType: job.source_type,
        storagePath: job.source_storage_path,
        originalFilename: job.original_filename,
      },
    });

    // Log audit
    await logAudit(
      supabase,
      req.user!.id,
      'import_uploaded' as AuditAction,
      'import_jobs',
      job.id,
      { sourceType: job.source_type, filename: job.original_filename },
      req
    );

    res.json({ success: true, message: 'Processing started' });
  } catch (err) {
    console.error('Error starting import processing:', err);
    res.status(500).json({ error: 'Failed to start processing' });
  }
});

// Approve import (creates report)
router.post('/imports/:id/approve', authMiddleware, verifiedAppraiserMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { corrections } = req.body; // Optional corrections to extracted data

  try {
    const supabase = req.supabase!;
    const serviceSupabase = getServiceClient();

    // Get job and verify ownership
    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', id)
      .eq('appraiser_id', req.user!.id)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: 'Import job not found' });
    }

    if (job.status !== 'pending_review') {
      return res.status(400).json({ error: 'Only pending_review jobs can be approved' });
    }

    // Merge corrections into extracted data
    const extractedData = { ...(job.extracted_data as Record<string, unknown>), ...corrections };
    const identification = (extractedData.identification || {}) as Record<string, unknown>;
    const physical = (extractedData.physical || {}) as Record<string, unknown>;
    const reconciliation = (extractedData.reconciliation || {}) as Record<string, unknown>;

    // Create property
    const { data: property, error: propError } = await serviceSupabase
      .from('properties')
      .insert({
        property_type: identification.propertyType || 'apartment',
        address_description: identification.addressDescription || 'Imported property',
        governorate_id: null,
        city_id: null,
        district_id: null,
        building_number: identification.buildingNumber || null,
        unit_number: identification.unitNumber || null,
        floor: identification.floor || null,
      })
      .select()
      .single();

    if (propError) throw propError;

    // Create report
    const { data: report, error: reportError } = await serviceSupabase
      .from('reports')
      .insert({
        template_id: 'fra-residential-v1.0',
        property_id: property.id,
        appraiser_id: req.user!.id,
        report_kind: identification.reportKind || 'brief',
        report_number: identification.reportNumber || null,
        tenancy: identification.tenancy || 'vacant',
        client_name: identification.clientName || 'Imported',
        owner_name: identification.ownerName || 'Imported',
        appraisal_date: identification.appraisalDate || new Date().toISOString().split('T')[0],
        valid_until: identification.validUntil || null,
        status: 'finalized',
        source: 'backlog_import',
        import_job_id: id,
        unit_net_area: physical.unitNetArea || 0,
        unit_gross_area: physical.unitGrossArea || 0,
        unit_land_share: physical.unitLandShare || 0,
        current_age: physical.currentAge || 0,
        economic_life: physical.economicLife || 60,
        effective_age: physical.effectiveAge || 0,
        bedrooms: physical.bedrooms || 0,
        bathrooms: physical.bathrooms || 0,
        total_rooms: physical.totalRooms || 0,
        finishing_level: physical.finishingLevel || 'full',
        has_pool: physical.hasPool || false,
        orientation: physical.orientation || null,
        final_value: reconciliation.finalValue || 0,
        land_value: reconciliation.landValue || 0,
        building_value: reconciliation.buildingValue || 0,
        chosen_method: reconciliation.chosenMethod || 'cost',
        // Note: raw extracted data is stored in import_jobs.extracted_data, linked via import_job_id
      })
      .select()
      .single();

    if (reportError) throw reportError;

    // Save comparables to report_comparables table
    const salesComparison = (extractedData.salesComparison || {}) as Record<string, unknown>;
    const comparables = salesComparison.comparables as Array<Record<string, unknown>> | undefined;

    if (comparables && Array.isArray(comparables) && comparables.length > 0) {
      const mapSaleTiming = (value: string | undefined): 'current_offer' | 'recent_sale' | 'historical' => {
        if (!value) return 'current_offer';
        const normalized = value.toLowerCase().replace(/[_\s-]/g, '');
        if (normalized.includes('recent')) return 'recent_sale';
        if (normalized.includes('historical') || normalized.includes('old')) return 'historical';
        return 'current_offer';
      };

      const mapTenancy = (value: string | undefined): 'owner_occupied' | 'vacant' | 'rented' => {
        if (!value) return 'owner_occupied';
        const normalized = value.toLowerCase().replace(/[_\s-]/g, '');
        if (normalized.includes('vacant') || normalized.includes('empty')) return 'vacant';
        if (normalized.includes('rent')) return 'rented';
        return 'owner_occupied';
      };

      const comparableInserts = comparables.map((comp, index) => ({
        report_id: report.id,
        ord: index + 1,
        address: String(comp.address || 'Unknown'),
        source: String(comp.source || 'imported'),
        floor: comp.floor ? String(comp.floor) : null,
        sale_timing: mapSaleTiming(comp.saleTiming as string),
        tenancy: mapTenancy(comp.tenancy as string),
        age_years: typeof comp.ageYears === 'number' ? comp.ageYears : null,
        orientation: comp.orientation ? String(comp.orientation) : null,
        payment_terms: 'cash' as const,
        finishing_level: comp.finishingLevel ? String(comp.finishingLevel) : null,
        has_pool: Boolean(comp.hasPool),
        building_area_sqm: typeof comp.buildingAreaSqm === 'number' ? comp.buildingAreaSqm : 0,
        land_area_sqm: typeof comp.landAreaSqm === 'number' ? comp.landAreaSqm : 0,
        building_price_per_sqm: typeof comp.buildingPricePerSqm === 'number' ? comp.buildingPricePerSqm : 0,
        sale_price: typeof comp.salePrice === 'number' ? comp.salePrice : 0,
      }));

      await serviceSupabase
        .from('report_comparables')
        .insert(comparableInserts);
    }

    // Save images to report_photos table. _images is already filtered to real,
    // displayable photos with their final category + caption assigned upstream
    // (selectDisplayablePhotos in the import pipeline), so insert as-is.
    const images = extractedData._images as Array<{
      url: string;
      category: string;
      caption: string | null;
    }> | undefined;

    if (images && Array.isArray(images) && images.length > 0) {
      const photoInserts = images.map((img, index) => ({
        report_id: report.id,
        storage_path: img.url, // Use public URL for display
        category: img.category,
        caption: img.caption || null,
        ord: index,
      }));

      const { error: photoError } = await serviceSupabase
        .from('report_photos')
        .insert(photoInserts);

      if (photoError) {
        console.error('Failed to insert report photos:', photoError);
      } else {
        console.log(`[Import Approval] Inserted ${photoInserts.length} photos for report ${report.id}`);
      }
    }

    // Update import job
    await supabase
      .from('import_jobs')
      .update({
        status: 'approved',
        resulting_report_id: report.id,
        extracted_data: extractedData,
        reviewed_by: req.user!.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id);

    // Log audit
    await logAudit(
      supabase,
      req.user!.id,
      'import_approved' as AuditAction,
      'import_jobs',
      id,
      { reportId: report.id },
      req
    );

    res.json({ success: true, reportId: report.id });
  } catch (err) {
    console.error('Error approving import:', err);
    res.status(500).json({ error: 'Failed to approve import' });
  }
});

// Reject import
router.post('/imports/:id/reject', authMiddleware, verifiedAppraiserMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason) {
    return res.status(400).json({ error: 'Rejection reason is required' });
  }

  try {
    const supabase = req.supabase!;

    // Get job and verify ownership
    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .select('status')
      .eq('id', id)
      .eq('appraiser_id', req.user!.id)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: 'Import job not found' });
    }

    if (job.status !== 'pending_review') {
      return res.status(400).json({ error: 'Only pending_review jobs can be rejected' });
    }

    // Update import job
    await supabase
      .from('import_jobs')
      .update({
        status: 'rejected',
        rejected_reason: reason,
        reviewed_by: req.user!.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id);

    // Log audit
    await logAudit(
      supabase,
      req.user!.id,
      'import_rejected' as AuditAction,
      'import_jobs',
      id,
      { reason },
      req
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error rejecting import:', err);
    res.status(500).json({ error: 'Failed to reject import' });
  }
});

// Delete import job (only allowed for queued/parse_failed jobs)
router.delete('/imports/:id', authMiddleware, verifiedAppraiserMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const supabase = req.supabase!;
    const serviceSupabase = getServiceClient();

    // Get job and verify ownership
    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', id)
      .eq('appraiser_id', req.user!.id)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: 'Import job not found' });
    }

    // Only allow deletion of queued or failed jobs
    if (!['queued', 'parsing', 'parse_failed'].includes(job.status)) {
      return res.status(400).json({ error: 'Can only delete queued or failed import jobs' });
    }

    // Delete file from storage
    if (job.source_storage_path) {
      await serviceSupabase.storage
        .from('imports')
        .remove([job.source_storage_path]);
    }

    // Delete the job record
    const { error: deleteError } = await supabase
      .from('import_jobs')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    // Log audit
    await logAudit(
      supabase,
      req.user!.id,
      'import_deleted' as AuditAction,
      'import_jobs',
      id,
      { status: job.status, filename: job.original_filename },
      req
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting import:', err);
    res.status(500).json({ error: 'Failed to delete import' });
  }
});

// Get signed URL for viewing source file
router.get('/imports/:id/source-url', authMiddleware, verifiedAppraiserMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const supabase = req.supabase!;
    const serviceSupabase = getServiceClient();

    // Get job and verify ownership
    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .select('source_storage_path, status')
      .eq('id', id)
      .eq('appraiser_id', req.user!.id)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: 'Import job not found' });
    }

    if (!job.source_storage_path) {
      return res.status(404).json({ error: 'Source file path not found' });
    }

    // First check if file actually exists in storage
    const { data: fileList, error: listError } = await serviceSupabase.storage
      .from('imports')
      .list(job.source_storage_path.split('/').slice(0, -1).join('/'), {
        search: job.source_storage_path.split('/').pop()
      });

    if (listError || !fileList || fileList.length === 0) {
      // File doesn't exist - this happens when upload failed/timed out
      return res.status(404).json({
        error: 'Source file not found in storage. The upload may have failed.',
        hint: 'Please re-upload the file.'
      });
    }

    // Get signed URL (15 minute expiry) using service client
    const { data, error } = await serviceSupabase.storage
      .from('imports')
      .createSignedUrl(job.source_storage_path, 900);

    if (error) throw error;

    // Log audit
    await logAudit(
      supabase,
      req.user!.id,
      'import_source_viewed' as AuditAction,
      'import_jobs',
      id,
      {},
      req
    );

    res.json({ signedUrl: data.signedUrl });
  } catch (err) {
    console.error('Error getting source URL:', err);
    res.status(500).json({ error: 'Failed to get source URL' });
  }
});

// ============================================================================
// SPRINT 5A: BANK ANALYTICS DASHBOARD
// ============================================================================

// Middleware to verify bank user access
async function bankMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Admin can access everything
  if (req.user.role === 'admin') {
    return next();
  }

  // Must be a bank user
  if (req.user.role !== 'bank') {
    return res.status(403).json({ error: 'Bank access required' });
  }

  try {
    const supabase = getServiceClient();

    // Get bank account for this user
    const { data: bankUser, error } = await supabase
      .from('bank_users')
      .select('bank_account_id, role, bank_accounts!inner(*)')
      .eq('user_id', req.user.id)
      .single();

    if (error || !bankUser) {
      return res.status(403).json({ error: 'No bank account associated with this user' });
    }

    // Check subscription is active
    const bankAccount = (Array.isArray(bankUser.bank_accounts)
      ? bankUser.bank_accounts[0]
      : bankUser.bank_accounts) as Record<string, unknown>;
    const expiresAt = bankAccount?.subscription_expires_at as string | null;
    if (expiresAt && new Date(expiresAt) < new Date()) {
      return res.status(403).json({ error: 'Bank subscription expired' });
    }

    // Attach bank account to request
    (req as AuthenticatedRequest & { bankAccount: Record<string, unknown> }).bankAccount = {
      ...bankAccount,
      userRole: bankUser.role,
    };

    next();
  } catch (err) {
    console.error('Bank middleware error:', err);
    res.status(500).json({ error: 'Failed to verify bank access' });
  }
}

// Get analytics overview for bank dashboard
router.get('/analytics/overview', authMiddleware, bankMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const bankAccount = (req as AuthenticatedRequest & { bankAccount?: Record<string, unknown> }).bankAccount;
    const allowedGovernorates = (bankAccount?.allowed_governorate_ids as string[]) || [];

    // Build base query for valuation records
    let query = supabase
      .from('valuation_records')
      .select('*', { count: 'exact' })
      .eq('is_provisional', false); // Only ground-truth data

    // Filter by allowed governorates if not enterprise (empty = all)
    if (allowedGovernorates.length > 0) {
      query = query.in('district_id', allowedGovernorates); // Note: need to join to get governorate
    }

    // Get total records
    const { count: totalRecords } = await query;

    // Get date range stats (last 12 months)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const { data: recentRecords, error } = await supabase
      .from('valuation_records')
      .select('value_per_sqm, final_value, appraisal_date, property_type, district_id')
      .eq('is_provisional', false)
      .gte('appraisal_date', oneYearAgo.toISOString().split('T')[0])
      .order('appraisal_date', { ascending: true });

    if (error) throw error;

    // Calculate statistics
    const values = (recentRecords || []).map(r => r.value_per_sqm).filter(v => v != null) as number[];
    const medianPricePerSqm = values.length > 0
      ? values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
      : 0;
    const avgPricePerSqm = values.length > 0
      ? values.reduce((a, b) => a + b, 0) / values.length
      : 0;

    // Property type distribution
    const propertyTypes: Record<string, number> = {};
    (recentRecords || []).forEach(r => {
      propertyTypes[r.property_type] = (propertyTypes[r.property_type] || 0) + 1;
    });

    // Log query for billing
    await supabase.from('analytics_queries').insert({
      bank_account_id: bankAccount?.id,
      user_id: req.user!.id,
      query_type: 'overview',
      query_params: { allowedGovernorates },
      result_count: totalRecords || 0,
    });

    res.json({
      totalRecords: totalRecords || 0,
      recentRecords: (recentRecords || []).length,
      medianPricePerSqm: Math.round(medianPricePerSqm),
      avgPricePerSqm: Math.round(avgPricePerSqm),
      propertyTypeDistribution: propertyTypes,
      periodStart: oneYearAgo.toISOString().split('T')[0],
      periodEnd: new Date().toISOString().split('T')[0],
    });
  } catch (err) {
    console.error('Error fetching analytics overview:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get price trends by zone (governorate/city/district)
router.get('/analytics/price-trends', authMiddleware, bankMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const {
      governorateId,
      cityId,
      districtId,
      propertyType,
      period = '12m', // 3m, 6m, 12m, 24m
    } = req.query;

    // Calculate date range
    const months = parseInt(period.toString().replace('m', '')) || 12;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    // Build query
    let query = supabase
      .from('valuation_records')
      .select(`
        value_per_sqm,
        final_value,
        appraisal_date,
        property_type,
        district_id,
        districts!inner(id, name, name_ar, city_id, cities!inner(id, name, governorate_id, governorates!inner(id, name)))
      `)
      .eq('is_provisional', false)
      .gte('appraisal_date', startDate.toISOString().split('T')[0])
      .order('appraisal_date', { ascending: true });

    // Apply filters
    if (districtId) {
      query = query.eq('district_id', districtId);
    } else if (cityId) {
      query = query.eq('districts.city_id', cityId);
    } else if (governorateId) {
      query = query.eq('districts.cities.governorate_id', governorateId);
    }

    if (propertyType) {
      query = query.eq('property_type', propertyType);
    }

    const { data: records, error } = await query;

    if (error) throw error;

    // Group by month
    const monthlyData: Record<string, { values: number[]; count: number }> = {};
    (records || []).forEach(r => {
      const month = r.appraisal_date.substring(0, 7); // YYYY-MM
      if (!monthlyData[month]) {
        monthlyData[month] = { values: [], count: 0 };
      }
      if (r.value_per_sqm) {
        monthlyData[month].values.push(r.value_per_sqm);
        monthlyData[month].count++;
      }
    });

    // Calculate monthly statistics
    const trends = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => {
        const sorted = data.values.sort((a, b) => a - b);
        return {
          month,
          count: data.count,
          median: sorted[Math.floor(sorted.length / 2)] || 0,
          avg: sorted.reduce((a, b) => a + b, 0) / sorted.length || 0,
          min: sorted[0] || 0,
          max: sorted[sorted.length - 1] || 0,
          p25: sorted[Math.floor(sorted.length * 0.25)] || 0,
          p75: sorted[Math.floor(sorted.length * 0.75)] || 0,
        };
      });

    // Log query
    const bankAccount = (req as AuthenticatedRequest & { bankAccount?: Record<string, unknown> }).bankAccount;
    await supabase.from('analytics_queries').insert({
      bank_account_id: bankAccount?.id,
      user_id: req.user!.id,
      query_type: 'price_trends',
      query_params: { governorateId, cityId, districtId, propertyType, period },
      result_count: (records || []).length,
    });

    res.json({
      trends,
      totalRecords: (records || []).length,
      filters: { governorateId, cityId, districtId, propertyType, period },
    });
  } catch (err) {
    console.error('Error fetching price trends:', err);
    res.status(500).json({ error: 'Failed to fetch price trends' });
  }
});

// Get zone breakdown (district-level aggregation)
router.get('/analytics/zone-breakdown', authMiddleware, bankMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const { governorateId, cityId, propertyType } = req.query;

    // Get last 12 months of data
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);

    let query = supabase
      .from('valuation_records')
      .select(`
        value_per_sqm,
        final_value,
        property_type,
        district_id,
        districts!inner(id, name, name_ar, city_id, cities!inner(id, name, name_ar, governorate_id, governorates!inner(id, name, name_ar)))
      `)
      .eq('is_provisional', false)
      .gte('appraisal_date', startDate.toISOString().split('T')[0]);

    if (cityId) {
      query = query.eq('districts.city_id', cityId);
    } else if (governorateId) {
      query = query.eq('districts.cities.governorate_id', governorateId);
    }

    if (propertyType) {
      query = query.eq('property_type', propertyType);
    }

    const { data: records, error } = await query;

    if (error) throw error;

    // Group by district
    const districtData: Record<string, {
      district: { id: string; name: string; nameAr: string };
      city: { id: string; name: string; nameAr: string };
      governorate: { id: string; name: string; nameAr: string };
      values: number[];
      totalValue: number;
    }> = {};

    (records || []).forEach(r => {
      // Handle joined data which may be array or object
      const districtRaw = r.districts as unknown;
      const district = (Array.isArray(districtRaw) ? districtRaw[0] : districtRaw) as {
        id: string;
        name: string;
        name_ar: string;
        cities: { id: string; name: string; name_ar: string; governorates: { id: string; name: string; name_ar: string } } | Array<{ id: string; name: string; name_ar: string; governorates: { id: string; name: string; name_ar: string } | Array<{ id: string; name: string; name_ar: string }> }>;
      };
      if (!district) return;

      const districtId = district.id;
      const city = Array.isArray(district.cities) ? district.cities[0] : district.cities;
      const governorate = city && (Array.isArray(city.governorates) ? city.governorates[0] : city.governorates);

      if (!districtData[districtId] && city && governorate) {
        districtData[districtId] = {
          district: { id: district.id, name: district.name, nameAr: district.name_ar },
          city: { id: city.id, name: city.name, nameAr: city.name_ar },
          governorate: { id: governorate.id, name: governorate.name, nameAr: governorate.name_ar },
          values: [],
          totalValue: 0,
        };
      }

      if (r.value_per_sqm && districtData[districtId]) {
        districtData[districtId].values.push(r.value_per_sqm);
        districtData[districtId].totalValue += r.final_value || 0;
      }
    });

    // Calculate statistics per district
    const zones = Object.values(districtData).map(d => {
      const sorted = d.values.sort((a, b) => a - b);
      return {
        district: d.district,
        city: d.city,
        governorate: d.governorate,
        recordCount: d.values.length,
        totalValue: d.totalValue,
        medianPricePerSqm: Math.round(sorted[Math.floor(sorted.length / 2)] || 0),
        avgPricePerSqm: Math.round(d.values.reduce((a, b) => a + b, 0) / d.values.length || 0),
        minPricePerSqm: Math.round(sorted[0] || 0),
        maxPricePerSqm: Math.round(sorted[sorted.length - 1] || 0),
      };
    }).sort((a, b) => b.recordCount - a.recordCount);

    // Log query
    const bankAccount = (req as AuthenticatedRequest & { bankAccount?: Record<string, unknown> }).bankAccount;
    await supabase.from('analytics_queries').insert({
      bank_account_id: bankAccount?.id,
      user_id: req.user!.id,
      query_type: 'zone_breakdown',
      query_params: { governorateId, cityId, propertyType },
      result_count: zones.length,
    });

    res.json({ zones });
  } catch (err) {
    console.error('Error fetching zone breakdown:', err);
    res.status(500).json({ error: 'Failed to fetch zone breakdown' });
  }
});

// Comparable search for specific valuation
router.get('/analytics/comparables', authMiddleware, bankMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const {
      districtId,
      propertyType,
      minArea,
      maxArea,
      minPrice,
      maxPrice,
      finishingLevel,
      limit = '20',
    } = req.query;

    if (!districtId) {
      return res.status(400).json({ error: 'districtId is required' });
    }

    // Get last 12 months of data
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);

    let query = supabase
      .from('valuation_records')
      .select('*')
      .eq('is_provisional', false)
      .eq('district_id', districtId)
      .gte('appraisal_date', startDate.toISOString().split('T')[0])
      .order('appraisal_date', { ascending: false })
      .limit(parseInt(limit.toString()));

    if (propertyType) query = query.eq('property_type', propertyType);
    if (minArea) query = query.gte('unit_net_area', minArea);
    if (maxArea) query = query.lte('unit_net_area', maxArea);
    if (minPrice) query = query.gte('value_per_sqm', minPrice);
    if (maxPrice) query = query.lte('value_per_sqm', maxPrice);
    if (finishingLevel) query = query.eq('finishing_level', finishingLevel);

    const { data: comparables, error } = await query;

    if (error) throw error;

    // Log query
    const bankAccount = (req as AuthenticatedRequest & { bankAccount?: Record<string, unknown> }).bankAccount;
    await supabase.from('analytics_queries').insert({
      bank_account_id: bankAccount?.id,
      user_id: req.user!.id,
      query_type: 'comparable_search',
      query_params: { districtId, propertyType, minArea, maxArea, minPrice, maxPrice, finishingLevel },
      result_count: (comparables || []).length,
    });

    res.json({ comparables: comparables || [] });
  } catch (err) {
    console.error('Error searching comparables:', err);
    res.status(500).json({ error: 'Failed to search comparables' });
  }
});

// Get bank account details and usage
router.get('/bank/account', authMiddleware, bankMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const bankAccount = (req as AuthenticatedRequest & { bankAccount?: Record<string, unknown> }).bankAccount;
    const supabase = getServiceClient();

    // Get query count for current month
    const { count: queriesThisMonth } = await supabase
      .from('analytics_queries')
      .select('*', { count: 'exact', head: true })
      .eq('bank_account_id', bankAccount?.id)
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

    res.json({
      account: bankAccount,
      usage: {
        queriesThisMonth: queriesThisMonth || 0,
        queryLimit: bankAccount?.monthly_query_limit || 100,
      },
    });
  } catch (err) {
    console.error('Error fetching bank account:', err);
    res.status(500).json({ error: 'Failed to fetch bank account' });
  }
});

// ============================================================================
// BANK DATA MARKETPLACE - Browse & Purchase Anonymized Reports
// ============================================================================

// Get marketplace listings with filters
router.get('/bank/marketplace', authMiddleware, bankMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const bankAccount = (req as AuthenticatedRequest & { bankAccount?: { id: string } }).bankAccount;

    const {
      page = '1',
      limit = '20',
      propertyType,
      governorateId,
      cityId,
      districtId,
      reportKind,
      appraiserId,
      dateFrom,
      dateTo,
      sortBy = 'listed_at',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 20, 100);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .from('report_listings')
      .select(`
        id,
        property_type,
        approximate_area,
        bedrooms,
        bathrooms,
        report_kind,
        listing_price_piasters,
        listed_at,
        governorate_id,
        governorates(id, name_en, name_ar),
        city_id,
        cities(id, name_en, name_ar),
        district_id,
        districts(id, name_en, name_ar),
        appraiser_id,
        appraiser:appraiser_id(id, full_name, fra_license_number)
      `, { count: 'exact' })
      .eq('is_active', true);

    // Apply filters
    if (propertyType) query = query.eq('property_type', propertyType);
    if (governorateId) query = query.eq('governorate_id', governorateId);
    if (cityId) query = query.eq('city_id', cityId);
    if (districtId) query = query.eq('district_id', districtId);
    if (reportKind) query = query.eq('report_kind', reportKind);
    if (appraiserId) query = query.eq('appraiser_id', appraiserId);
    if (dateFrom) query = query.gte('listed_at', dateFrom);
    if (dateTo) query = query.lte('listed_at', dateTo);

    // Sorting
    const validSortFields = ['listed_at', 'listing_price_piasters', 'property_type'];
    const sortField = validSortFields.includes(sortBy as string) ? sortBy as string : 'listed_at';
    query = query.order(sortField, { ascending: sortOrder === 'asc' });

    // Pagination
    query = query.range(offset, offset + limitNum - 1);

    const { data: listings, count, error } = await query;

    if (error) throw error;

    // Check which listings bank already purchased
    const listingIds = (listings || []).map((l: { id: string }) => l.id);
    let purchasedIds: string[] = [];

    if (listingIds.length > 0 && bankAccount?.id) {
      const { data: purchasedItems } = await supabase
        .from('bank_purchase_items')
        .select('listing_id, purchase:purchase_id(bank_account_id, status)')
        .in('listing_id', listingIds);

      purchasedIds = ((purchasedItems || []) as unknown as Array<{ listing_id: string; purchase: { bank_account_id: string; status: string } | null }>)
        .filter((item) =>
          item.purchase?.bank_account_id === bankAccount.id && item.purchase?.status === 'completed'
        )
        .map((item) => item.listing_id);
    }

    // Get volume discounts
    const { data: discounts } = await supabase
      .from('bank_volume_discounts')
      .select('*')
      .eq('is_active', true)
      .order('min_quantity', { ascending: true });

    res.json({
      listings: (listings || []).map((listing: { id: string }) => ({
        ...listing,
        is_purchased: purchasedIds.includes(listing.id),
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum),
      },
      volumeDiscounts: discounts || [],
    });
  } catch (err) {
    console.error('Error fetching marketplace listings:', err);
    res.status(500).json({ error: 'Failed to fetch marketplace listings' });
  }
});

// Get single listing details (preview)
router.get('/bank/marketplace/:id', authMiddleware, bankMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const bankAccount = (req as AuthenticatedRequest & { bankAccount?: { id: string } }).bankAccount;
    const listingId = req.params.id;

    const { data: listing, error } = await supabase
      .from('report_listings')
      .select(`
        id,
        property_type,
        approximate_area,
        bedrooms,
        bathrooms,
        report_kind,
        listing_price_piasters,
        listed_at,
        governorate_id,
        governorates(id, name_en, name_ar),
        city_id,
        cities(id, name_en, name_ar),
        district_id,
        districts(id, name_en, name_ar),
        appraiser_id,
        appraiser:appraiser_id(id, full_name, fra_license_number, professional_title_en, years_experience)
      `)
      .eq('id', listingId)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Listing not found' });
      }
      throw error;
    }

    // Check if purchased
    let isPurchased = false;
    if (bankAccount?.id) {
      const { data: purchaseItem } = await supabase
        .from('bank_purchase_items')
        .select('id, purchase:purchase_id(bank_account_id, status)')
        .eq('listing_id', listingId)
        .single();

      const pi = purchaseItem as unknown as { purchase: { bank_account_id: string; status: string } | null } | null;
      isPurchased = pi?.purchase?.bank_account_id === bankAccount.id &&
                    pi?.purchase?.status === 'completed';
    }

    res.json({
      listing: {
        ...listing,
        is_purchased: isPurchased,
      },
    });
  } catch (err) {
    console.error('Error fetching listing:', err);
    res.status(500).json({ error: 'Failed to fetch listing' });
  }
});

// ============================================================================
// BANK CART MANAGEMENT
// ============================================================================

// Get cart items
router.get('/bank/cart', authMiddleware, bankMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const bankAccount = (req as AuthenticatedRequest & { bankAccount?: { id: string } }).bankAccount;

    if (!bankAccount?.id) {
      return res.status(400).json({ error: 'Bank account not found' });
    }

    const { data: cartItems, error } = await supabase
      .from('bank_cart_items')
      .select(`
        id,
        added_at,
        listing:listing_id(
          id,
          property_type,
          approximate_area,
          bedrooms,
          report_kind,
          listing_price_piasters,
          listed_at,
          governorates(name_en, name_ar),
          cities(name_en, name_ar),
          districts(name_en, name_ar),
          appraiser:appraiser_id(full_name)
        )
      `)
      .eq('bank_account_id', bankAccount.id)
      .order('added_at', { ascending: false });

    if (error) throw error;

    // Calculate totals
    const items = (cartItems || []) as unknown as Array<{ id: string; added_at: string; listing: { listing_price_piasters: number } | null }>;
    const subtotal = items.reduce((sum, item) =>
      sum + (item.listing?.listing_price_piasters || 0), 0);

    // Get applicable discount
    const { data: discounts } = await supabase
      .from('bank_volume_discounts')
      .select('*')
      .lte('min_quantity', items.length)
      .eq('is_active', true)
      .order('min_quantity', { ascending: false })
      .limit(1);

    const discount = discounts?.[0] || { discount_percent: 0 };
    const discountAmount = Math.round(subtotal * (discount.discount_percent / 100));
    const total = subtotal - discountAmount;

    res.json({
      items,
      summary: {
        itemCount: items.length,
        subtotal,
        discountPercent: discount.discount_percent,
        discountAmount,
        total,
      },
    });
  } catch (err) {
    console.error('Error fetching cart:', err);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

// Add to cart
router.post('/bank/cart', authMiddleware, bankMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const bankAccount = (req as AuthenticatedRequest & { bankAccount?: { id: string } }).bankAccount;
    const userId = req.user!.id;
    const { listingId } = req.body;

    if (!bankAccount?.id) {
      return res.status(400).json({ error: 'Bank account not found' });
    }

    if (!listingId) {
      return res.status(400).json({ error: 'listingId is required' });
    }

    // Verify listing exists and is active
    const { data: listing, error: listingError } = await supabase
      .from('report_listings')
      .select('id')
      .eq('id', listingId)
      .eq('is_active', true)
      .single();

    if (listingError || !listing) {
      return res.status(404).json({ error: 'Listing not found or not available' });
    }

    // Check if already purchased
    const { data: alreadyPurchased } = await supabase
      .from('bank_purchase_items')
      .select('id, purchase:purchase_id(bank_account_id, status)')
      .eq('listing_id', listingId)
      .single();

    const ap = alreadyPurchased as unknown as { purchase: { bank_account_id: string; status: string } | null } | null;
    if (ap?.purchase?.bank_account_id === bankAccount.id &&
        ap?.purchase?.status === 'completed') {
      return res.status(400).json({ error: 'Listing already purchased' });
    }

    // Add to cart (upsert to handle duplicates gracefully)
    const { data: cartItem, error } = await supabase
      .from('bank_cart_items')
      .upsert({
        bank_account_id: bankAccount.id,
        listing_id: listingId,
        added_by: userId,
      }, { onConflict: 'bank_account_id,listing_id' })
      .select()
      .single();

    if (error) throw error;

    res.json({ cartItem, message: 'Added to cart' });
  } catch (err) {
    console.error('Error adding to cart:', err);
    res.status(500).json({ error: 'Failed to add to cart' });
  }
});

// Remove from cart
router.delete('/bank/cart/:listingId', authMiddleware, bankMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const bankAccount = (req as AuthenticatedRequest & { bankAccount?: { id: string } }).bankAccount;
    const listingId = req.params.listingId;

    if (!bankAccount?.id) {
      return res.status(400).json({ error: 'Bank account not found' });
    }

    const { error } = await supabase
      .from('bank_cart_items')
      .delete()
      .eq('bank_account_id', bankAccount.id)
      .eq('listing_id', listingId);

    if (error) throw error;

    res.json({ message: 'Removed from cart' });
  } catch (err) {
    console.error('Error removing from cart:', err);
    res.status(500).json({ error: 'Failed to remove from cart' });
  }
});

// Clear cart
router.delete('/bank/cart', authMiddleware, bankMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const bankAccount = (req as AuthenticatedRequest & { bankAccount?: { id: string } }).bankAccount;

    if (!bankAccount?.id) {
      return res.status(400).json({ error: 'Bank account not found' });
    }

    const { error } = await supabase
      .from('bank_cart_items')
      .delete()
      .eq('bank_account_id', bankAccount.id);

    if (error) throw error;

    res.json({ message: 'Cart cleared' });
  } catch (err) {
    console.error('Error clearing cart:', err);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

// ============================================================================
// BANK CHECKOUT & PAYMENT
// ============================================================================

// Calculate checkout totals
router.post('/bank/checkout', authMiddleware, bankMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const bankAccount = (req as AuthenticatedRequest & { bankAccount?: { id: string } }).bankAccount;

    if (!bankAccount?.id) {
      return res.status(400).json({ error: 'Bank account not found' });
    }

    // Get cart items
    const { data: cartItems, error: cartError } = await supabase
      .from('bank_cart_items')
      .select(`
        listing:listing_id(
          id,
          listing_price_piasters
        )
      `)
      .eq('bank_account_id', bankAccount.id);

    if (cartError) throw cartError;

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const items = (cartItems as unknown as Array<{ listing: { id: string; listing_price_piasters: number } }>).map((item) => item.listing);
    const subtotal = items.reduce((sum, item) => sum + (item.listing_price_piasters || 0), 0);

    // Get applicable discount
    const { data: discounts } = await supabase
      .from('bank_volume_discounts')
      .select('*')
      .lte('min_quantity', items.length)
      .eq('is_active', true)
      .order('min_quantity', { ascending: false })
      .limit(1);

    const discount = discounts?.[0] || { discount_percent: 0, min_quantity: 0 };
    const discountAmount = Math.round(subtotal * (discount.discount_percent / 100));
    const total = subtotal - discountAmount;

    res.json({
      checkout: {
        itemCount: items.length,
        items: items.map((item: { id: string; listing_price_piasters: number }) => ({
          listingId: item.id,
          price: item.listing_price_piasters,
        })),
        subtotal,
        discountPercent: discount.discount_percent,
        discountMinQuantity: discount.min_quantity,
        discountAmount,
        total,
      },
    });
  } catch (err) {
    console.error('Error calculating checkout:', err);
    res.status(500).json({ error: 'Failed to calculate checkout' });
  }
});

// Initiate payment for cart
router.post('/bank/checkout/pay', authMiddleware, bankMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const bankAccount = (req as AuthenticatedRequest & { bankAccount?: { id: string; name: string } }).bankAccount;
    const userId = req.user!.id;

    if (!bankAccount?.id) {
      return res.status(400).json({ error: 'Bank account not found' });
    }

    // Get cart items with prices
    const { data: cartItems, error: cartError } = await supabase
      .from('bank_cart_items')
      .select(`
        listing:listing_id(
          id,
          listing_price_piasters
        )
      `)
      .eq('bank_account_id', bankAccount.id);

    if (cartError) throw cartError;

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const items = (cartItems as unknown as Array<{ listing: { id: string; listing_price_piasters: number } }>).map((item) => item.listing);
    const subtotal = items.reduce((sum, item) => sum + (item.listing_price_piasters || 0), 0);

    // Get applicable discount
    const { data: discounts } = await supabase
      .from('bank_volume_discounts')
      .select('*')
      .lte('min_quantity', items.length)
      .eq('is_active', true)
      .order('min_quantity', { ascending: false })
      .limit(1);

    const discount = discounts?.[0] || { discount_percent: 0 };
    const discountAmount = Math.round(subtotal * (discount.discount_percent / 100));
    const total = subtotal - discountAmount;

    // Create purchase record
    const { data: purchase, error: purchaseError } = await supabase
      .from('bank_report_purchases')
      .insert({
        bank_account_id: bankAccount.id,
        purchased_by: userId,
        item_count: items.length,
        subtotal_piasters: subtotal,
        discount_percent: discount.discount_percent,
        discount_amount_piasters: discountAmount,
        total_piasters: total,
        status: 'pending',
      })
      .select()
      .single();

    if (purchaseError) throw purchaseError;

    // Create purchase items
    const purchaseItems = items.map((item: { id: string; listing_price_piasters: number }) => ({
      purchase_id: purchase.id,
      listing_id: item.id,
      price_piasters: item.listing_price_piasters,
    }));

    const { error: itemsError } = await supabase
      .from('bank_purchase_items')
      .insert(purchaseItems);

    if (itemsError) throw itemsError;

    // Initiate Paymob payment (Intention API). special_reference = purchase.id.
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const paymobResult = await paymob.initiatePayment(
      total,
      purchase.id,
      {
        firstName: (bankAccount.name as string) || 'Bank',
        lastName: 'Account',
        email: req.user!.email,
        phone: '+201000000000',
        city: 'Cairo',
        country: 'EG',
      },
      {
        customer: { firstName: (bankAccount.name as string) || 'Bank', lastName: 'Account', email: req.user!.email },
        notificationUrl: `${appUrl}/api/bank/checkout/callback`,
        redirectionUrl: `${appUrl}/bank/reports`,
      }
    );

    // Store the intention id for reference (matching is via merchant_order_id).
    await supabase
      .from('bank_report_purchases')
      .update({
        paymob_order_id: paymobResult.intentionId,
        status: 'processing',
      })
      .eq('id', purchase.id);

    res.json({
      purchaseId: purchase.id,
      checkoutUrl: paymobResult.checkoutUrl,
      total,
    });
  } catch (err) {
    console.error('Error initiating payment:', err);
    res.status(500).json({ error: 'Failed to initiate payment' });
  }
});

// Paymob callback for bank purchases
router.post('/bank/checkout/callback', async (req: Request, res: Response) => {
  try {
    const supabase = getServiceClient();

    // Verify HMAC signature. Paymob posts the callback body and sends the hmac
    // as a query param — same handling as the appraisal payment callback.
    const hmacSecret = process.env.PAYMOB_HMAC_SECRET;
    const receivedHmac = req.query.hmac as string | undefined;
    if (hmacSecret && receivedHmac) {
      if (!paymob.verifyHmac(req.body, receivedHmac)) {
        console.error('Invalid HMAC signature for bank purchase callback');
        return res.status(400).json({ error: 'Invalid signature' });
      }
    }

    // This is the server-to-server webhook (notification_url). Match by our
    // special_reference, which Paymob echoes as order.merchant_order_id.
    const callbackData = req.body;
    const merchantRef = callbackData.obj?.order?.merchant_order_id as string | undefined;
    const success = callbackData.obj?.success === true;
    const transactionId = callbackData.obj?.id?.toString();

    if (!merchantRef) {
      return res.status(400).json({ error: 'Missing merchant reference' });
    }

    const { data: purchase, error: findError } = await supabase
      .from('bank_report_purchases')
      .select('*')
      .eq('id', merchantRef)
      .single();

    if (findError || !purchase) {
      console.error('Purchase not found for reference:', merchantRef);
      return res.status(404).json({ error: 'Purchase not found' });
    }

    if (success) {
      await supabase
        .from('bank_report_purchases')
        .update({
          status: 'completed',
          paymob_transaction_id: transactionId,
          paid_at: new Date().toISOString(),
        })
        .eq('id', purchase.id);

      // Clear the cart
      await supabase
        .from('bank_cart_items')
        .delete()
        .eq('bank_account_id', purchase.bank_account_id);

      return res.json({ received: true });
    }

    // Payment failed — clean up the pending purchase
    await supabase.from('bank_purchase_items').delete().eq('purchase_id', purchase.id);
    await supabase.from('bank_report_purchases').delete().eq('id', purchase.id);
    return res.json({ received: true });
  } catch (err) {
    console.error('Error processing bank purchase callback:', err);
    res.status(500).json({ error: 'Failed to process callback' });
  }
});

// ============================================================================
// BANK PURCHASED REPORTS
// ============================================================================

// Get purchase history
router.get('/bank/purchases', authMiddleware, bankMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const bankAccount = (req as AuthenticatedRequest & { bankAccount?: { id: string } }).bankAccount;

    if (!bankAccount?.id) {
      return res.status(400).json({ error: 'Bank account not found' });
    }

    const { data: purchases, error } = await supabase
      .from('bank_report_purchases')
      .select(`
        id,
        item_count,
        subtotal_piasters,
        discount_percent,
        discount_amount_piasters,
        total_piasters,
        status,
        created_at,
        paid_at,
        purchased_by(full_name)
      `)
      .eq('bank_account_id', bankAccount.id)
      .eq('status', 'completed')
      .order('paid_at', { ascending: false });

    if (error) throw error;

    res.json({ purchases: purchases || [] });
  } catch (err) {
    console.error('Error fetching purchases:', err);
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
});

// Get purchased listings
router.get('/bank/reports', authMiddleware, bankMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const bankAccount = (req as AuthenticatedRequest & { bankAccount?: { id: string } }).bankAccount;

    if (!bankAccount?.id) {
      return res.status(400).json({ error: 'Bank account not found' });
    }

    const { data: purchasedReports, error } = await supabase
      .from('bank_purchase_items')
      .select(`
        id,
        price_piasters,
        created_at,
        purchase:purchase_id(
          id,
          bank_account_id,
          status,
          paid_at
        ),
        listing:listing_id(
          id,
          property_type,
          approximate_area,
          bedrooms,
          bathrooms,
          report_kind,
          listed_at,
          valuation_amount_piasters,
          governorates(name_en, name_ar),
          cities(name_en, name_ar),
          districts(name_en, name_ar),
          appraiser:appraiser_id(full_name, fra_license_number)
        )
      `)
      .eq('purchase.bank_account_id', bankAccount.id)
      .eq('purchase.status', 'completed')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Filter to only show completed purchases
    const reports = ((purchasedReports || []) as unknown as Array<{ purchase: { status: string } | null }>).filter(
      (r) => r.purchase?.status === 'completed'
    );

    res.json({ reports });
  } catch (err) {
    console.error('Error fetching purchased reports:', err);
    res.status(500).json({ error: 'Failed to fetch purchased reports' });
  }
});

// View full report (only if purchased)
router.get('/bank/reports/:listingId', authMiddleware, bankMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const bankAccount = (req as AuthenticatedRequest & { bankAccount?: { id: string } }).bankAccount;
    const listingId = req.params.listingId;

    if (!bankAccount?.id) {
      return res.status(400).json({ error: 'Bank account not found' });
    }

    // Verify bank has purchased this listing
    const { data: purchaseItem, error: purchaseError } = await supabase
      .from('bank_purchase_items')
      .select(`
        id,
        purchase:purchase_id(
          bank_account_id,
          status
        )
      `)
      .eq('listing_id', listingId)
      .single();

    if (purchaseError || !purchaseItem) {
      return res.status(403).json({ error: 'Report not purchased' });
    }

    const pItem = purchaseItem as unknown as { purchase: { bank_account_id: string; status: string } | null };
    if (pItem.purchase?.bank_account_id !== bankAccount.id ||
        pItem.purchase?.status !== 'completed') {
      return res.status(403).json({ error: 'Report not purchased' });
    }

    // Get full listing with job details (anonymized)
    const { data: listing, error: listingError } = await supabase
      .from('report_listings')
      .select(`
        id,
        property_type,
        approximate_area,
        bedrooms,
        bathrooms,
        report_kind,
        listing_price_piasters,
        listed_at,
        valuation_amount_piasters,
        governorates(id, name_en, name_ar),
        cities(id, name_en, name_ar),
        districts(id, name_en, name_ar),
        appraiser:appraiser_id(
          id,
          full_name,
          fra_license_number,
          professional_title_en,
          professional_title_ar,
          years_experience
        ),
        job:job_request_id(
          report_kind,
          property_type,
          approximate_area,
          floor,
          bedrooms,
          bathrooms,
          created_at,
          completed_at,
          delivered_report_json
        )
      `)
      .eq('id', listingId)
      .single();

    if (listingError) throw listingError;

    const listingJob = (listing as unknown as { job?: { delivered_report_json?: Record<string, unknown> } | null })?.job;

    // Return full report data (anonymized - no client info, exact address, or photos)
    res.json({
      report: {
        listing,
        // Extract anonymized report content
        content: listingJob?.delivered_report_json ? {
          ...listingJob.delivered_report_json,
          // Remove any sensitive fields that might be in the JSON
          clientName: undefined,
          clientContact: undefined,
          exactAddress: undefined,
          photos: undefined,
          images: undefined,
        } : null,
      },
    });
  } catch (err) {
    console.error('Error fetching report:', err);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// ============================================================================
// SPRINT 5B: JOB REQUEST MARKETPLACE
// ============================================================================

// Get pricing for a job request
router.get('/marketplace/pricing', async (req: Request, res: Response) => {
  try {
    const supabase = getServiceClient();
    const { propertyType, reportKind, area, urgency, appraiserId } = req.query;

    let basePrice = 200000; // Default 2000 EGP
    let platformFeePercent = 15; // Default 15%

    // If appraiserId is provided, use appraiser's own pricing
    if (appraiserId) {
      const { data: appraiserPricing } = await supabase
        .from('appraiser_pricing')
        .select('*')
        .eq('appraiser_id', appraiserId)
        .eq('property_type', propertyType || 'apartment')
        .eq('report_kind', reportKind || 'brief')
        .eq('is_active', true)
        .single();

      if (appraiserPricing) {
        basePrice = appraiserPricing.price;
      }
    } else {
      // Use platform pricing config
      const { data: config } = await supabase
        .from('pricing_config')
        .select('*')
        .eq('property_type', propertyType || 'apartment')
        .eq('report_kind', reportKind || 'brief')
        .eq('is_active', true)
        .single();

      if (config) {
        basePrice = config.min_price;
        if (area && config.price_per_sqm) {
          basePrice = Math.max(
            config.min_price,
            Math.min(parseInt(area.toString()) * config.price_per_sqm, config.max_price)
          );
        }
        platformFeePercent = config.platform_fee_percent || 15;
      }
    }

    // Urgency multiplier
    let urgencyMult = 0;
    if (urgency === 'priority') urgencyMult = 0.5;
    else if (urgency === 'express') urgencyMult = 1.0;

    const urgencyFee = Math.round(basePrice * urgencyMult);
    const totalPrice = basePrice + urgencyFee;
    const platformFee = Math.round(totalPrice * platformFeePercent / 100);

    res.json({
      basePrice,
      urgencyFee,
      platformFee,
      totalPrice,
      appraiserAmount: totalPrice - platformFee,
    });
  } catch (err) {
    console.error('Error calculating pricing:', err);
    res.status(500).json({ error: 'Failed to calculate pricing' });
  }
});

// Create a job request (client) - Supports Direct Booking and Pool Booking
router.post('/jobs', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();

    const {
      appraiserId,  // Optional: specific appraiser for direct booking
      propertyType,
      governorateId,
      cityId,
      districtId,
      compoundId,
      addressDescription,
      approximateArea,
      floor,
      bedrooms,
      reportKind = 'brief',
      purpose,
      urgency = 'standard',
      specialInstructions,
    } = req.body;

    // Validate required fields
    if (!propertyType || !governorateId || !addressDescription) {
      return res.status(400).json({ error: 'Missing required fields: propertyType, governorateId, addressDescription' });
    }

    let basePrice = 200000; // Default 2000 EGP
    let platformFee: number;
    let assignedAppraiserId: string | null = null;
    let jobStatus: string;

    // Direct Booking: specific appraiser selected.
    // The client sends the appraiser_profiles.id (public id); resolve it to the
    // user, since assigned_appraiser_id and appraiser_pricing are keyed by users.id,
    // and the verification status lives on appraiser_profiles.status.
    if (appraiserId) {
      const { data: appraiserProfile } = await supabase
        .from('appraiser_profiles')
        .select('user_id, status')
        .eq('id', appraiserId)
        .single();

      if (!appraiserProfile) {
        return res.status(404).json({ error: 'Appraiser not found' });
      }
      if (appraiserProfile.status !== 'verified') {
        return res.status(400).json({ error: 'Appraiser is not verified' });
      }

      const { data: appraiserUser } = await supabase
        .from('users')
        .select('id, is_available_for_jobs')
        .eq('id', appraiserProfile.user_id)
        .single();

      if (appraiserUser?.is_available_for_jobs === false) {
        return res.status(400).json({ error: 'Appraiser is currently not accepting new jobs' });
      }

      // Appraiser's pricing for this property type and report kind (keyed by user id)
      const { data: appraiserPricing } = await supabase
        .from('appraiser_pricing')
        .select('price')
        .eq('appraiser_id', appraiserProfile.user_id)
        .eq('property_type', propertyType)
        .eq('report_kind', reportKind)
        .eq('is_active', true)
        .single();

      if (appraiserPricing) {
        basePrice = appraiserPricing.price;
      }

      assignedAppraiserId = appraiserProfile.user_id;
      jobStatus = 'pending_acceptance';  // Awaiting appraiser acceptance
    } else {
      // Pool Booking: no specific appraiser, use platform pricing
      const { data: config } = await supabase
        .from('pricing_config')
        .select('*')
        .eq('property_type', propertyType)
        .eq('report_kind', reportKind)
        .eq('is_active', true)
        .single();

      if (config) {
        basePrice = config.min_price;
        if (approximateArea && config.price_per_sqm) {
          basePrice = Math.max(
            config.min_price,
            Math.min(parseInt(approximateArea.toString()) * config.price_per_sqm, config.max_price)
          );
        }
      }

      jobStatus = 'pending_payment';  // Ready for payment, then pool assignment
    }

    // Calculate pricing with urgency multiplier
    let urgencyMultiplier = 1.0;
    if (urgency === 'priority') urgencyMultiplier = 1.5;
    else if (urgency === 'express') urgencyMultiplier = 2.0;

    const urgencyFee = Math.round(basePrice * (urgencyMultiplier - 1));
    const totalPrice = basePrice + urgencyFee;
    platformFee = Math.round(totalPrice * 0.15); // 15% platform fee

    // Calculate due date based on urgency
    const dueDate = new Date();
    switch (urgency) {
      case 'express': dueDate.setDate(dueDate.getDate() + 1); break;
      case 'priority': dueDate.setDate(dueDate.getDate() + 3); break;
      default: dueDate.setDate(dueDate.getDate() + 7);
    }

    // Create job request
    const { data: job, error } = await supabase
      .from('job_requests')
      .insert({
        client_id: req.user!.id,
        assigned_appraiser_id: assignedAppraiserId,
        property_type: propertyType,
        governorate_id: governorateId,
        city_id: cityId || null,
        district_id: districtId || null,
        compound_id: compoundId || null,
        address_description: addressDescription,
        approximate_area: approximateArea || null,
        floor: floor || null,
        bedrooms: bedrooms || null,
        report_kind: reportKind,
        purpose: purpose || null,
        urgency,
        special_instructions: specialInstructions || null,
        base_price: basePrice,
        urgency_fee: urgencyFee,
        platform_fee: platformFee,
        total_price: totalPrice,
        status: jobStatus,
        due_date: dueDate.toISOString().split('T')[0],
      })
      .select()
      .single();

    if (error) throw error;

    const message = appraiserId
      ? 'Request sent to appraiser. They will accept or decline your request.'
      : 'Job created. Proceed to payment to submit to the appraiser pool.';

    res.status(201).json({ job, message });
  } catch (err) {
    console.error('Error creating job request:', err);
    res.status(500).json({ error: 'Failed to create job request', detail: (err as Error).message });
  }
});

// List job requests (for client or appraiser)
router.get('/jobs', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const { status, role } = req.query;

    let query = supabase
      .from('job_requests')
      .select(`
        *,
        governorates(id, name_en, name_ar),
        cities(id, name_en, name_ar),
        districts(id, name_en, name_ar),
        compounds(id, name),
        client:users!job_requests_client_id_fkey(id, full_name, email),
        appraiser:users!job_requests_assigned_appraiser_id_fkey(id, full_name, email)
      `)
      .order('created_at', { ascending: false });

    // Filter by user role
    if (role === 'appraiser' || req.user!.role === 'appraiser') {
      // Appraisers see jobs assigned to them or available in their areas
      query = query.or(`assigned_appraiser_id.eq.${req.user!.id},and(status.eq.paid,assigned_appraiser_id.is.null)`);
    } else {
      // Clients see their own jobs
      query = query.eq('client_id', req.user!.id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: jobs, error } = await query;

    if (error) throw error;

    res.json({ jobs: jobs || [] });
  } catch (err) {
    console.error('Error listing jobs:', err);
    res.status(500).json({ error: 'Failed to list jobs' });
  }
});

// Get single job request
router.get('/jobs/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const { id } = req.params;

    const { data: job, error } = await supabase
      .from('job_requests')
      .select(`
        *,
        governorates(id, name_en, name_ar),
        cities(id, name_en, name_ar),
        districts(id, name_en, name_ar),
        compounds(id, name),
        client:users!job_requests_client_id_fkey(id, full_name, email),
        appraiser:users!job_requests_assigned_appraiser_id_fkey(id, full_name, email),
        delivered_report:reports(id, status, final_value)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    // Check access
    if (
      job.client_id !== req.user!.id &&
      job.assigned_appraiser_id !== req.user!.id &&
      req.user!.role !== 'admin'
    ) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ job });
  } catch (err) {
    console.error('Error fetching job:', err);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// Update job request (client - before payment)
router.patch('/jobs/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const { id } = req.params;

    // Get current job
    const { data: job, error: fetchError } = await supabase
      .from('job_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Only client can update, only in draft status
    if (job.client_id !== req.user!.id) {
      return res.status(403).json({ error: 'Only job owner can update' });
    }

    if (job.status !== 'draft') {
      return res.status(400).json({ error: 'Can only update draft jobs' });
    }

    const { data: updated, error } = await supabase
      .from('job_requests')
      .update(req.body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ job: updated });
  } catch (err) {
    console.error('Error updating job:', err);
    res.status(500).json({ error: 'Failed to update job' });
  }
});

// Cancel job request (client - before assignment)
router.post('/jobs/:id/cancel', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const { id } = req.params;

    const { data: job, error: fetchError } = await supabase
      .from('job_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.client_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Can cancel: draft, pending_acceptance, accepted, pending_payment, paid (with refund)
    // Cannot cancel: in_progress, delivered, completed, disputed
    const cancellableStatuses = ['draft', 'pending_acceptance', 'accepted', 'pending_payment', 'paid'];
    if (!cancellableStatuses.includes(job.status)) {
      return res.status(400).json({
        error: 'Cannot cancel job in current status. Job is already in progress or completed.'
      });
    }

    // If paid, initiate refund
    if (job.status === 'paid') {
      // Get payment record with transaction ID
      const { data: payment } = await supabase
        .from('payments')
        .select('*')
        .eq('job_request_id', id)
        .eq('status', 'completed')
        .single();

      if (!payment || !payment.paymob_transaction_id) {
        return res.status(400).json({ error: 'No completed payment found for this job' });
      }

      // Trigger refund via Paymob
      try {
        await paymob.refundTransaction(
          parseInt(payment.paymob_transaction_id),
          payment.amount
        );

        // Update payment status to refund_pending (will be confirmed by callback)
        await supabase
          .from('payments')
          .update({ status: 'refund_pending' })
          .eq('id', payment.id);

        // Update job status
        await supabase
          .from('job_requests')
          .update({ status: 'refunded', cancelled_at: new Date().toISOString() })
          .eq('id', id);

        // Notify client and appraiser
        if (job.assigned_appraiser_id) {
          await supabase.from('notifications').insert({
            user_id: job.assigned_appraiser_id,
            type: 'job_cancelled',
            title: 'Job Cancelled',
            message: 'A job has been cancelled and refunded.',
            job_id: id,
          });
        }
      } catch (refundErr) {
        console.error('Paymob refund failed:', refundErr);
        return res.status(500).json({
          error: 'Refund failed. Please contact support.',
          details: refundErr instanceof Error ? refundErr.message : 'Unknown error'
        });
      }
    } else {
      await supabase
        .from('job_requests')
        .update({ status: 'cancelled' })
        .eq('id', id);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error cancelling job:', err);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

// Accept job (appraiser)
router.post('/jobs/:id/accept', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const { id } = req.params;

    // Verify appraiser is verified
    const { data: profile } = await supabase
      .from('appraiser_profiles')
      .select('status')
      .eq('user_id', req.user!.id)
      .single();

    if (!profile || profile.status !== 'verified') {
      return res.status(403).json({ error: 'Only verified appraisers can accept jobs' });
    }

    // Get job
    const { data: job, error: fetchError } = await supabase
      .from('job_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'paid') {
      return res.status(400).json({ error: 'Job is not available for assignment' });
    }

    if (job.assigned_appraiser_id) {
      return res.status(400).json({ error: 'Job already assigned' });
    }

    // Assign to this appraiser
    const { data: updated, error } = await supabase
      .from('job_requests')
      .update({
        assigned_appraiser_id: req.user!.id,
        assigned_at: new Date().toISOString(),
        status: 'assigned',
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ job: updated });
  } catch (err) {
    console.error('Error accepting job:', err);
    res.status(500).json({ error: 'Failed to accept job' });
  }
});

// Start working on job (appraiser)
router.post('/jobs/:id/start', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const { id } = req.params;

    const { data: job } = await supabase
      .from('job_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (!job || job.assigned_appraiser_id !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (job.status !== 'assigned') {
      return res.status(400).json({ error: 'Job is not in assigned status' });
    }

    const { data: updated, error } = await supabase
      .from('job_requests')
      .update({ status: 'in_progress' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ job: updated });
  } catch (err) {
    console.error('Error starting job:', err);
    res.status(500).json({ error: 'Failed to start job' });
  }
});

// Deliver report (appraiser)
router.post('/jobs/:id/deliver', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const { id } = req.params;
    const { reportId } = req.body;

    if (!reportId) {
      return res.status(400).json({ error: 'reportId is required' });
    }

    const { data: job } = await supabase
      .from('job_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (!job || job.assigned_appraiser_id !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!['assigned', 'in_progress'].includes(job.status)) {
      return res.status(400).json({ error: 'Job is not in correct status for delivery' });
    }

    // Verify report is finalized
    const { data: report } = await supabase
      .from('reports')
      .select('status')
      .eq('id', reportId)
      .single();

    if (!report || report.status !== 'finalized') {
      return res.status(400).json({ error: 'Report must be finalized before delivery' });
    }

    const { data: updated, error } = await supabase
      .from('job_requests')
      .update({
        delivered_report_id: reportId,
        delivered_at: new Date().toISOString(),
        status: 'delivered',
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ job: updated });
  } catch (err) {
    console.error('Error delivering job:', err);
    res.status(500).json({ error: 'Failed to deliver job' });
  }
});

// Complete job (client accepts delivery)
router.post('/jobs/:id/complete', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const { id } = req.params;
    const { rating, feedback } = req.body;

    const { data: job } = await supabase
      .from('job_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (!job || job.client_id !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (job.status !== 'delivered') {
      return res.status(400).json({ error: 'Job is not in delivered status' });
    }

    // Update job
    const { data: updated, error } = await supabase
      .from('job_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        client_rating: rating || null,
        client_feedback: feedback || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Create payout record for appraiser
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('job_request_id', id)
      .eq('status', 'completed')
      .single();

    if (payment) {
      await supabase.from('payouts').insert({
        appraiser_id: job.assigned_appraiser_id,
        job_request_id: id,
        payment_id: payment.id,
        amount: payment.appraiser_amount,
        status: 'pending',
      });
    }

    // Create review for appraiser if rating provided
    if (rating) {
      await supabase.from('reviews').insert({
        appraiser_id: job.assigned_appraiser_id,
        reviewer_id: req.user!.id,
        rating,
        comment: feedback || null,
      });
    }

    res.json({ job: updated });
  } catch (err) {
    console.error('Error completing job:', err);
    res.status(500).json({ error: 'Failed to complete job' });
  }
});

// ============================================================================
// PAYMOB PAYMENT INTEGRATION
// ============================================================================

// Initiate payment for job
router.post('/payments/initiate', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const { jobId } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }

    // Verify Paymob is configured
    if (!paymob.isConfigured()) {
      return res.status(503).json({
        error: 'Payment gateway not configured. Please contact support.',
      });
    }

    // Get job
    const { data: job } = await supabase
      .from('job_requests')
      .select('*')
      .eq('id', jobId)
      .single();

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.client_id !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Allow payment for draft (pool booking) or accepted (direct booking)
    if (!['draft', 'accepted'].includes(job.status)) {
      return res.status(400).json({ error: 'Job is not ready for payment' });
    }

    // Get user info for billing
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user!.id)
      .single();

    // Create payment record
    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        job_request_id: jobId,
        payer_id: req.user!.id,
        amount: job.total_price,
        platform_fee: job.platform_fee,
        appraiser_amount: job.total_price - job.platform_fee,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Update job status
    await supabase
      .from('job_requests')
      .update({ status: 'pending_payment' })
      .eq('id', jobId);

    // Parse user name for billing
    const nameParts = (user?.full_name || 'N/A').split(' ');
    const firstName = nameParts[0] || 'N/A';
    const lastName = nameParts.slice(1).join(' ') || 'N/A';

    // Initiate Paymob payment (Intention API). special_reference = payment.id,
    // which Paymob echoes back on the webhook as order.merchant_order_id.
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const paymobResult = await paymob.initiatePayment(
      job.total_price, // amount in piasters
      payment.id,
      {
        firstName,
        lastName,
        email: user?.email || req.user!.email,
        phone: user?.phone || '+201000000000',
        city: 'Cairo',
        country: 'EG',
      },
      {
        customer: { firstName, lastName, email: user?.email || req.user!.email },
        notificationUrl: `${appUrl}/api/payments/paymob-callback`,
        redirectionUrl: `${appUrl}/marketplace/jobs/${jobId}`,
      }
    );

    // Store the intention id for reference (matching is via merchant_order_id).
    await supabase
      .from('payments')
      .update({ paymob_order_id: paymobResult.intentionId })
      .eq('id', payment.id);

    res.json({
      payment,
      paymob: {
        checkoutUrl: paymobResult.checkoutUrl,
      },
    });
  } catch (err) {
    console.error('Error initiating payment:', err);
    res.status(500).json({ error: 'Failed to initiate payment' });
  }
});

// Paymob webhook callback
router.post('/payments/paymob-callback', async (req: Request, res: Response) => {
  try {
    const supabase = getServiceClient();
    const callbackData = req.body;

    // Get HMAC from query parameter (Paymob sends it as ?hmac=xxx)
    const receivedHmac = req.query.hmac as string;

    // Verify HMAC signature - MANDATORY for production security
    if (!receivedHmac) {
      console.error('Paymob callback missing HMAC signature');
      return res.status(400).json({ error: 'Missing HMAC signature' });
    }

    if (!paymob.verifyHmac(callbackData, receivedHmac)) {
      console.error('Paymob callback HMAC verification failed');
      return res.status(401).json({ error: 'Invalid HMAC signature' });
    }

    const transactionId = callbackData.obj?.id?.toString();
    // Intention API echoes our special_reference (payment.id) here.
    const merchantRef = callbackData.obj?.order?.merchant_order_id as string | undefined;
    const success = callbackData.obj?.success === true;
    const isRefunded = callbackData.obj?.is_refunded === true;
    const isVoided = callbackData.obj?.is_voided === true;

    if (!merchantRef) {
      return res.status(400).json({ error: 'Missing merchant reference' });
    }

    // Find payment by our reference (special_reference == payment.id)
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('id', merchantRef)
      .single();

    if (!payment) {
      console.error('Payment not found for Paymob reference:', merchantRef);
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Handle refund/void callbacks
    if (isRefunded || isVoided) {
      await supabase
        .from('payments')
        .update({
          status: isRefunded ? 'refunded' : 'voided',
          callback_data: callbackData,
        })
        .eq('id', payment.id);

      await supabase
        .from('job_requests')
        .update({ status: 'refunded' })
        .eq('id', payment.job_request_id);

      return res.json({ received: true });
    }

    if (success) {
      // Update payment as completed
      await supabase
        .from('payments')
        .update({
          status: 'completed',
          paymob_transaction_id: transactionId,
          paid_at: new Date().toISOString(),
          callback_data: callbackData,
        })
        .eq('id', payment.id);

      // Update job status
      await supabase
        .from('job_requests')
        .update({ status: 'paid' })
        .eq('id', payment.job_request_id);

      // Create platform fee record
      // Paymob fee is approximately 2.5% + fixed fee, adjust based on actual contract
      const processorFee = Math.round(payment.amount * 0.025);
      await supabase.from('platform_fees').insert({
        payment_id: payment.id,
        job_request_id: payment.job_request_id,
        gross_amount: payment.amount,
        platform_fee: payment.platform_fee,
        payment_processor_fee: processorFee,
        net_revenue: payment.platform_fee - processorFee,
      });
    } else {
      // Payment failed
      const errorMessage = callbackData.obj?.data?.message || 'Payment declined';
      await supabase
        .from('payments')
        .update({
          status: 'failed',
          callback_data: callbackData,
        })
        .eq('id', payment.id);

      // Revert job to draft so user can try again
      await supabase
        .from('job_requests')
        .update({ status: 'draft' })
        .eq('id', payment.job_request_id);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Error processing Paymob callback:', err);
    res.status(500).json({ error: 'Failed to process callback' });
  }
});

// ============================================================================
// APPRAISER: DIRECT BOOKING
// ============================================================================

// Get incoming job requests (pending acceptance)
router.get('/appraiser/requests', authMiddleware, appraiserMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const appraiserId = req.user!.id;

    const { data: requests, error } = await supabase
      .from('job_requests')
      .select(`
        id,
        property_type,
        report_kind,
        urgency,
        status,
        address_description,
        approximate_area,
        floor,
        bedrooms,
        total_price,
        platform_fee,
        due_date,
        special_instructions,
        created_at,
        governorate_id,
        governorates(id, name_en, name_ar),
        city_id,
        cities(id, name_en, name_ar),
        district_id,
        districts(id, name_en, name_ar),
        client:client_id(id, full_name, email)
      `)
      .eq('assigned_appraiser_id', appraiserId)
      .eq('status', 'pending_acceptance')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const requestsWithEarnings = (requests || []).map(req => ({
      ...req,
      appraiser_earnings: req.total_price - req.platform_fee,
    }));

    res.json({ requests: requestsWithEarnings });
  } catch (err) {
    console.error('Error fetching requests:', err);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Get appraiser's active jobs
router.get('/appraiser/my-jobs', authMiddleware, appraiserMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const appraiserId = req.user!.id;
    const { status } = req.query;

    let query = supabase
      .from('job_requests')
      .select(`
        id,
        property_type,
        report_kind,
        urgency,
        status,
        address_description,
        approximate_area,
        floor,
        bedrooms,
        total_price,
        platform_fee,
        due_date,
        special_instructions,
        created_at,
        accepted_at,
        started_at,
        governorate_id,
        governorates(id, name_en, name_ar),
        city_id,
        cities(id, name_en, name_ar),
        district_id,
        districts(id, name_en, name_ar),
        client:client_id(id, full_name, email)
      `)
      .eq('assigned_appraiser_id', appraiserId)
      .order('due_date', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    } else {
      // Show accepted (awaiting payment), paid, in_progress, delivered
      query = query.in('status', ['accepted', 'paid', 'in_progress', 'delivered']);
    }

    const { data: jobs, error } = await query;

    if (error) throw error;

    const jobsWithEarnings = (jobs || []).map(job => ({
      ...job,
      appraiser_earnings: job.total_price - job.platform_fee,
    }));

    res.json({ jobs: jobsWithEarnings });
  } catch (err) {
    console.error('Error fetching appraiser jobs:', err);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// Get single job for appraiser (with full details)
router.get('/appraiser/jobs/:id', authMiddleware, appraiserMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const appraiserId = req.user!.id;
    const jobId = req.params.id;

    const { data: job, error } = await supabase
      .from('job_requests')
      .select(`
        id,
        property_type,
        report_kind,
        urgency,
        status,
        address_description,
        approximate_area,
        floor,
        bedrooms,
        bathrooms,
        total_price,
        platform_fee,
        due_date,
        special_instructions,
        created_at,
        accepted_at,
        started_at,
        delivered_at,
        governorate_id,
        governorates(id, name_en, name_ar),
        city_id,
        cities(id, name_en, name_ar),
        district_id,
        districts(id, name_en, name_ar),
        client:client_id(id, full_name, email, phone)
      `)
      .eq('id', jobId)
      .eq('assigned_appraiser_id', appraiserId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Job not found' });
      }
      throw error;
    }

    res.json({
      job: {
        ...job,
        appraiser_earnings: job.total_price - job.platform_fee,
      },
    });
  } catch (err) {
    console.error('Error fetching job:', err);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// ============================================================================
// APPRAISER PRICING ROUTES
// ============================================================================

// Get appraiser's pricing
router.get('/appraiser/pricing', authMiddleware, appraiserMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const appraiserId = req.user!.id;

    const { data: pricing, error } = await supabase
      .from('appraiser_pricing')
      .select('*')
      .eq('appraiser_id', appraiserId)
      .order('property_type')
      .order('report_kind');

    if (error) throw error;

    res.json({ pricing: pricing || [] });
  } catch (err) {
    console.error('Error fetching appraiser pricing:', err);
    res.status(500).json({ error: 'Failed to fetch pricing' });
  }
});

// Create new pricing entry
router.post('/appraiser/pricing', authMiddleware, appraiserMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const appraiserId = req.user!.id;
    const { propertyType, reportKind, price } = req.body;

    if (!propertyType || !reportKind || !price) {
      return res.status(400).json({ error: 'Missing required fields: propertyType, reportKind, price' });
    }

    // Check if pricing already exists for this combination
    const { data: existing } = await supabase
      .from('appraiser_pricing')
      .select('id')
      .eq('appraiser_id', appraiserId)
      .eq('property_type', propertyType)
      .eq('report_kind', reportKind)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Pricing already exists for this property type and report kind' });
    }

    const { data: pricing, error } = await supabase
      .from('appraiser_pricing')
      .insert({
        appraiser_id: appraiserId,
        property_type: propertyType,
        report_kind: reportKind,
        price: price,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ pricing });
  } catch (err) {
    console.error('Error creating appraiser pricing:', err);
    res.status(500).json({ error: 'Failed to create pricing' });
  }
});

// Update pricing entry
router.put('/appraiser/pricing/:id', authMiddleware, appraiserMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const appraiserId = req.user!.id;
    const pricingId = req.params.id;
    const { price, isActive } = req.body;

    // Verify ownership
    const { data: existing } = await supabase
      .from('appraiser_pricing')
      .select('id')
      .eq('id', pricingId)
      .eq('appraiser_id', appraiserId)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Pricing not found' });
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (price !== undefined) updateData.price = price;
    if (isActive !== undefined) updateData.is_active = isActive;

    const { data: pricing, error } = await supabase
      .from('appraiser_pricing')
      .update(updateData)
      .eq('id', pricingId)
      .select()
      .single();

    if (error) throw error;

    res.json({ pricing });
  } catch (err) {
    console.error('Error updating appraiser pricing:', err);
    res.status(500).json({ error: 'Failed to update pricing' });
  }
});

// Delete pricing entry
router.delete('/appraiser/pricing/:id', authMiddleware, appraiserMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const appraiserId = req.user!.id;
    const pricingId = req.params.id;

    // Verify ownership and delete
    const { error } = await supabase
      .from('appraiser_pricing')
      .delete()
      .eq('id', pricingId)
      .eq('appraiser_id', appraiserId);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting appraiser pricing:', err);
    res.status(500).json({ error: 'Failed to delete pricing' });
  }
});

// Accept a job request
router.post('/appraiser/jobs/:id/accept', authMiddleware, appraiserMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const appraiserId = req.user!.id;
    const jobId = req.params.id;

    const { data, error } = await supabase.rpc('accept_job_request', {
      p_job_id: jobId,
      p_appraiser_id: appraiserId,
    });

    if (error) throw error;

    if (!data.success) {
      return res.status(400).json({ error: data.error });
    }

    res.json({ success: true, message: 'Job accepted. Awaiting client payment.', jobId });
  } catch (err) {
    console.error('Error accepting job:', err);
    res.status(500).json({ error: 'Failed to accept job' });
  }
});

// Decline a job request
router.post('/appraiser/jobs/:id/decline', authMiddleware, appraiserMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const appraiserId = req.user!.id;
    const jobId = req.params.id;
    const { reason } = req.body;

    const { data, error } = await supabase.rpc('decline_job_request', {
      p_job_id: jobId,
      p_appraiser_id: appraiserId,
      p_reason: reason || null,
    });

    if (error) throw error;

    if (!data.success) {
      return res.status(400).json({ error: data.error });
    }

    res.json({ success: true, message: 'Job declined.', jobId });
  } catch (err) {
    console.error('Error declining job:', err);
    res.status(500).json({ error: 'Failed to decline job' });
  }
});

// Start working on a job (after payment)
router.post('/appraiser/jobs/:id/start', authMiddleware, appraiserMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const appraiserId = req.user!.id;
    const jobId = req.params.id;

    const { data, error } = await supabase.rpc('start_job', {
      p_job_id: jobId,
      p_appraiser_id: appraiserId,
    });

    if (error) throw error;

    if (!data.success) {
      return res.status(400).json({ error: data.error });
    }

    res.json({ success: true, message: 'Job started', jobId });
  } catch (err) {
    console.error('Error starting job:', err);
    res.status(500).json({ error: 'Failed to start job' });
  }
});

// Get appraiser's pricing
router.get('/appraiser/pricing', authMiddleware, appraiserMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const appraiserId = req.user!.id;

    const { data: pricing, error } = await supabase
      .from('appraiser_pricing')
      .select('*')
      .eq('appraiser_id', appraiserId)
      .order('property_type')
      .order('report_kind');

    if (error) throw error;

    res.json({ pricing: pricing || [] });
  } catch (err) {
    console.error('Error fetching pricing:', err);
    res.status(500).json({ error: 'Failed to fetch pricing' });
  }
});

// Set appraiser's pricing
router.post('/appraiser/pricing', authMiddleware, appraiserMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const appraiserId = req.user!.id;
    const { property_type, report_kind, price } = req.body;

    if (!property_type || !report_kind || !price) {
      return res.status(400).json({ error: 'property_type, report_kind, and price are required' });
    }

    if (!Number.isInteger(price) || price <= 0) {
      return res.status(400).json({ error: 'price must be a positive integer (in piasters)' });
    }

    const { data: pricing, error } = await supabase
      .from('appraiser_pricing')
      .upsert({
        appraiser_id: appraiserId,
        property_type,
        report_kind,
        price,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'appraiser_id,property_type,report_kind',
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ pricing });
  } catch (err) {
    console.error('Error setting pricing:', err);
    res.status(500).json({ error: 'Failed to set pricing' });
  }
});

// Delete appraiser's pricing
router.delete('/appraiser/pricing/:id', authMiddleware, appraiserMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const appraiserId = req.user!.id;
    const { id } = req.params;

    const { error } = await supabase
      .from('appraiser_pricing')
      .delete()
      .eq('id', id)
      .eq('appraiser_id', appraiserId);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting pricing:', err);
    res.status(500).json({ error: 'Failed to delete pricing' });
  }
});

// Get appraiser's service areas
router.get('/appraiser/service-areas', authMiddleware, appraiserMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const appraiserId = req.user!.id;

    const { data: areas, error } = await supabase
      .from('appraiser_service_areas')
      .select(`
        id,
        governorate_id,
        is_active,
        governorates(id, name_en, name_ar)
      `)
      .eq('appraiser_id', appraiserId);

    if (error) throw error;

    res.json({ serviceAreas: areas || [] });
  } catch (err) {
    console.error('Error fetching service areas:', err);
    res.status(500).json({ error: 'Failed to fetch service areas' });
  }
});

// Update appraiser's service areas
router.put('/appraiser/service-areas', authMiddleware, appraiserMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const appraiserId = req.user!.id;
    const { governorateIds } = req.body;

    if (!Array.isArray(governorateIds)) {
      return res.status(400).json({ error: 'governorateIds must be an array' });
    }

    // Delete existing service areas
    await supabase
      .from('appraiser_service_areas')
      .delete()
      .eq('appraiser_id', appraiserId);

    // Insert new service areas
    if (governorateIds.length > 0) {
      const inserts = governorateIds.map(govId => ({
        appraiser_id: appraiserId,
        governorate_id: govId,
        is_active: true,
      }));

      const { error } = await supabase
        .from('appraiser_service_areas')
        .insert(inserts);

      if (error) throw error;
    }

    res.json({ success: true, message: 'Service areas updated' });
  } catch (err) {
    console.error('Error updating service areas:', err);
    res.status(500).json({ error: 'Failed to update service areas' });
  }
});

// Update appraiser availability
router.put('/appraiser/availability', authMiddleware, appraiserMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const appraiserId = req.user!.id;
    const { isAvailable, maxConcurrentJobs } = req.body;

    const updates: Record<string, unknown> = {};
    if (typeof isAvailable === 'boolean') {
      updates.is_available_for_jobs = isAvailable;
    }
    if (typeof maxConcurrentJobs === 'number' && maxConcurrentJobs > 0) {
      updates.max_concurrent_jobs = maxConcurrentJobs;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', appraiserId);

    if (error) throw error;

    res.json({ success: true, message: 'Availability updated' });
  } catch (err) {
    console.error('Error updating availability:', err);
    res.status(500).json({ error: 'Failed to update availability' });
  }
});

// Get appraiser stats
router.get('/appraiser/stats', authMiddleware, appraiserMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const appraiserId = req.user!.id;

    // Get job counts by status
    const { data: jobs } = await supabase
      .from('job_requests')
      .select('status, total_price, platform_fee')
      .eq('assigned_appraiser_id', appraiserId);

    const stats = {
      pending_acceptance: 0,
      accepted: 0,
      in_progress: 0,
      delivered: 0,
      completed: 0,
      total_completed: 0,
      total_earnings: 0,
    };

    (jobs || []).forEach(job => {
      if (job.status === 'pending_acceptance') stats.pending_acceptance++;
      else if (job.status === 'accepted') stats.accepted++;
      else if (job.status === 'in_progress') stats.in_progress++;
      else if (job.status === 'delivered') stats.delivered++;
      else if (job.status === 'completed') {
        stats.completed++;
        stats.total_completed++;
        stats.total_earnings += (job.total_price - job.platform_fee);
      }
    });

    res.json({ stats });
  } catch (err) {
    console.error('Error fetching appraiser stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// PUBLIC: Get appraiser's pricing (for booking page)
router.get('/appraisers/:id/pricing', async (req: Request, res: Response) => {
  try {
    const supabase = getServiceClient();
    const { id } = req.params;

    const { data: pricing, error } = await supabase
      .from('appraiser_pricing')
      .select('*')
      .eq('appraiser_id', id)
      .eq('is_active', true)
      .order('property_type')
      .order('report_kind');

    if (error) throw error;

    res.json({ pricing: pricing || [] });
  } catch (err) {
    console.error('Error fetching appraiser pricing:', err);
    res.status(500).json({ error: 'Failed to fetch pricing' });
  }
});

// PUBLIC: Get appraiser's service areas (for booking page)
router.get('/appraisers/:id/service-areas', async (req: Request, res: Response) => {
  try {
    const supabase = getServiceClient();
    const { id } = req.params;

    const { data: areas, error } = await supabase
      .from('appraiser_service_areas')
      .select(`
        id,
        governorate_id,
        governorates(id, name_en, name_ar)
      `)
      .eq('appraiser_id', id)
      .eq('is_active', true);

    if (error) throw error;

    res.json({ serviceAreas: areas || [] });
  } catch (err) {
    console.error('Error fetching service areas:', err);
    res.status(500).json({ error: 'Failed to fetch service areas' });
  }
});

// ============================================================================
// ADMIN: BANK MANAGEMENT
// ============================================================================

// List bank accounts (admin)
router.get('/admin/banks', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();

    const { data: banks, error } = await supabase
      .from('bank_accounts')
      .select(`
        *,
        bank_users(id, user_id, role, users(id, full_name, email))
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ banks: banks || [] });
  } catch (err) {
    console.error('Error listing banks:', err);
    res.status(500).json({ error: 'Failed to list banks' });
  }
});

// Create bank account (admin)
router.post('/admin/banks', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();

    const {
      name,
      nameAr,
      contactEmail,
      contactPhone,
      subscriptionTier = 'trial',
      allowedGovernorateIds = [],
      monthlyQueryLimit = 100,
    } = req.body;

    if (!name || !contactEmail) {
      return res.status(400).json({ error: 'name and contactEmail are required' });
    }

    // Calculate subscription expiry
    let subscriptionExpiresAt = null;
    if (subscriptionTier === 'trial') {
      subscriptionExpiresAt = new Date();
      subscriptionExpiresAt.setDate(subscriptionExpiresAt.getDate() + 14);
    }

    const { data: bank, error } = await supabase
      .from('bank_accounts')
      .insert({
        name,
        name_ar: nameAr || null,
        contact_email: contactEmail,
        contact_phone: contactPhone || null,
        subscription_tier: subscriptionTier,
        subscription_expires_at: subscriptionExpiresAt?.toISOString() || null,
        allowed_governorate_ids: allowedGovernorateIds,
        monthly_query_limit: monthlyQueryLimit,
        api_enabled: subscriptionTier === 'enterprise',
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ bank });
  } catch (err) {
    console.error('Error creating bank:', err);
    res.status(500).json({ error: 'Failed to create bank' });
  }
});

// Add user to bank account (admin)
router.post('/admin/banks/:bankId/users', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const { bankId } = req.params;
    const { userId, role = 'viewer' } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Verify user exists and update role to 'bank'
    const { error: userError } = await supabase
      .from('users')
      .update({ role: 'bank' })
      .eq('id', userId);

    if (userError) throw userError;

    // Add to bank_users
    const { data: bankUser, error } = await supabase
      .from('bank_users')
      .insert({
        user_id: userId,
        bank_account_id: bankId,
        role,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ bankUser });
  } catch (err) {
    console.error('Error adding bank user:', err);
    res.status(500).json({ error: 'Failed to add bank user' });
  }
});

// ============================================================================
// INNGEST BACKGROUND JOB ENDPOINT
// ============================================================================

import { serve } from 'inngest/express';
import { inngest } from './inngest/client';
import { functions as inngestFunctions } from './inngest/functions';

// Inngest serve endpoint - handles function discovery and execution
router.use('/inngest', serve({
  client: inngest,
  functions: inngestFunctions,
}));

// ============================================================================
// ADMIN: PRICING CONFIGURATION
// ============================================================================

// Get all pricing configurations
router.get('/admin/pricing', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();

    const { data: pricing, error } = await supabase
      .from('pricing_config')
      .select('*')
      .order('property_type')
      .order('report_kind');

    if (error) throw error;

    res.json({ pricing: pricing || [] });
  } catch (err) {
    console.error('Error fetching pricing:', err);
    res.status(500).json({ error: 'Failed to fetch pricing configuration' });
  }
});

// Create pricing configuration
router.post('/admin/pricing', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const {
      property_type,
      report_kind,
      min_price,
      max_price,
      price_per_sqm,
      priority_multiplier,
      express_multiplier,
      platform_fee_percent,
    } = req.body;

    if (!property_type || !report_kind || !min_price || !max_price) {
      return res.status(400).json({
        error: 'property_type, report_kind, min_price, and max_price are required',
      });
    }

    // Validate prices are positive integers (piasters)
    if (!Number.isInteger(min_price) || min_price <= 0) {
      return res.status(400).json({
        error: 'min_price must be a positive integer (in piasters)',
      });
    }
    if (!Number.isInteger(max_price) || max_price <= 0) {
      return res.status(400).json({
        error: 'max_price must be a positive integer (in piasters)',
      });
    }
    if (min_price > max_price) {
      return res.status(400).json({
        error: 'min_price cannot be greater than max_price',
      });
    }

    const insertData: Record<string, unknown> = {
      property_type,
      report_kind,
      min_price,
      max_price,
    };

    if (price_per_sqm !== undefined) {
      insertData.price_per_sqm = price_per_sqm;
    }
    if (priority_multiplier !== undefined) {
      insertData.priority_multiplier = priority_multiplier;
    }
    if (express_multiplier !== undefined) {
      insertData.express_multiplier = express_multiplier;
    }
    if (platform_fee_percent !== undefined) {
      insertData.platform_fee_percent = platform_fee_percent;
    }

    const { data: pricing, error } = await supabase
      .from('pricing_config')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({
          error: 'Pricing configuration already exists for this property_type and report_kind',
        });
      }
      throw error;
    }

    res.status(201).json({ pricing });
  } catch (err) {
    console.error('Error creating pricing:', err);
    res.status(500).json({ error: 'Failed to create pricing configuration' });
  }
});

// Update pricing configuration
router.put('/admin/pricing/:id', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const { id } = req.params;
    const {
      min_price,
      max_price,
      price_per_sqm,
      priority_multiplier,
      express_multiplier,
      platform_fee_percent,
      is_active,
    } = req.body;

    const updates: Record<string, unknown> = {};

    if (min_price !== undefined) {
      if (!Number.isInteger(min_price) || min_price <= 0) {
        return res.status(400).json({
          error: 'min_price must be a positive integer (in piasters)',
        });
      }
      updates.min_price = min_price;
    }

    if (max_price !== undefined) {
      if (!Number.isInteger(max_price) || max_price <= 0) {
        return res.status(400).json({
          error: 'max_price must be a positive integer (in piasters)',
        });
      }
      updates.max_price = max_price;
    }

    if (price_per_sqm !== undefined) {
      updates.price_per_sqm = price_per_sqm;
    }

    if (priority_multiplier !== undefined) {
      updates.priority_multiplier = priority_multiplier;
    }

    if (express_multiplier !== undefined) {
      updates.express_multiplier = express_multiplier;
    }

    if (platform_fee_percent !== undefined) {
      updates.platform_fee_percent = platform_fee_percent;
    }

    if (is_active !== undefined) {
      updates.is_active = Boolean(is_active);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { data: pricing, error } = await supabase
      .from('pricing_config')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (!pricing) {
      return res.status(404).json({ error: 'Pricing configuration not found' });
    }

    res.json({ pricing });
  } catch (err) {
    console.error('Error updating pricing:', err);
    res.status(500).json({ error: 'Failed to update pricing configuration' });
  }
});

// Delete pricing configuration
router.delete('/admin/pricing/:id', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const { id } = req.params;

    const { error } = await supabase
      .from('pricing_config')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting pricing:', err);
    res.status(500).json({ error: 'Failed to delete pricing configuration' });
  }
});

// ============================================================================
// NOTIFICATIONS (Sprint 6B)
// ============================================================================

// Get user notifications
router.get('/notifications', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = req.supabase!;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const unreadOnly = req.query.unread === 'true';

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data: notifications, error } = await query;

    if (error) throw error;

    // Get unread count
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user!.id)
      .eq('is_read', false);

    res.json({ notifications, unreadCount: unreadCount || 0 });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.post('/notifications/:id/read', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = req.supabase!;
    const { id } = req.params;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', req.user!.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.post('/notifications/read-all', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = req.supabase!;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', req.user!.id)
      .eq('is_read', false);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// ============================================================================
// REPORT DELIVERY (Sprint 6B)
// ============================================================================

// Deliver a report (appraiser)
router.post('/appraiser/jobs/:id/deliver', authMiddleware, appraiserMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const { id } = req.params;
    const { fileName, filePath, fileSize, fileType, reportType, notes } = req.body;

    if (!fileName || !filePath) {
      return res.status(400).json({ error: 'fileName and filePath are required' });
    }

    const { data, error } = await supabase.rpc('deliver_report', {
      p_job_id: id,
      p_appraiser_id: req.user!.id,
      p_file_name: fileName,
      p_file_path: filePath,
      p_file_size: fileSize || null,
      p_file_type: fileType || 'application/pdf',
      p_report_type: reportType || 'valuation_report',
      p_notes: notes || null,
    });

    if (error) throw error;

    if (!data.success) {
      return res.status(400).json({ error: data.error });
    }

    res.json(data);
  } catch (err) {
    console.error('Error delivering report:', err);
    res.status(500).json({ error: 'Failed to deliver report' });
  }
});

// Get deliverables for a job
router.get('/jobs/:id/deliverables', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = req.supabase!;
    const { id } = req.params;

    // First verify user has access to this job
    const { data: job, error: jobError } = await supabase
      .from('job_requests')
      .select('id, client_id, appraiser_id')
      .eq('id', id)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Check if user is client or appraiser for this job
    if (job.client_id !== req.user!.id && job.appraiser_id !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data: deliverables, error } = await supabase
      .from('report_deliverables')
      .select('*')
      .eq('job_id', id)
      .order('delivered_at', { ascending: false });

    if (error) throw error;

    res.json({ deliverables });
  } catch (err) {
    console.error('Error fetching deliverables:', err);
    res.status(500).json({ error: 'Failed to fetch deliverables' });
  }
});

// Record download of a deliverable
router.post('/deliverables/:id/download', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const { id } = req.params;

    // First get the current download count
    const { data: currentDeliverable } = await supabase
      .from('report_deliverables')
      .select('download_count')
      .eq('id', id)
      .single();

    // Update download count and timestamp
    const { error } = await supabase
      .from('report_deliverables')
      .update({
        downloaded_at: new Date().toISOString(),
        download_count: (currentDeliverable?.download_count || 0) + 1,
      })
      .eq('id', id);

    if (error) {
      console.warn('Error updating download count:', error);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error recording download:', err);
    res.status(500).json({ error: 'Failed to record download' });
  }
});

// Complete job (client confirms receipt)
router.post('/jobs/:id/complete', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const { id } = req.params;

    const { data, error } = await supabase.rpc('complete_job', {
      p_job_id: id,
      p_client_id: req.user!.id,
    });

    if (error) throw error;

    if (!data.success) {
      return res.status(400).json({ error: data.error });
    }

    res.json(data);
  } catch (err) {
    console.error('Error completing job:', err);
    res.status(500).json({ error: 'Failed to complete job' });
  }
});

// ============================================================================
// JOB MESSAGES (Client-Appraiser Communication)
// ============================================================================

// Get messages for a job
router.get('/jobs/:id/messages', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = req.supabase!;
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Get messages with sender info
    const { data: messages, error, count } = await supabase
      .from('job_messages')
      .select(`
        id,
        content,
        attachment_path,
        attachment_name,
        attachment_size,
        attachment_type,
        is_read,
        read_at,
        created_at,
        sender:users!sender_id (
          id,
          full_name,
          avatar_url
        )
      `, { count: 'exact' })
      .eq('job_id', id)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching messages:', error);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }

    // Also get unread count
    const { data: unreadData } = await supabase.rpc('get_job_unread_count', { p_job_id: id });

    res.json({
      messages: messages || [],
      total: count || 0,
      unreadCount: unreadData || 0,
    });
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send a new message
router.post('/jobs/:id/messages', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const userSupabase = req.supabase!;
    const { id } = req.params;
    const { content, attachmentPath, attachmentName, attachmentSize, attachmentType } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Verify user has access to this job
    const { data: job, error: jobError } = await userSupabase
      .from('job_requests')
      .select('id, client_id, assigned_appraiser_id, status')
      .eq('id', id)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Only allow messaging for active jobs
    const allowedStatuses = ['paid', 'assigned', 'in_progress', 'delivered'];
    if (!allowedStatuses.includes(job.status)) {
      return res.status(400).json({ error: 'Messaging is not available for this job status' });
    }

    // Verify user is client or appraiser for this job
    const isClient = job.client_id === req.user!.id;
    const isAppraiser = job.assigned_appraiser_id === req.user!.id;

    if (!isClient && !isAppraiser) {
      return res.status(403).json({ error: 'Not authorized to send messages for this job' });
    }

    // Insert message
    const { data: message, error: insertError } = await supabase
      .from('job_messages')
      .insert({
        job_id: id,
        sender_id: req.user!.id,
        content: content.trim(),
        attachment_path: attachmentPath || null,
        attachment_name: attachmentName || null,
        attachment_size: attachmentSize || null,
        attachment_type: attachmentType || null,
      })
      .select(`
        id,
        content,
        attachment_path,
        attachment_name,
        attachment_size,
        attachment_type,
        is_read,
        created_at,
        sender:users!sender_id (
          id,
          full_name,
          avatar_url
        )
      `)
      .single();

    if (insertError) {
      console.error('Error inserting message:', insertError);
      return res.status(500).json({ error: 'Failed to send message' });
    }

    res.json({ message });
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Mark all messages in a job as read
router.post('/jobs/:id/messages/read', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getServiceClient();
    const { id } = req.params;

    // Use the stored function to mark messages as read
    const { data, error } = await supabase.rpc('mark_job_messages_read', { p_job_id: id });

    if (error) {
      console.error('Error marking messages as read:', error);
      return res.status(500).json({ error: 'Failed to mark messages as read' });
    }

    res.json({ markedCount: data || 0 });
  } catch (err) {
    console.error('Error marking messages as read:', err);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

export default router;
