import puppeteer from 'puppeteer-core';
import { formatEGP } from '@/src/lib/appraisal/engine';

// Find Chrome executable path based on OS
function getChromePath(): string {
  const platform = process.platform;
  if (platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  } else if (platform === 'win32') {
    return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  } else {
    return '/usr/bin/google-chrome';
  }
}

// Convert number to Arabic words
function numberToArabicWords(num: number): string {
  if (num === 0) return 'صفر';
  if (!num || isNaN(num)) return '';

  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر'];
  const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

  // Helper to convert a number 1-999 to Arabic words
  function convertHundreds(n: number): string {
    if (n === 0) return '';
    const h = Math.floor(n / 100);
    const remainder = n % 100;
    const t = Math.floor(remainder / 10);
    const o = remainder % 10;

    let result = '';
    if (h > 0) result += hundreds[h];

    if (remainder > 0) {
      if (h > 0) result += ' و';
      if (remainder <= 12) {
        result += ones[remainder];
      } else if (remainder < 20) {
        result += ones[o] + ' عشر';
      } else if (o === 0) {
        result += tens[t];
      } else {
        result += ones[o] + ' و' + tens[t];
      }
    }
    return result;
  }

  const millions = Math.floor(num / 1000000);
  const thousands = Math.floor((num % 1000000) / 1000);
  const remainder = num % 1000;

  let result = '';

  // Handle millions
  if (millions > 0) {
    if (millions === 1) {
      result += 'مليون';
    } else if (millions === 2) {
      result += 'مليونان';
    } else if (millions >= 3 && millions <= 10) {
      result += ones[millions] + ' ملايين';
    } else {
      result += convertHundreds(millions) + ' مليون';
    }
  }

  // Handle thousands
  if (thousands > 0) {
    if (result) result += ' و';
    if (thousands === 1) {
      result += 'ألف';
    } else if (thousands === 2) {
      result += 'ألفان';
    } else if (thousands >= 3 && thousands <= 10) {
      result += ones[thousands] + ' آلاف';
    } else {
      result += convertHundreds(thousands) + ' ألف';
    }
  }

  // Handle remainder
  if (remainder > 0) {
    if (result) result += ' و';
    result += convertHundreds(remainder);
  }

  return 'فقط وقدره ' + result + ' جنيها لاغير';
}

// Format date to Arabic
function formatDateArabic(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

interface ReportData {
  id: string;
  project_name: string | null;
  report_kind: string;
  tenancy: string;
  client_name: string | null;
  owner_name: string | null;
  appraisal_date: string | null;
  valid_until: string | null;
  final_value: number | null;
  land_value: number | null;
  building_value: number | null;
  chosen_method: string | null;
  reconciliation_rationale: string | null;
  unit_net_area: number | null;
  unit_gross_area: number | null;
  unit_land_share: number | null;
  project_land_area: number | null;
  current_age: number | null;
  economic_life: number;
  effective_age: number | null;
  finishing_level: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  total_rooms: number | null;
  orientation: string | null;
  has_pool: boolean;
  // Cost approach
  cost_land_price_per_sqm: number | null;
  cost_construction_per_sqm: number | null;
  cost_allowed_floors: number | null;
  cost_current_floors: number | null;
  cost_repairable_depreciation: number | null;
  cost_total: number | null;
  // Sales comparison
  sales_subject_building_area: number | null;
  sales_subject_land_area: number | null;
  sales_final_value: number | null;
  // Income
  income_monthly_rent: number | null;
  income_total: number | null;
  // GRM
  grm_total: number | null;
  // Market study
  market_bldg_halffinish_low: number | null;
  market_bldg_halffinish_high: number | null;
  market_bldg_fullfinish_low: number | null;
  market_bldg_fullfinish_high: number | null;
  market_land_low: number | null;
  market_land_high: number | null;
  property: {
    property_type: string;
    address_description: string;
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
    floor: string | null;
    sale_timing: string;
    tenancy: string;
    age_years: number | null;
    orientation: string | null;
    payment_terms: string;
    finishing_level: string | null;
    has_pool: boolean;
    building_area_sqm: number;
    land_area_sqm: number;
    building_price_per_sqm: number;
    sale_price: number;
  }>;
  photos: Array<{
    storage_path: string;
    category: string;
    caption: string | null;
  }>;
  appraiser?: {
    full_name: string;
    license_number: string;
  };
}

// Clean black & white color scheme for formal appraisal documents
const COLORS = {
  primary: '#000000',      // Black
  secondary: '#000000',    // Black (no accent)
  accent: '#333333',       // Dark gray
  lightBg: '#f5f5f5',      // Very light gray background
  headerBg: '#000000',     // Black header
  tableBorder: '#000000',  // Black border
  text: '#000000',         // Black text
  muted: '#666666',        // Gray text
  success: '#000000',      // Black for values
  white: '#ffffff',
};

// Shared CSS styles
const sharedStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4; margin: 10mm; }
  body {
    font-family: 'Noto Sans Arabic', 'Arial', sans-serif;
    font-size: 10pt;
    line-height: 1.5;
    color: ${COLORS.text};
    background: white;
    direction: rtl;
  }
  .page {
    width: 190mm;
    min-height: 277mm;
    padding: 5mm;
    page-break-after: always;
    position: relative;
    border: 1px solid ${COLORS.lightBg};
  }
  .page:last-child { page-break-after: avoid; }

  /* Page Header - Clean black & white */
  .page-header {
    background: ${COLORS.white};
    color: ${COLORS.text};
    padding: 4mm 0;
    margin-bottom: 5mm;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid ${COLORS.primary};
  }
  .page-header-title {
    font-size: 16pt;
    font-weight: bold;
  }
  .page-header-subtitle {
    font-size: 10pt;
    color: ${COLORS.muted};
  }
  .page-header-logo {
    text-align: left;
    font-size: 9pt;
  }

  /* Section Headers */
  .section-header {
    background: ${COLORS.primary};
    color: ${COLORS.white};
    padding: 2mm 4mm;
    font-size: 11pt;
    font-weight: bold;
    margin: 3mm 0 2mm 0;
    border-radius: 2px;
  }
  .section-subheader {
    background: ${COLORS.lightBg};
    color: ${COLORS.primary};
    padding: 2mm 4mm;
    font-size: 10pt;
    font-weight: bold;
    border-right: 4px solid ${COLORS.secondary};
    margin: 2mm 0;
  }

  /* Legacy header for compatibility */
  .header {
    text-align: center;
    font-size: 14pt;
    font-weight: bold;
    color: ${COLORS.primary};
    margin-bottom: 5mm;
    padding-bottom: 2mm;
    border-bottom: 2px solid ${COLORS.secondary};
  }

  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 3mm;
  }
  td, th {
    border: 1px solid ${COLORS.tableBorder};
    padding: 2.5mm 3mm;
    text-align: right;
    vertical-align: middle;
    font-size: 9pt;
  }
  th {
    background: ${COLORS.lightBg};
    font-weight: bold;
    color: ${COLORS.primary};
  }
  tr:nth-child(even) td {
    background: ${COLORS.white};
  }
  tr:nth-child(odd) td {
    background: #fafafa;
  }
  .no-border { border: none; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .small { font-size: 8pt; }

  /* Value Box - Clean black & white */
  .value-box {
    background: ${COLORS.lightBg};
    color: ${COLORS.text};
    border: 2px solid ${COLORS.primary};
    padding: 5mm;
    text-align: center;
    margin: 4mm 0;
  }
  .value-box-title {
    font-size: 11pt;
    font-weight: bold;
    margin-bottom: 2mm;
  }
  .value-box-amount {
    font-size: 18pt;
    font-weight: bold;
    margin-bottom: 2mm;
  }
  .value-box-words {
    font-size: 9pt;
  }

  /* Checkboxes */
  .checkbox {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid ${COLORS.primary};
    border-radius: 2px;
    margin-left: 4px;
    text-align: center;
    font-size: 10px;
    line-height: 12px;
    vertical-align: middle;
  }
  .checkbox.checked {
    background: ${COLORS.primary};
    color: ${COLORS.white};
  }
  .checkbox.checked::after { content: "✓"; }

  /* Photo Grid - Clean style */
  .photo-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3mm;
    margin: 3mm 0;
  }
  .photo-cell {
    border: 1px solid ${COLORS.tableBorder};
    text-align: center;
    padding: 2mm;
    background: ${COLORS.white};
  }
  .photo-cell img {
    max-width: 100%;
    max-height: 78mm;
    object-fit: contain;
  }
  .photo-caption {
    font-size: 8pt;
    margin-top: 2mm;
    background: ${COLORS.lightBg};
    color: ${COLORS.text};
    padding: 1.5mm 2mm;
    font-weight: bold;
  }

  /* Footer - Clean style */
  .footer {
    position: absolute;
    bottom: 5mm;
    left: 5mm;
    right: 5mm;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 9pt;
    color: ${COLORS.text};
    border-top: 1px solid ${COLORS.primary};
    padding-top: 3mm;
  }
  .footer-section {
    display: flex;
    flex-direction: column;
    gap: 1mm;
  }
  .footer-label {
    font-size: 8pt;
    color: ${COLORS.text};
  }
  .page-number {
    font-weight: bold;
    font-size: 10pt;
  }

  /* Info Row */
  .info-row {
    display: flex;
    justify-content: space-between;
    padding: 2mm 0;
    border-bottom: 1px dashed #e2e8f0;
  }
  .info-label {
    font-weight: bold;
    color: ${COLORS.primary};
  }
  .info-value {
    color: ${COLORS.text};
  }

  /* Highlight Box */
  .highlight-box {
    background: ${COLORS.lightBg};
    border-right: 4px solid ${COLORS.secondary};
    padding: 3mm;
    margin: 2mm 0;
  }
`;

function generatePage1(report: ReportData): string {
  const propertyTypes: Record<string, string> = {
    apartment: 'شقه',
    villa: 'فيلا',
    duplex: 'دوبلكس',
    commercial_shop: 'محل تجارى',
    office: 'إدارى',
    building: 'عمارة',
    compound_unit: 'مجمع سكنى',
    roof: 'الرووف',
  };

  const reportKinds: Record<string, string> = {
    brief: 'مختصر',
    narrative_limited: 'سردى محدود',
    narrative_full: 'سردى متكامل',
  };

  const tenancyTypes: Record<string, string> = {
    owner_occupied: 'مالك',
    vacant: 'خالية',
    rented: 'مستأجر',
  };

  const facadePhoto = report.photos.find(p => p.category === 'facade') || report.photos[0];

  return `
    <div class="page">
      <div class="page-header">
        <div>
          <div class="page-header-title">تقرير تقييم عقارى</div>
          <div class="page-header-subtitle">Property Valuation Report</div>
        </div>
        <div class="page-header-logo">
          <div style="font-weight: bold;">${report.appraiser?.full_name || 'خبير تقييم عقارى'}</div>
          <div>رقم القيد: ${report.appraiser?.license_number || '-'}</div>
        </div>
      </div>

      <div class="section-header">بيانات التقييم والخبير</div>
      <table>
        <tr>
          <td class="bold">خبير التقييم</td>
          <td>${report.appraiser?.full_name || '-'}</td>
          <td class="bold">تاريخ التقييم</td>
          <td>${formatDateArabic(report.appraisal_date)}</td>
        </tr>
        <tr>
          <td class="bold">رقم القيد بالهيئة العامه للتمويل العقارى</td>
          <td>${report.appraiser?.license_number || '-'}</td>
          <td class="bold">التقييم سارى حتى</td>
          <td>${formatDateArabic(report.valid_until)}</td>
        </tr>
        <tr>
          <td class="bold">المحافظة</td>
          <td>${report.property.governorate?.name_ar || '-'}</td>
          <td class="bold">المدينة</td>
          <td>${report.property.city?.name_ar || '-'}</td>
        </tr>
      </table>

      <table>
        <tr>
          <td class="bold" colspan="2">اسم الحى</td>
          <td colspan="2">${report.property.district?.name_ar || '-'}</td>
        </tr>
        <tr>
          <td class="bold" colspan="2">عنوان العقار ووصفة</td>
          <td colspan="2">${report.property.address_description}</td>
        </tr>
        <tr>
          <td class="bold">رقم الشقة</td>
          <td>${report.property.unit_number || '-'}</td>
          <td class="bold">الدور</td>
          <td>${report.property.floor || '-'}</td>
        </tr>
        <tr>
          <td class="bold">مساحة الشقة م²</td>
          <td>${report.unit_net_area || '-'}</td>
          <td class="bold">مساحة الارض</td>
          <td>${report.project_land_area || '-'}</td>
        </tr>
        <tr>
          <td class="bold">رقم العمارة</td>
          <td>${report.property.building_number || '-'}</td>
          <td class="bold">مدخل</td>
          <td>-</td>
        </tr>
      </table>

      <table>
        <tr>
          <td class="bold" colspan="8">نوع العقار او التقييم</td>
        </tr>
        <tr>
          ${Object.entries(propertyTypes).map(([key, label]) => `
            <td class="center">
              <span class="checkbox ${report.property.property_type === key ? 'checked' : ''}"></span>
              ${label}
            </td>
          `).join('')}
        </tr>
      </table>

      <table>
        <tr>
          <td class="bold">اسم العميل</td>
          <td>${report.client_name || '-'}</td>
          <td class="bold">اسم المالكة</td>
          <td>${report.owner_name || '-'}</td>
        </tr>
        <tr>
          <td class="bold">نوع التقرير</td>
          <td>
            ${Object.entries(reportKinds).map(([key, label]) => `
              <span class="checkbox ${report.report_kind === key ? 'checked' : ''}"></span> ${label}
            `).join(' ')}
          </td>
          <td class="bold">الحيازة</td>
          <td>
            ${Object.entries(tenancyTypes).map(([key, label]) => `
              <span class="checkbox ${report.tenancy === key ? 'checked' : ''}"></span> ${label}
            `).join(' ')}
          </td>
        </tr>
      </table>

      <div class="value-box">
        <div class="value-box-title">نتيجة التقييم</div>
        <div class="value-box-amount">${formatEGP(report.final_value || 0)}</div>
        <div class="value-box-words">${report.final_value ? numberToArabicWords(report.final_value) : '-'}</div>
      </div>

      <table style="margin-top: 3mm;">
        <tr>
          <td class="bold">قيمة الارض</td>
          <td>${formatEGP(report.land_value || 0)}</td>
          <td class="bold">قيمة المبانى</td>
          <td>${formatEGP(report.building_value || 0)}</td>
        </tr>
      </table>

      <table>
        <tr>
          <td class="bold center" colspan="2">الواجهة الامامية للعقار</td>
        </tr>
        <tr>
          <td colspan="2" class="center" style="height: 70mm;">
            ${facadePhoto ? `<img src="${facadePhoto.storage_path}" style="max-height: 65mm; max-width: 100%;">` : '<div style="color: #999;">لا توجد صورة</div>'}
          </td>
        </tr>
      </table>

      <div class="footer">
        <div class="footer-section">
          <div class="footer-label">ختم خبير التقييم</div>
        </div>
        <div class="page-number">1</div>
        <div class="footer-section">
          <div class="footer-label">توقيع خبير التقييم</div>
        </div>
      </div>
    </div>
  `;
}

function generatePage2(report: ReportData): string {
  const locationPhoto = report.photos.find(p => p.category === 'location_map');
  const streetPhoto = report.photos.find(p => p.category === 'street_view');

  return `
    <div class="page">
      <div class="section-header">تقرير تقييم مقدم إلى</div>

      <table>
        <tr>
          <td class="bold center" colspan="2">التصوير الجوى للموقع</td>
        </tr>
        <tr>
          <td colspan="2" class="center" style="height: 100mm;">
            ${locationPhoto ? `<img src="${locationPhoto.storage_path}" style="max-height: 95mm; max-width: 100%;">` : '<div style="color: #999; padding: 40mm;">صورة جوية للموقع</div>'}
          </td>
        </tr>
        <tr>
          <td colspan="2" class="center" style="height: 100mm;">
            ${streetPhoto ? `<img src="${streetPhoto.storage_path}" style="max-height: 95mm; max-width: 100%;">` : '<div style="color: #999; padding: 40mm;">صورة للموقع من الشارع</div>'}
          </td>
        </tr>
      </table>

      <div class="footer">
        <div class="footer-section">
          <div class="footer-label">ختم خبير التقييم</div>
        </div>
        <div class="page-number">2</div>
        <div class="footer-section">
          <div class="footer-label">توقيع خبير التقييم</div>
        </div>
      </div>
    </div>
  `;
}

function generatePage3_4(report: ReportData): string {
  const interiorPhotos = report.photos.filter(p =>
    ['living_room', 'bedroom', 'bathroom', 'kitchen', 'balcony', 'entrance'].includes(p.category)
  );

  const categoryLabels: Record<string, string> = {
    facade: 'الواجهة',
    entrance: 'المدخل',
    living_room: 'الرسبشن',
    bedroom: 'حجرة نوم',
    bathroom: 'الحمام',
    kitchen: 'المطبخ',
    balcony: 'التراس',
    garden: 'الحديقة',
    pool: 'حمام السباحة',
    garage: 'الجراج',
    roof: 'السطح',
    street_view: 'منظر الشارع',
    location_map: 'خريطة الموقع',
    other: 'أخرى',
  };

  // Split into two pages of 4 photos each
  const page3Photos = interiorPhotos.slice(0, 4);
  const page4Photos = interiorPhotos.slice(4, 8);

  const generatePhotoPage = (photos: typeof interiorPhotos, pageNum: number) => `
    <div class="page">
      <div class="section-header">تقرير تقييم مقدم إلى</div>

      <table>
        <tr>
          <td class="bold center" colspan="2">صور مختلفة للعقار</td>
        </tr>
      </table>

      <div class="photo-grid">
        ${photos.map(photo => `
          <div class="photo-cell">
            <div class="photo-caption">${photo.caption || categoryLabels[photo.category] || photo.category}</div>
            <img src="${photo.storage_path}" alt="${photo.category}">
          </div>
        `).join('')}
        ${photos.length < 4 ? Array(4 - photos.length).fill('<div class="photo-cell"><div style="height: 80mm; display: flex; align-items: center; justify-content: center; color: #999;">لا توجد صورة</div></div>').join('') : ''}
      </div>

      <div class="footer">
        <div class="footer-section">
          <div class="footer-label">ختم خبير التقييم</div>
        </div>
        <div class="page-number">${pageNum}</div>
        <div class="footer-section">
          <div class="footer-label">توقيع خبير التقييم</div>
        </div>
      </div>
    </div>
  `;

  return generatePhotoPage(page3Photos, 3) + generatePhotoPage(page4Photos, 4);
}

function generatePage5(report: ReportData): string {
  const finishingLabels: Record<string, string> = {
    luxury: 'تشطيب فاخر',
    super_lux: 'سوبر لوكس',
    full: 'تشطيب كامل',
    half: 'نصف تشطيب',
    shell: 'على المحارة',
  };

  const remainingLife = report.economic_life - (report.effective_age || 0);

  return `
    <div class="page">
      <div class="section-header">تقرير تقييم مقدم إلى</div>

      <table>
        <tr>
          <td class="bold center" colspan="4">معلومات عن العقار</td>
        </tr>
        <tr>
          <td class="bold">مساحة الوحدة السكنية بالمتر المربع</td>
          <td>${report.unit_net_area || '-'}</td>
          <td class="bold">مساحة ارض العقار بالمتر المربع</td>
          <td>${report.project_land_area || '-'}</td>
        </tr>
        <tr>
          <td class="bold">نصيب الوحدة فى ارض العقار بالمتر المربع</td>
          <td>${report.unit_land_share || '-'}</td>
          <td class="bold">اجمالى مسطح مبانى العمارة</td>
          <td>${report.sales_subject_building_area || '-'}</td>
        </tr>
        <tr>
          <td class="bold">العمر الحالى للمبنى بالسنه</td>
          <td>${report.current_age || '-'}</td>
          <td class="bold">المتبقى فى عمر المبنى بالسنة</td>
          <td>${remainingLife}</td>
        </tr>
        <tr>
          <td class="bold">العمر الحالى الفعال بالسنة</td>
          <td>${report.effective_age || '-'}</td>
          <td class="bold">العمر الاقتصادى للمبنى بالسنه</td>
          <td>${report.economic_life}</td>
        </tr>
      </table>

      <table>
        <tr>
          <td class="bold center" colspan="7">مواصفات التشطيب</td>
        </tr>
        <tr>
          <td class="bold center" colspan="7">التشطيبات الداخلية: ${finishingLabels[report.finishing_level || ''] || report.finishing_level || '-'}</td>
        </tr>
        <tr>
          <th></th>
          <th>نوم</th>
          <th>استقبال</th>
          <th>معيشة</th>
          <th>حمام ومطبخ</th>
          <th>تراسات</th>
          <th>أخرى</th>
        </tr>
        <tr>
          <td class="bold">ارضيات</td>
          <td>HDF</td>
          <td>بورسلين</td>
          <td>سيراميك</td>
          <td>سيراميك</td>
          <td>سيراميك</td>
          <td>-</td>
        </tr>
        <tr>
          <td class="bold">حوائط</td>
          <td>دهانات بلاستيك</td>
          <td>دهانات بلاستيك</td>
          <td>دهانات بلاستيك</td>
          <td>سيراميك</td>
          <td>دهانات بلاستيك</td>
          <td>-</td>
        </tr>
        <tr>
          <td class="bold">اسقف</td>
          <td>دهانات بلاستيك</td>
          <td>دهانات بلاستيك</td>
          <td>دهانات بلاستيك</td>
          <td>دهانات بلاستيك</td>
          <td>دهانات بلاستيك</td>
          <td>-</td>
        </tr>
      </table>

      <table>
        <tr>
          <td class="bold">كهرباء</td>
          <td colspan="6">الاعمال الكهربائية كاملة (مواسير وعلب واسلاك وخردوات)</td>
        </tr>
        <tr>
          <td class="bold">أجهزة صحية</td>
          <td colspan="6">التوصيلات الصحية الخارجية والداخلية كاملة والاجهزة الصحية من الانواع الفاخرة</td>
        </tr>
        <tr>
          <td class="bold">الأبواب والشبابيك</td>
          <td colspan="6">الابواب خشب والشبابيك الومنيوم</td>
        </tr>
      </table>

      <table>
        <tr>
          <td class="bold center" colspan="6">التشطيبات الخارجية</td>
        </tr>
        <tr>
          <th>واجهات</th>
          <th>مدخل</th>
          <th>درج</th>
          <th>درابزين</th>
          <th>السطح</th>
          <th>أخرى</th>
        </tr>
        <tr>
          <td>دهانات دراى مكس</td>
          <td>رخام</td>
          <td>رخام</td>
          <td>كريتال</td>
          <td>بلاط</td>
          <td>-</td>
        </tr>
      </table>

      <div class="footer">
        <div class="footer-section">
          <div class="footer-label">ختم خبير التقييم</div>
        </div>
        <div class="page-number">5</div>
        <div class="footer-section">
          <div class="footer-label">توقيع خبير التقييم</div>
        </div>
      </div>
    </div>
  `;
}

function generatePage6(report: ReportData): string {
  return `
    <div class="page">
      <div class="section-header">تقرير تقييم مقدم إلى</div>

      <table>
        <tr>
          <td class="bold center" colspan="6">المنطقة</td>
        </tr>
        <tr>
          <td class="bold">الموقع</td>
          <td><span class="checkbox checked"></span> على شارع رئيسى</td>
          <td><span class="checkbox"></span> على شارع فرعى</td>
          <td colspan="3"><span class="checkbox"></span> على شارع جانبى</td>
        </tr>
        <tr>
          <td class="bold">حجم الانشاءات</td>
          <td><span class="checkbox"></span> اكثر من 75%</td>
          <td><span class="checkbox checked"></span> من25% حتى 75%</td>
          <td colspan="3"><span class="checkbox"></span> اقل من 25%</td>
        </tr>
        <tr>
          <td class="bold">مصادر التمويل</td>
          <td><span class="checkbox checked"></span> تمليك</td>
          <td><span class="checkbox"></span> ايجار سكنى</td>
          <td colspan="3"><span class="checkbox"></span> ايجار تجارى وإدارى</td>
        </tr>
        <tr>
          <td class="bold">اسعار العقارات</td>
          <td><span class="checkbox"></span> فى زيادة</td>
          <td><span class="checkbox checked"></span> ثابته</td>
          <td colspan="3"><span class="checkbox"></span> فى انخفاض</td>
        </tr>
        <tr>
          <td class="bold">العرض والطلب</td>
          <td><span class="checkbox"></span> المعروض كثير</td>
          <td><span class="checkbox checked"></span> متوازن</td>
          <td colspan="3"><span class="checkbox"></span> المعروض قليل</td>
        </tr>
        <tr>
          <td class="bold">زمن البيع</td>
          <td><span class="checkbox"></span> اقل من 3 شهور</td>
          <td><span class="checkbox checked"></span> من 3 الى 6 شهور</td>
          <td colspan="3"><span class="checkbox"></span> اكثر من 6 شهور</td>
        </tr>
        <tr>
          <td class="bold">المنطقة</td>
          <td><span class="checkbox checked"></span> هادئة</td>
          <td><span class="checkbox"></span> عادية</td>
          <td colspan="3"><span class="checkbox"></span> مزدحمة</td>
        </tr>
      </table>

      <table>
        <tr>
          <td class="bold center" colspan="6">المرافق والخدمات</td>
        </tr>
        <tr>
          <td class="bold">المنطقة</td>
          <td><span class="checkbox checked"></span> مياه</td>
          <td><span class="checkbox checked"></span> كهرباء</td>
          <td><span class="checkbox checked"></span> صرف صحى</td>
          <td><span class="checkbox checked"></span> تليفونات</td>
          <td><span class="checkbox checked"></span> غاز</td>
        </tr>
        <tr>
          <td></td>
          <td><span class="checkbox checked"></span> مدارس</td>
          <td><span class="checkbox checked"></span> مول تجارى</td>
          <td><span class="checkbox checked"></span> مستشفيات</td>
          <td><span class="checkbox checked"></span> مناطق ترفيه</td>
          <td></td>
        </tr>
        <tr>
          <td class="bold">العقار</td>
          <td><span class="checkbox checked"></span> مياه</td>
          <td><span class="checkbox checked"></span> كهرباء</td>
          <td><span class="checkbox checked"></span> صرف صحى</td>
          <td><span class="checkbox checked"></span> تليفونات</td>
          <td><span class="checkbox checked"></span> غاز</td>
        </tr>
        <tr>
          <td></td>
          <td><span class="checkbox"></span> جراج</td>
          <td><span class="checkbox"></span> تجارى</td>
          <td><span class="checkbox"></span> إدارى</td>
          <td><span class="checkbox checked"></span> سكنى</td>
          <td><span class="checkbox"></span> مصعد</td>
        </tr>
      </table>

      <table>
        <tr>
          <td class="bold">حقوق ومستندات الملكية :-</td>
        </tr>
        <tr>
          <td>عقد الشراء من المالك بموجب عقد البيع الابتدائى. التملك لملكية الوحدة السكنية المطلوب تقييمها.</td>
        </tr>
        <tr>
          <td class="bold">التراخيص :-</td>
        </tr>
        <tr>
          <td>العقار تم بناءة بمعرفة جهاز التنمية ضمن مشروع الاسكان. العقار به كافة المرافق (مياه وكهرباء وصرف صحى وغاز)</td>
        </tr>
      </table>

      <div class="footer">
        <div class="footer-section">
          <div class="footer-label">ختم خبير التقييم</div>
        </div>
        <div class="page-number">6</div>
        <div class="footer-section">
          <div class="footer-label">توقيع خبير التقييم</div>
        </div>
      </div>
    </div>
  `;
}

function generatePage7(report: ReportData): string {
  return `
    <div class="page">
      <div class="section-header">تقرير تقييم مقدم إلى</div>

      <table>
        <tr>
          <td class="bold">الوضع الحالى للعقار</td>
        </tr>
        <tr>
          <td>تقدر نسبة الانجاز الحالية للوحدة المطلوب تقييمها ب 100% (${report.finishing_level === 'luxury' ? 'تشطيب فاخر' : report.finishing_level === 'full' ? 'تشطيب كامل' : 'تشطيب'})</td>
        </tr>
        <tr>
          <td class="bold">أعلى وافضل أستخدام :-</td>
        </tr>
        <tr>
          <td>الاستخدام الحالى للارض يعتبر اعلى وافضل استخدام وذلك لان مكونات العقار افقيا وراسيا مطابقة لما تسمح به الاشتراطات البنائية للمنطقة حاليا</td>
        </tr>
      </table>

      <table>
        <tr>
          <td class="bold">وصف الارض المقام عليها العقار وحدودها :-</td>
        </tr>
        <tr>
          <td>تبلغ مساحة الارض المقام عليها العقار بحوالى ${report.project_land_area || '-'}م² وحدودها كالاتى :</td>
        </tr>
        <tr>
          <td>الحد البحرى الشرقى: حديقة عامة</td>
        </tr>
        <tr>
          <td>الحد البحرى الغربى: ممر مشاة ثم جار عمارة سكنية</td>
        </tr>
        <tr>
          <td>الحد القبلى الشرقى: طريق</td>
        </tr>
        <tr>
          <td>الحد القبلى الغربى: مسطح أخضر</td>
        </tr>
      </table>

      <table>
        <tr>
          <td class="bold">وصف الجزء المطلوب تقييمه وحدوده :-</td>
        </tr>
        <tr>
          <td>${report.property.address_description}</td>
        </tr>
        <tr>
          <td>تتكون الشقة من ${report.total_rooms || '-'} غرف و ${report.bathrooms || '-'} حمام</td>
        </tr>
      </table>

      <table>
        <tr>
          <td class="bold center" colspan="4">دراسة السوق بالمنطقة :-</td>
        </tr>
        <tr>
          <td class="bold">يتراوح سعر المتر المسطح مبانى نصف تشطيب من</td>
          <td>${formatEGP(report.market_bldg_halffinish_low || 0)}ج/م²</td>
          <td>الى</td>
          <td>${formatEGP(report.market_bldg_halffinish_high || 0)}ج/م²</td>
        </tr>
        <tr>
          <td class="bold">يتراوح سعر المتر المسطح مبانى تشطيب كامل من</td>
          <td>${formatEGP(report.market_bldg_fullfinish_low || 0)}ج/م²</td>
          <td>الى</td>
          <td>${formatEGP(report.market_bldg_fullfinish_high || 0)}ج/م²</td>
        </tr>
        <tr>
          <td class="bold">يتراوح سعر المتر المسطح ارض بالمنطقة من</td>
          <td>${formatEGP(report.market_land_low || 0)}ج/م²</td>
          <td>الى</td>
          <td>${formatEGP(report.market_land_high || 0)}ج/م²</td>
        </tr>
        <tr>
          <td colspan="4" class="small">ملاحظات :- أسعار المبانى المذكورة اعلاه تشمل نصيب المبانى فى الارض المقام عليها العقار</td>
        </tr>
      </table>

      <div class="footer">
        <div class="footer-section">
          <div class="footer-label">ختم خبير التقييم</div>
        </div>
        <div class="page-number">7</div>
        <div class="footer-section">
          <div class="footer-label">توقيع خبير التقييم</div>
        </div>
      </div>
    </div>
  `;
}

function generatePage8(report: ReportData): string {
  const landValue = report.land_value || 0;
  const constructionCost = (report.unit_net_area || 0) * (report.cost_construction_per_sqm || 0);
  const constructionWithProfit = constructionCost * 1.3;
  const depreciation = ((report.effective_age || 0) / report.economic_life) * constructionCost;
  const costTotal = landValue + constructionWithProfit - depreciation;

  return `
    <div class="page">
      <div class="section-header">تقرير تقييم مقدم إلى</div>

      <table>
        <tr>
          <td class="bold center" colspan="4">تحديد القيمة بطريقة التكلفة</td>
        </tr>
        <tr>
          <td class="bold center" colspan="4">القيمة بطريقة حساب التكلفة</td>
        </tr>
        <tr>
          <td class="bold">سعر المتر المربع للاراضى</td>
          <td>=</td>
          <td>${formatEGP(report.cost_land_price_per_sqm || 0)}</td>
          <td>ج/م²</td>
        </tr>
        <tr>
          <td class="bold">اجمالى مسطح الارض</td>
          <td>=</td>
          <td>${report.project_land_area || '-'}</td>
          <td>م²</td>
        </tr>
        <tr>
          <td class="bold">اجمالى مسطح الجزء المراد تقييمه</td>
          <td>=</td>
          <td>${report.unit_net_area || '-'}</td>
          <td>م²</td>
        </tr>
        <tr>
          <td class="bold">مساحة ما يخص الجزء المراد تقييمه من الارض</td>
          <td>=</td>
          <td>${report.unit_land_share || '-'}</td>
          <td>م²</td>
        </tr>
        <tr>
          <td class="bold">قيمة ما يخص الجزء المراد تقييمه من الارض</td>
          <td>=</td>
          <td>${formatEGP(landValue)}</td>
          <td>جنيه</td>
        </tr>
        <tr>
          <td class="bold">تكلفة انشاء المتر المسطح</td>
          <td>=</td>
          <td>${formatEGP(report.cost_construction_per_sqm || 0)}</td>
          <td>جنيه</td>
        </tr>
        <tr>
          <td class="bold">تكلفة انشاء الجزء المراد تقييمه</td>
          <td>=</td>
          <td>${formatEGP(constructionCost)}</td>
          <td>جنيه</td>
        </tr>
        <tr>
          <td class="bold">قيمة المبانى شاملا ارباح 30%</td>
          <td>=</td>
          <td>${formatEGP(constructionWithProfit)}</td>
          <td>جنيه</td>
        </tr>
        <tr>
          <td class="bold">العمر الحالى الفعال</td>
          <td>=</td>
          <td>${report.effective_age || 0}</td>
          <td>سنه</td>
        </tr>
        <tr>
          <td class="bold">العمر الاقتصادى للمبنى</td>
          <td>=</td>
          <td>${report.economic_life}</td>
          <td>سنه</td>
        </tr>
        <tr>
          <td class="bold">قيمة الاهلاك القابل للاصلاح</td>
          <td>=</td>
          <td>${formatEGP(report.cost_repairable_depreciation || 0)}</td>
          <td>جنيه</td>
        </tr>
        <tr>
          <td class="bold">قيمة الاهلاك الغير قابل للاصلاح</td>
          <td>=</td>
          <td>${formatEGP(depreciation)}</td>
          <td>جنيه</td>
        </tr>
        <tr>
          <td class="bold">قيمة الاهلاك الكلى</td>
          <td>=</td>
          <td>${formatEGP(depreciation + (report.cost_repairable_depreciation || 0))}</td>
          <td>جنيه</td>
        </tr>
        <tr>
          <td class="bold">القيمه بطريقة حساب التكلفة</td>
          <td>=</td>
          <td class="bold">${formatEGP(report.cost_total || costTotal)}</td>
          <td>جنيه</td>
        </tr>
        <tr>
          <td colspan="4" class="center bold">${report.cost_total ? numberToArabicWords(report.cost_total) : numberToArabicWords(Math.round(costTotal))}</td>
        </tr>
      </table>

      <div class="footer">
        <div class="footer-section">
          <div class="footer-label">ختم خبير التقييم</div>
        </div>
        <div class="page-number">8</div>
        <div class="footer-section">
          <div class="footer-label">توقيع خبير التقييم</div>
        </div>
      </div>
    </div>
  `;
}

function generatePage9(report: ReportData): string {
  const comps = report.comparables.slice(0, 3);

  const saleTimingLabels: Record<string, string> = {
    current_offer: 'عرض حالى',
    recent_sale: 'منذ شهر',
    historical: 'منذ شهران',
  };

  const tenancyLabels: Record<string, string> = {
    owner_occupied: 'مالك',
    vacant: 'خالية',
    rented: 'مستأجر',
  };

  const paymentLabels: Record<string, string> = {
    cash: 'نقدى',
    installments: 'تقسيط',
    mortgage: 'تمويل',
  };

  return `
    <div class="page">
      <div class="section-header">تقرير تقييم مقدم إلى</div>

      <table>
        <tr>
          <td class="bold center" colspan="5">تحديد القيمة بطريقة البيوع السابقة</td>
        </tr>
        <tr>
          <th>البند</th>
          <th>العقار المستهدف</th>
          ${comps.map((_, i) => `<th>عقار مقارن رقم (${i + 1})</th>`).join('')}
          ${comps.length < 3 ? Array(3 - comps.length).fill('<th>-</th>').join('') : ''}
        </tr>
        <tr>
          <td class="bold">العنوان</td>
          <td class="small">${report.property.address_description}</td>
          ${comps.map(c => `<td class="small">${c.address}</td>`).join('')}
          ${comps.length < 3 ? Array(3 - comps.length).fill('<td>-</td>').join('') : ''}
        </tr>
        <tr>
          <td class="bold">مصدر التأكيد</td>
          <td>-</td>
          ${comps.map(c => `<td>${c.source}</td>`).join('')}
          ${comps.length < 3 ? Array(3 - comps.length).fill('<td>-</td>').join('') : ''}
        </tr>
        <tr>
          <td class="bold">الدور</td>
          <td>${report.property.floor || '-'}</td>
          ${comps.map(c => `<td>${c.floor || '-'}</td>`).join('')}
          ${comps.length < 3 ? Array(3 - comps.length).fill('<td>-</td>').join('') : ''}
        </tr>
        <tr>
          <td class="bold">توقيت البيع</td>
          <td>-</td>
          ${comps.map(c => `<td>${saleTimingLabels[c.sale_timing] || c.sale_timing}</td>`).join('')}
          ${comps.length < 3 ? Array(3 - comps.length).fill('<td>-</td>').join('') : ''}
        </tr>
        <tr>
          <td class="bold">الحيازة</td>
          <td>${tenancyLabels[report.tenancy] || report.tenancy}</td>
          ${comps.map(c => `<td>${tenancyLabels[c.tenancy] || c.tenancy}</td>`).join('')}
          ${comps.length < 3 ? Array(3 - comps.length).fill('<td>-</td>').join('') : ''}
        </tr>
        <tr>
          <td class="bold">عمر العقار</td>
          <td>${report.current_age || '-'} عام</td>
          ${comps.map(c => `<td>${c.age_years || '-'} سنوات</td>`).join('')}
          ${comps.length < 3 ? Array(3 - comps.length).fill('<td>-</td>').join('') : ''}
        </tr>
        <tr>
          <td class="bold">التوجيه</td>
          <td>${report.orientation || '-'}</td>
          ${comps.map(c => `<td>${c.orientation || '-'}</td>`).join('')}
          ${comps.length < 3 ? Array(3 - comps.length).fill('<td>-</td>').join('') : ''}
        </tr>
        <tr>
          <td class="bold">امتيازات الدفع</td>
          <td>نقدى</td>
          ${comps.map(c => `<td>${paymentLabels[c.payment_terms] || c.payment_terms}</td>`).join('')}
          ${comps.length < 3 ? Array(3 - comps.length).fill('<td>-</td>').join('') : ''}
        </tr>
        <tr>
          <td class="bold">التشطيب</td>
          <td>${report.finishing_level === 'luxury' ? 'تشطيب فاخر' : report.finishing_level || '-'}</td>
          ${comps.map(c => `<td>${c.finishing_level || '-'}</td>`).join('')}
          ${comps.length < 3 ? Array(3 - comps.length).fill('<td>-</td>').join('') : ''}
        </tr>
        <tr>
          <td class="bold">المساحة/ م²</td>
          <td>${report.unit_net_area || '-'}</td>
          ${comps.map(c => `<td>${c.building_area_sqm}</td>`).join('')}
          ${comps.length < 3 ? Array(3 - comps.length).fill('<td>-</td>').join('') : ''}
        </tr>
        <tr>
          <td class="bold">سعر البيع</td>
          <td>-</td>
          ${comps.map(c => `<td>${formatEGP(c.sale_price)}</td>`).join('')}
          ${comps.length < 3 ? Array(3 - comps.length).fill('<td>-</td>').join('') : ''}
        </tr>
        <tr>
          <td class="bold">سعر ال م²</td>
          <td>-</td>
          ${comps.map(c => `<td>${formatEGP(c.building_price_per_sqm)}</td>`).join('')}
          ${comps.length < 3 ? Array(3 - comps.length).fill('<td>-</td>').join('') : ''}
        </tr>
      </table>

      <table style="margin-top: 5mm;">
        <tr>
          <td colspan="3">العقار موضوع التقييم ووجد ان قيمة العقار المحسوبه بطريقة البيوع السابقه</td>
          <td class="bold">=</td>
          <td class="bold">${formatEGP(report.sales_final_value || 0)}</td>
          <td>جنيه</td>
        </tr>
        <tr>
          <td colspan="6" class="center bold">${report.sales_final_value ? numberToArabicWords(report.sales_final_value) : '-'}</td>
        </tr>
      </table>

      <div class="footer">
        <div class="footer-section">
          <div class="footer-label">ختم خبير التقييم</div>
        </div>
        <div class="page-number">9</div>
        <div class="footer-section">
          <div class="footer-label">توقيع خبير التقييم</div>
        </div>
      </div>
    </div>
  `;
}

function generatePage10(report: ReportData): string {
  const methodLabels: Record<string, string> = {
    cost: 'طريقة التكلفة',
    sales_comparison: 'طريقة البيوع السابقة',
    income: 'طريقة رأسمالة الدخل',
    grm: 'طريقة مضاعف الإيجار',
  };

  return `
    <div class="page">
      <div class="section-header">تقرير تقييم مقدم إلى</div>

      <table>
        <tr>
          <td class="bold center" colspan="4">توفيق النتائج</td>
        </tr>
        <tr>
          <td class="bold">تحديد القيمة بطريقة التكلفة</td>
          <td>=</td>
          <td>${formatEGP(report.cost_total || 0)}</td>
          <td>جنيه</td>
        </tr>
        <tr>
          <td colspan="4">${report.cost_total ? numberToArabicWords(report.cost_total) : '-'}</td>
        </tr>
        <tr>
          <td class="bold">تحديد القيمة بطريقة البيوع السابقة</td>
          <td>=</td>
          <td>${formatEGP(report.sales_final_value || 0)}</td>
          <td>جنيه</td>
        </tr>
        <tr>
          <td colspan="4">${report.sales_final_value ? numberToArabicWords(report.sales_final_value) : '-'}</td>
        </tr>
        ${report.income_total ? `
        <tr>
          <td class="bold">تحديد القيمة بطريقة رأسمالة الدخل</td>
          <td>=</td>
          <td>${formatEGP(report.income_total)}</td>
          <td>جنيه</td>
        </tr>
        ` : `
        <tr>
          <td colspan="4">لم يتم اتباع طريقة رأسمالة الدخل لعدم توافر ايجارات مرتفعة تعبر عن القيمة السوقية للعقار بالمنطقة المحيطة</td>
        </tr>
        `}
        <tr>
          <td colspan="4" class="bold">نرى الاعتماد على ${methodLabels[report.chosen_method || 'sales_comparison']} لتوافر بيوع حديثة لعقارات مثيلة بالمنطقة.</td>
        </tr>
      </table>

      <table>
        <tr>
          <td class="bold center" colspan="4">القيمة النهائية</td>
        </tr>
        <tr>
          <td class="bold">القيمة النهائية الاجماليه</td>
          <td>=</td>
          <td class="bold">${formatEGP(report.final_value || 0)}</td>
          <td>${report.final_value ? numberToArabicWords(report.final_value) : '-'}</td>
        </tr>
        <tr>
          <td class="bold">قيمة مايخص العقار من الارض</td>
          <td>=</td>
          <td>${formatEGP(report.land_value || 0)}</td>
          <td>${report.land_value ? numberToArabicWords(report.land_value) : '-'}</td>
        </tr>
        <tr>
          <td class="bold">قيمة المبانى</td>
          <td>=</td>
          <td>${formatEGP(report.building_value || 0)}</td>
          <td>${report.building_value ? numberToArabicWords(report.building_value) : '-'}</td>
        </tr>
      </table>

      <table>
        <tr>
          <td colspan="4">
            تقدر القيمة السوقية للشقة ${report.property.address_description} شاملا حصتها فى الارض المقام عليها العقار بمبلغ ${formatEGP(report.final_value || 0)} جنيها (${report.final_value ? numberToArabicWords(report.final_value) : '-'})
          </td>
        </tr>
        ${report.income_monthly_rent ? `
        <tr>
          <td colspan="4">تقدر قيمة الايجار الشهرى بالمثل بمبلغ ${formatEGP(report.income_monthly_rent)} جنية شهريا.</td>
        </tr>
        ` : ''}
      </table>

      <div class="footer">
        <div class="footer-section">
          <div class="footer-label">ختم خبير التقييم</div>
        </div>
        <div class="page-number">10</div>
        <div class="footer-section">
          <div class="footer-label">توقيع خبير التقييم</div>
        </div>
      </div>
    </div>
  `;
}

function generatePage11(report: ReportData): string {
  return `
    <div class="page">
      <div class="section-header">تقرير تقييم مقدم إلى</div>

      <table>
        <tr>
          <td class="bold center">فروض ومحددات التقرير</td>
        </tr>
        <tr>
          <td>
            <p style="margin-bottom: 3mm;">_ تم اعداد هذا التقرير فى ضوء المعايير المصرية للتقييم العقارى الصادرة بقرار مجلس ادارة الهيئة العامة للرقابة المالية رقم 39 لسنة 2015 بتاريخ 19 أبريل 2015.</p>

            <p style="margin-bottom: 3mm;">_ القيمة السوقية المطلوب تحديدها هى الثمن الاكثر احتمالا الذى يغله العقار فى سوق تنافسى مفتوح.</p>

            <p style="margin-bottom: 3mm;">_ الغرض من اعداد التقرير هو تقدير القيمة السوقيه للعقار موضوع التقييم لأقرب جنيه</p>

            <p style="margin-bottom: 3mm;">_ لا يوجد نزاعات ملكية على العقار ولا يوجد اى رهن او قرض او حق امتياز او حقوق عينيه للغير او حقوق ارتفاق او غيرها من الشروط المحددة للملكيه وذلك على مسئولية المالك وفقا لما قدمه لنا من معلومات وبيانات</p>

            <p style="margin-bottom: 3mm;">_ تمت معاينة العقار من الداخل والخارج ولا يوجد اى عيوب ظاهره بالارض او المبانى</p>

            <p style="margin-bottom: 3mm;">_ مستندات الملكيه المقدمه من المالك على مسئوليته وتم التحقق منها حسب الممكن والمتاح من بيانات ومعلومات</p>

            <p style="margin-bottom: 3mm;">_ قيمة العقار المحددة تسرى للمدة المذكورة فى صدر هذا التقرير فى ظل ظروف طبيعيه ومنطقية بالسوق</p>

            <p style="margin-bottom: 3mm;">_العقار المطلوب تقييمه عباره عن ${report.property.address_description}</p>

            <p style="margin-bottom: 3mm;">_ التقرير هو ملكيه خاصة للعميل الموجه اليه التقرير ولا يجوز استخدام كل او بعض هذا التقرير الا فى حدود الغرض المحدد لذلك.</p>

            <p style="margin-bottom: 3mm;">_ تم تقييم العقار اخذا فى الاعتبار فرضية اعلى وافضل استخدام للعقار الواردة بالباب الخاص بذلك</p>

            <p style="margin-bottom: 3mm;">_ يفترض ان العقار غير مخالف لأية اشتراطات او قوانين بنائيه او تنظيميه او بيئيه خاصة بالمنطقة</p>

            <p style="margin-bottom: 3mm;">_ يفترض عدم وجود اى ظروف خفية بالعقار</p>

            <p style="margin-bottom: 3mm;">_ لا يحق نشر او طبع او نسخ كل او بعض هذا التقرير الا بعد الحصول على على موافقة خبير التقييم الكتابيه</p>

            <p style="margin-bottom: 3mm;">_ الخبير بنفسه قام بفحص العقار موضوع التقييم.</p>

            <p style="margin-bottom: 3mm;">_ الخبير بنفسه قام بإعداد كل التوصيات والنتائج عن العقار موضوع التقييم.</p>
          </td>
        </tr>
      </table>

      <div class="footer">
        <div class="footer-section">
          <div class="footer-label">ختم خبير التقييم</div>
        </div>
        <div class="page-number">11</div>
        <div class="footer-section">
          <div class="footer-label">توقيع خبير التقييم</div>
        </div>
      </div>
    </div>
  `;
}

function generatePage12(report: ReportData): string {
  return `
    <div class="page">
      <div class="section-header">تقرير تقييم مقدم إلى</div>

      <table>
        <tr>
          <td class="bold center">شهادة خبير</td>
        </tr>
        <tr>
          <td>
            <p class="bold" style="margin-bottom: 5mm;">أشهد أنا خبير التقييم بأننى:</p>

            <p style="margin-bottom: 3mm;">1- قد قمت بدراسة سوق منطقة العقار و اخترت على الأقل عدد ثلاث مبيعات حديثة لعقارات أقرب ما يمكن من حيث النوع و الموقع للعقار المقيم و ذلك فى حالة أستعمال طريقة "مقارنة أسعار البيع" للتقييم و قمت بعمل التعديلات المالية حيث وجبت لتعكس تأثير السوق بالاختلافات ذات قيمة بين العقارات تحت الدراسة.</p>

            <p style="margin-bottom: 3mm;">2- قد قمت بأخذ جميع العوامل التى تؤثر على قيمة العقار حسب التقرير المقدم. إننى لم اخفى - عن عمد - أى معلومات هامة من تقرير التقييم و إننى أشهد أنه حسب علمى فإن كل المعلومات و البيانات المقدمة صحيحة و حقيقية.</p>

            <p style="margin-bottom: 3mm;">3- قد قدمت بالتقرير رأيى الشخصى المحايد الفنى و الآراء و المستنتجات التى تحددها فقط الاشتراطات و الحدود الواردة بهذه الشهادة.</p>

            <p style="margin-bottom: 3mm;">4- انه ليس لدى أى اهتمام حالى أو مستقبلى متوقع كما انه ليس لأى من موظفى مكتبى الحاليين أو المستقبليين اهتمام بالعقار موضع التقييم. كما إننى اشهد أن أتعابى عن أعداد هذا التقييم لا تعتمد على قيمة العقار الواردة بتقرير التقييم.</p>

            <p style="margin-bottom: 3mm;">5- انه ليس لى اهتمام حالى أو مستقبلى بالعقار موضوع التقييم و ليس لدى أى تفضيل حالى أو مستقبلى لأى طرف من أطراف التعاقد. و إننى لم ابنى تحليلى لقيمة العقار سواء جزئيا أو كليا على عنصر أو لون أو ديانة أو جنس أو عجز أو الحالة العائلية أو الموطن الأصلى لأى من طرفى التعاقد أو شاغلى العقار أو شاغلى العقارات المجاورة.</p>

            <p style="margin-bottom: 3mm;">6- أنه لم يطلب إلى تقديم أى آراء مسبقة عن قيمة أو اتجاه قيمة العقار يخدم مصلحة العميل طالب التقييم أو أى جهة مرتبطة به، كما لم يطلب منى الوصول إلى قيمة محددة للعقار، كما لم يطلب منى حدوث أى أحداث مستقبلية للحصول على عقد أداء أو قيمة أتعابى عن العمل، كما إننى لم ابنى التقرير على حد أدنى لقيمة معينة أو تقييم معين أو الحاجة للموافقة على منح قرض معين</p>

            <p style="margin-bottom: 3mm;">7- إننى قمت بأداء هذا التقييم فى ضوء المعايير المصرية للتقييم العقارى الصادرة بقرار مجلس ادارة الهيئة العامة للرقابة المالية رقم 39 لسنة 2015 بتاريخ 19 أبريل 2015.</p>

            <p style="margin-bottom: 3mm;">8- إننى اقر أن القيمة الواردة التقييم مبنية على عرض العقار لفترة زمنية مناسبة بالسوق الحر حسب الوارد بتعريف القيمة السوقية للعقار.</p>

            <p style="margin-bottom: 3mm;">9- إننى شخصيا قمت بفحص داخل و خارج العقار موضع التقييم و فحص خارج العقارات التى تم استخدامها فى مقارنة البيوع السابقة الواردة بالتقرير.</p>

            <p style="margin-bottom: 3mm;">10- إنني قمت شخصيا بإعداد كل التوصيات و النتائج عن العقار. و إننى حيثما اعتمدت على خبير فنى آخر فى أجزاء هامة لأداء هذا التقييم أوضحت اسم هذا الخبير و أوضحت طبيعة الجزء الذى قام بإعداده.</p>

            <p style="margin-top: 8mm;"><span class="bold">الاسم:</span> ${report.appraiser?.full_name || '-'}</p>
            <p><span class="bold">رقم القيد:</span> ${report.appraiser?.license_number || '-'}</p>
            <p style="margin-top: 5mm;"><span class="bold">توقيع</span></p>
          </td>
        </tr>
      </table>

      <div class="footer">
        <div class="footer-section">
          <div class="footer-label">ختم خبير التقييم</div>
        </div>
        <div class="page-number">12</div>
        <div class="footer-section">
          <div class="footer-label">توقيع خبير التقييم</div>
        </div>
      </div>
    </div>
  `;
}

function generateReportHTML(report: ReportData): string {
  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تقرير تقييم - ${report.project_name || report.property.address_description}</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap" rel="stylesheet">
  <style>${sharedStyles}</style>
</head>
<body>
  ${generatePage1(report)}
  ${generatePage2(report)}
  ${generatePage3_4(report)}
  ${generatePage5(report)}
  ${generatePage6(report)}
  ${generatePage7(report)}
  ${generatePage8(report)}
  ${generatePage9(report)}
  ${generatePage10(report)}
  ${generatePage11(report)}
  ${generatePage12(report)}
</body>
</html>
`;
}

export async function generatePDF(report: ReportData): Promise<Buffer> {
  const browser = await puppeteer.launch({
    executablePath: getChromePath(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    const html = generateReportHTML(report);
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export { generateReportHTML };
