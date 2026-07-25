// Database types for Beit Index
// These should be regenerated with `supabase gen types typescript` when schema changes

export type UserRole = 'owner' | 'appraiser' | 'bank' | 'admin';
export type ProfileStatus = 'pending' | 'under_review' | 'verified' | 'rejected' | 'suspended';
export type AvailabilityStatus = 'this_week' | 'next_week' | 'two_weeks' | 'unavailable';
export type DocumentType = 'fra_license' | 'national_id_front' | 'national_id_back' | 'signature' | 'stamp' | 'cbe_license' | 'syndicate_card' | 'other';
export type AuditAction = 'admin_override' | 'verification_doc_viewed' | 'profile_approved' | 'profile_rejected' | 'changes_requested' | 'admin_invited' | 'admin_invite_consumed';

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          auth_id: string;
          email: string;
          full_name: string;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_id: string;
          email: string;
          full_name: string;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_id?: string;
          email?: string;
          full_name?: string;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
      };
      governorates: {
        Row: {
          id: string;
          name_en: string;
          name_ar: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name_en: string;
          name_ar: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name_en?: string;
          name_ar?: string;
          created_at?: string;
        };
      };
      cities: {
        Row: {
          id: string;
          governorate_id: string;
          name_en: string;
          name_ar: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          governorate_id: string;
          name_en: string;
          name_ar: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          governorate_id?: string;
          name_en?: string;
          name_ar?: string;
          created_at?: string;
        };
      };
      districts: {
        Row: {
          id: string;
          city_id: string;
          name_en: string;
          name_ar: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          city_id: string;
          name_en: string;
          name_ar: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          city_id?: string;
          name_en?: string;
          name_ar?: string;
          created_at?: string;
        };
      };
      appraiser_profiles: {
        Row: {
          id: string;
          user_id: string;
          full_name_en: string;
          full_name_ar: string | null;
          phone: string | null;
          years_experience: number | null;
          professional_title_en: string | null;
          professional_title_ar: string | null;
          photo_url: string | null;
          fra_license_number: string | null;
          fra_license_issue_date: string | null;
          fra_license_expiry_date: string | null;
          national_id_number: string | null;
          bio_en: string | null;
          bio_ar: string | null;
          starting_price_egp: number | null;
          typical_turnaround_days: number | null;
          availability: AvailabilityStatus | null;
          signature_url: string | null;
          stamp_url: string | null;
          status: ProfileStatus;
          submitted_at: string | null;
          verified_at: string | null;
          verified_by: string | null;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name_en: string;
          full_name_ar?: string | null;
          phone?: string | null;
          years_experience?: number | null;
          professional_title_en?: string | null;
          professional_title_ar?: string | null;
          photo_url?: string | null;
          fra_license_number?: string | null;
          fra_license_issue_date?: string | null;
          fra_license_expiry_date?: string | null;
          national_id_number?: string | null;
          bio_en?: string | null;
          bio_ar?: string | null;
          starting_price_egp?: number | null;
          typical_turnaround_days?: number | null;
          availability?: AvailabilityStatus | null;
          signature_url?: string | null;
          stamp_url?: string | null;
          status?: ProfileStatus;
          submitted_at?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          full_name_en?: string;
          full_name_ar?: string | null;
          phone?: string | null;
          years_experience?: number | null;
          professional_title_en?: string | null;
          professional_title_ar?: string | null;
          photo_url?: string | null;
          fra_license_number?: string | null;
          fra_license_issue_date?: string | null;
          fra_license_expiry_date?: string | null;
          national_id_number?: string | null;
          bio_en?: string | null;
          bio_ar?: string | null;
          starting_price_egp?: number | null;
          typical_turnaround_days?: number | null;
          availability?: AvailabilityStatus | null;
          signature_url?: string | null;
          stamp_url?: string | null;
          status?: ProfileStatus;
          submitted_at?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      verification_documents: {
        Row: {
          id: string;
          appraiser_id: string;
          document_type: DocumentType;
          storage_path: string;
          original_filename: string | null;
          mime_type: string | null;
          file_size: number | null;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          appraiser_id: string;
          document_type: DocumentType;
          storage_path: string;
          original_filename?: string | null;
          mime_type?: string | null;
          file_size?: number | null;
          uploaded_at?: string;
        };
        Update: {
          id?: string;
          appraiser_id?: string;
          document_type?: DocumentType;
          storage_path?: string;
          original_filename?: string | null;
          mime_type?: string | null;
          file_size?: number | null;
          uploaded_at?: string;
        };
      };
      appraiser_service_areas: {
        Row: {
          id: string;
          appraiser_id: string;
          district_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          appraiser_id: string;
          district_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          appraiser_id?: string;
          district_id?: string;
          created_at?: string;
        };
      };
      property_types: {
        Row: {
          id: string;
          name_en: string;
          name_ar: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name_en: string;
          name_ar: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name_en?: string;
          name_ar?: string;
          created_at?: string;
        };
      };
      appraiser_specialties: {
        Row: {
          id: string;
          appraiser_id: string;
          property_type_id: string;
          years_experience: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          appraiser_id: string;
          property_type_id: string;
          years_experience?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          appraiser_id?: string;
          property_type_id?: string;
          years_experience?: number;
          created_at?: string;
        };
      };
      reviews: {
        Row: {
          id: string;
          appraiser_id: string;
          reviewer_user_id: string | null;
          rating: number;
          comment: string | null;
          reviewer_first_name: string | null;
          reviewer_last_initial: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          appraiser_id: string;
          reviewer_user_id?: string | null;
          rating: number;
          comment?: string | null;
          reviewer_first_name?: string | null;
          reviewer_last_initial?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          appraiser_id?: string;
          reviewer_user_id?: string | null;
          rating?: number;
          comment?: string | null;
          reviewer_first_name?: string | null;
          reviewer_last_initial?: string | null;
          created_at?: string;
        };
      };
      audit_log: {
        Row: {
          id: string;
          user_id: string | null;
          action: AuditAction;
          target_table: string | null;
          target_id: string | null;
          metadata: Record<string, unknown>;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action: AuditAction;
          target_table?: string | null;
          target_id?: string | null;
          metadata?: Record<string, unknown>;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          action?: AuditAction;
          target_table?: string | null;
          target_id?: string | null;
          metadata?: Record<string, unknown>;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
      };
      appraiser_onboarding_drafts: {
        Row: {
          user_id: string;
          current_step: number;
          draft_data: OnboardingDraftData;
          uploaded_files: UploadedFile[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          current_step?: number;
          draft_data?: OnboardingDraftData;
          uploaded_files?: UploadedFile[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          current_step?: number;
          draft_data?: OnboardingDraftData;
          uploaded_files?: UploadedFile[];
          created_at?: string;
          updated_at?: string;
        };
      };
      admin_invites: {
        Row: {
          id: string;
          email: string;
          token: string;
          invited_by: string;
          expires_at: string;
          consumed_at: string | null;
          consumed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          token: string;
          invited_by: string;
          expires_at: string;
          consumed_at?: string | null;
          consumed_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          token?: string;
          invited_by?: string;
          expires_at?: string;
          consumed_at?: string | null;
          consumed_by?: string | null;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_user_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      current_user_role: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: {
      user_role: UserRole;
      profile_status: ProfileStatus;
      availability_status: AvailabilityStatus;
      document_type: DocumentType;
      audit_action: AuditAction;
    };
  };
}

// Helper types for the onboarding draft
export interface OnboardingDraftData {
  // Step 1: Personal info
  fullNameEn?: string;
  fullNameAr?: string;
  phone?: string;
  yearsExperience?: number;
  professionalTitle?: string;
  photoStoragePath?: string;

  // Step 2: FRA License (required) + optional CBE accreditation
  fraLicenseNumber?: string;
  fraLicenseIssueDate?: string;
  fraLicenseExpiryDate?: string;
  fraLicenseStoragePath?: string;
  cbeRegistrationNumber?: string;
  cbeIssueDate?: string;
  cbeExpiryDate?: string;
  cbeStoragePath?: string;

  // Step 3: National ID (required) + optional professional syndicate ("carnet")
  nationalIdNumber?: string;
  nationalIdFrontStoragePath?: string;
  nationalIdBackStoragePath?: string;
  syndicateName?: string;
  syndicateMembershipNumber?: string;
  syndicateExpiryDate?: string;
  syndicateCardStoragePath?: string;

  // Step 4: Service areas
  selectedDistrictIds?: string[];

  // Step 5: Specialties
  specialties?: Array<{
    propertyTypeId: string;
    yearsExperience: number;
  }>;

  // Step 6: Final details
  bioEn?: string;
  bioAr?: string;
  startingPriceEgp?: number;
  typicalTurnaroundDays?: number;
  availability?: AvailabilityStatus;
  signatureStoragePath?: string;
  stampStoragePath?: string;
  codeOfConductAccepted?: boolean;
}

export interface UploadedFile {
  storagePath: string;
  documentType: DocumentType;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
}

// Appraiser with related data for directory/profile pages
export interface AppraiserWithDetails {
  id: string;
  userId: string;
  fullNameEn: string;
  fullNameAr: string | null;
  professionalTitleEn: string | null;
  professionalTitleAr: string | null;
  yearsExperience: number | null;
  photoUrl: string | null;
  fraLicenseNumber: string | null;
  bioEn: string | null;
  bioAr: string | null;
  startingPriceEgp: number | null;
  typicalTurnaroundDays: number | null;
  availability: AvailabilityStatus | null;
  status: ProfileStatus;
  serviceAreas: Array<{
    districtId: string;
    districtNameEn: string;
    districtNameAr: string;
    cityNameEn: string;
    cityNameAr: string;
    governorateNameEn: string;
    governorateNameAr: string;
  }>;
  specialties: Array<{
    propertyTypeId: string;
    propertyTypeNameEn: string;
    propertyTypeNameAr: string;
    yearsExperience: number;
  }>;
  reviews: Array<{
    id: string;
    rating: number;
    comment: string | null;
    reviewerFirstName: string | null;
    reviewerLastInitial: string | null;
    createdAt: string;
  }>;
  averageRating: number;
  reviewCount: number;
}
