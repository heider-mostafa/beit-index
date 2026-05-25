/**
 * Location Lookup Service
 *
 * Resolves Arabic location names (governorate, city, district) to database UUIDs.
 * Handles common variations and fuzzy matching for Egyptian locations.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

// Cached location data
let cachedGovernates: Map<string, { id: string; name_en: string; name_ar: string }> | null = null;
let cachedCities: Map<string, { id: string; governorate_id: string; name_en: string; name_ar: string }> | null = null;
let cachedDistricts: Map<string, { id: string; city_id: string; name_en: string; name_ar: string }> | null = null;

// Common Arabic name variations/misspellings
const GOVERNORATE_ALIASES: Record<string, string[]> = {
  'القاهرة': ['الماهرة', 'القاهره', 'قاهرة', 'cairo'],
  'الجيزة': ['جيزة', 'الجيزه', 'giza'],
  'الإسكندرية': ['اسكندرية', 'الاسكندريه', 'اسكندريه', 'alexandria'],
  'مطروح': ['مرسى مطروح', 'matrouh'],
};

const CITY_ALIASES: Record<string, string[]> = {
  'القاهرة الجديدة': ['الماهرة الجديدة', 'القاهره الجديده', 'التجمع', 'new cairo'],
  'السادس من أكتوبر': ['6 اكتوبر', 'اكتوبر', '6th october'],
  'الشيخ زايد': ['زايد', 'sheikh zayed'],
  'الساحل الشمالي': ['الساحل', 'north coast'],
};

const DISTRICT_ALIASES: Record<string, string[]> = {
  'التجمع الخامس': ['التجمع 5', '5th settlement', 'fifth settlement'],
  'التجمع الثالث': ['التجمع 3', '3rd settlement', 'third settlement'],
  'الحى الخامس': ['الحي الخامس', 'fifth district', 'district 5', 'الاسكان المتطور - الحى الخامس', 'الحى الخامس - الاسكان المتطور'],
  'الاسكان المتطور': ['upgraded housing', 'الاسكان المطور'],
  'مدينتي': ['madinaty', 'مدينتى'],
  'الرحاب': ['rehab', 'al rehab'],
};

/**
 * Normalize Arabic text for matching
 */
function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    // Normalize Arabic characters
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ى]/g, 'ي')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئ]/g, 'ي')
    // Remove diacritics
    .replace(/[\u064B-\u065F]/g, '')
    // Remove extra spaces
    .replace(/\s+/g, ' ');
}

/**
 * Get Supabase client for lookups
 */
// Singleton client to avoid recreating
let supabaseClient: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (supabaseClient) return supabaseClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }
  supabaseClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
  });
  return supabaseClient;
}

/**
 * Load and cache all governorates
 */
async function loadGovernorates(): Promise<Map<string, { id: string; name_en: string; name_ar: string }>> {
  if (cachedGovernates) return cachedGovernates;

  const supabase = getClient();
  const { data, error } = await supabase
    .from('governorates')
    .select('id, name_en, name_ar');

  if (error) {
    console.error('[Location Lookup] Error loading governorates:', error);
    return new Map();
  }

  cachedGovernates = new Map();
  for (const gov of data || []) {
    // Index by normalized Arabic name
    cachedGovernates.set(normalizeArabic(gov.name_ar), gov);
    // Index by English name
    cachedGovernates.set(normalizeArabic(gov.name_en), gov);

    // Add aliases
    const aliases = GOVERNORATE_ALIASES[gov.name_ar] || [];
    for (const alias of aliases) {
      cachedGovernates.set(normalizeArabic(alias), gov);
    }
  }

  console.log(`[Location Lookup] Loaded ${data?.length || 0} governorates`);
  return cachedGovernates;
}

/**
 * Load and cache all cities
 */
async function loadCities(): Promise<Map<string, { id: string; governorate_id: string; name_en: string; name_ar: string }>> {
  if (cachedCities) return cachedCities;

  const supabase = getClient();
  const { data, error } = await supabase
    .from('cities')
    .select('id, governorate_id, name_en, name_ar');

  if (error) {
    console.error('[Location Lookup] Error loading cities:', error);
    return new Map();
  }

  cachedCities = new Map();
  for (const city of data || []) {
    cachedCities.set(normalizeArabic(city.name_ar), city);
    cachedCities.set(normalizeArabic(city.name_en), city);

    // Add aliases
    const aliases = CITY_ALIASES[city.name_ar] || [];
    for (const alias of aliases) {
      cachedCities.set(normalizeArabic(alias), city);
    }
  }

  console.log(`[Location Lookup] Loaded ${data?.length || 0} cities`);
  return cachedCities;
}

/**
 * Load and cache all districts
 */
async function loadDistricts(): Promise<Map<string, { id: string; city_id: string; name_en: string; name_ar: string }>> {
  if (cachedDistricts) return cachedDistricts;

  const supabase = getClient();
  const { data, error } = await supabase
    .from('districts')
    .select('id, city_id, name_en, name_ar');

  if (error) {
    console.error('[Location Lookup] Error loading districts:', error);
    return new Map();
  }

  cachedDistricts = new Map();
  for (const district of data || []) {
    // Index by normalized Arabic name
    cachedDistricts.set(normalizeArabic(district.name_ar), district);
    // Index by English name
    cachedDistricts.set(normalizeArabic(district.name_en), district);

    // Add aliases
    const aliases = DISTRICT_ALIASES[district.name_ar] || [];
    for (const alias of aliases) {
      cachedDistricts.set(normalizeArabic(alias), district);
    }
  }

  console.log(`[Location Lookup] Loaded ${data?.length || 0} districts`);
  return cachedDistricts;
}

/**
 * Lookup governorate by name (Arabic or English)
 */
export async function lookupGovernorate(name: string): Promise<string | null> {
  if (!name) return null;

  const governorates = await loadGovernorates();
  const normalized = normalizeArabic(name);

  const match = governorates.get(normalized);
  if (match) {
    console.log(`[Location Lookup] Governorate '${name}' -> ${match.name_en} (${match.id})`);
    return match.id;
  }

  // Try partial matching
  for (const [key, gov] of governorates) {
    if (normalized.includes(key) || key.includes(normalized)) {
      console.log(`[Location Lookup] Governorate '${name}' (partial) -> ${gov.name_en} (${gov.id})`);
      return gov.id;
    }
  }

  console.log(`[Location Lookup] Governorate '${name}' not found`);
  return null;
}

/**
 * Lookup city by name (Arabic or English)
 */
export async function lookupCity(name: string, governorateId?: string): Promise<string | null> {
  if (!name) return null;

  const cities = await loadCities();
  const normalized = normalizeArabic(name);

  const match = cities.get(normalized);
  if (match) {
    // If governorate specified, verify it matches
    if (governorateId && match.governorate_id !== governorateId) {
      console.log(`[Location Lookup] City '${name}' found but governorate mismatch`);
    }
    console.log(`[Location Lookup] City '${name}' -> ${match.name_en} (${match.id})`);
    return match.id;
  }

  // Try partial matching
  for (const [key, city] of cities) {
    if (normalized.includes(key) || key.includes(normalized)) {
      if (governorateId && city.governorate_id !== governorateId) continue;
      console.log(`[Location Lookup] City '${name}' (partial) -> ${city.name_en} (${city.id})`);
      return city.id;
    }
  }

  console.log(`[Location Lookup] City '${name}' not found`);
  return null;
}

/**
 * Lookup district by name (Arabic or English)
 */
export async function lookupDistrict(name: string, cityId?: string): Promise<string | null> {
  if (!name) return null;

  const districts = await loadDistricts();
  const normalized = normalizeArabic(name);

  const match = districts.get(normalized);
  if (match) {
    if (cityId && match.city_id !== cityId) {
      console.log(`[Location Lookup] District '${name}' found but city mismatch`);
    }
    console.log(`[Location Lookup] District '${name}' -> ${match.name_en} (${match.id})`);
    return match.id;
  }

  // Try partial matching
  for (const [key, district] of districts) {
    if (normalized.includes(key) || key.includes(normalized)) {
      if (cityId && district.city_id !== cityId) continue;
      console.log(`[Location Lookup] District '${name}' (partial) -> ${district.name_en} (${district.id})`);
      return district.id;
    }
  }

  console.log(`[Location Lookup] District '${name}' not found`);
  return null;
}

/**
 * Lookup all location IDs from extracted data
 */
export async function resolveLocationIds(data: {
  governorate?: string | null;
  city?: string | null;
  district?: string | null;
}): Promise<{
  governorate_id: string | null;
  city_id: string | null;
  district_id: string | null;
}> {
  const governorate_id = await lookupGovernorate(data.governorate || '');
  const city_id = await lookupCity(data.city || '', governorate_id || undefined);
  const district_id = await lookupDistrict(data.district || '', city_id || undefined);

  return { governorate_id, city_id, district_id };
}

/**
 * Clear cached data (useful for testing)
 */
export function clearLocationCache(): void {
  cachedGovernates = null;
  cachedCities = null;
  cachedDistricts = null;
  supabaseClient = null;
}
