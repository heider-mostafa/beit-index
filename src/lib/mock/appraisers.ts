export type MockAppraiser = {
  id: string;
  fullNameEn: string;
  fullNameAr: string;
  titleEn: string;
  titleAr: string;
  fraLicenseNumber: string;
  photoUrl: string;
  yearsExperience: number;
  primaryGovernorateEn: string;
  primaryGovernorateAr: string;
  serviceDistrictsEn: string[];
  serviceDistrictsAr: string[];
  specialties: Array<{ propertyTypeEn: string; propertyTypeAr: string; yearsExperience: number }>;
  bioEn: string;
  bioAr: string;
  startingPriceEgp: number;
  typicalTurnaroundDays: number;
  availability: 'this_week' | 'next_week' | 'two_weeks';
  averageRating: number;
  reviewCount: number;
  sampleWork: Array<{
    propertyTypeEn: string;
    propertyTypeAr: string;
    areaEn: string;
    areaAr: string;
    sqmRange: string;
    valueRangeEn: string;
    valueRangeAr: string;
    dateRangeEn: string;
    dateRangeAr: string;
  }>;
  reviews: Array<{
    rating: number;
    firstNameEn: string;
    firstNameAr: string;
    lastInitialEn: string;
    lastInitialAr: string;
    dateEn: string;
    dateAr: string;
    commentEn: string;
    commentAr: string;
  }>;
};

export const MOCK_APPRAISERS: MockAppraiser[] = [
  {
    id: '1',
    fullNameEn: 'Ahmed Mansour',
    fullNameAr: 'أحمد منصور',
    titleEn: 'Senior Real Estate Appraiser',
    titleAr: 'مقّيم عقاري أول',
    fraLicenseNumber: 'FRA-4402',
    photoUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=400',
    yearsExperience: 14,
    primaryGovernorateEn: 'Cairo',
    primaryGovernorateAr: 'القاهرة',
    serviceDistrictsEn: ['5th Settlement', 'New Capital', 'Nasr City'],
    serviceDistrictsAr: ['التجمع الخامس', 'العاصمة الإدارية', 'مدينة نصر'],
    specialties: [
      { propertyTypeEn: 'Residential Villas', propertyTypeAr: 'فيلات سكنية', yearsExperience: 10 },
      { propertyTypeEn: 'Commercial Complexes', propertyTypeAr: 'مجمعات تجارية', yearsExperience: 4 }
    ],
    bioEn: 'Specializing in high-value residential assets in New Cairo. Over 14 years of experience working with major commercial banks in Egypt.',
    bioAr: 'متخصص في الأصول السكنية عالية القيمة في القاهرة الجديدة. أكثر من 14 عاماً من الخبرة في العمل مع البنوك التجارية الكبرى في مصر.',
    startingPriceEgp: 4500,
    typicalTurnaroundDays: 5,
    availability: 'this_week',
    averageRating: 4.9,
    reviewCount: 32,
    sampleWork: [
      {
        propertyTypeEn: 'Standalone Villa',
        propertyTypeAr: 'فيلا مستقلة',
        areaEn: 'Mivida, New Cairo',
        areaAr: 'ميفيدا، القاهرة الجديدة',
        sqmRange: '450-500',
        valueRangeEn: 'EGP 18M - 22M',
        valueRangeAr: '18 - 22 مليون ج.م',
        dateRangeEn: 'Q1 2026',
        dateRangeAr: 'الربع الأول 2026'
      }
    ],
    reviews: [
      {
        rating: 5,
        firstNameEn: 'Sherif',
        firstNameAr: 'شريف',
        lastInitialEn: 'H.',
        lastInitialAr: 'هـ.',
        dateEn: 'May 2026',
        dateAr: 'مايو 2026',
        commentEn: 'Very professional and detailed report. Highly recommended for bank-grade appraisals.',
        commentAr: 'تقرير احترافي ومفصل للغاية. أنصح به بشدة للتقييمات البنكية.'
      }
    ]
  },
  {
    id: '2',
    fullNameEn: 'Mona El-Sayed',
    fullNameAr: 'منى السيد',
    titleEn: 'Certified Property Appraiser',
    titleAr: 'مقّيم عقاري معتمد',
    fraLicenseNumber: 'FRA-3185',
    photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400',
    yearsExperience: 9,
    primaryGovernorateEn: 'Giza',
    primaryGovernorateAr: 'الجيزة',
    serviceDistrictsEn: ['Sheikh Zayed', '6th October'],
    serviceDistrictsAr: ['الشيخ زايد', '6 أكتوبر'],
    specialties: [
      { propertyTypeEn: 'Apartments', propertyTypeAr: 'شقق سكنية', yearsExperience: 9 }
    ],
    bioEn: 'Dedicated appraiser with deep knowledge of West Cairo developments. Focused on providing accurate valuations for mortgage purposes.',
    bioAr: 'مقّيمة متفانية لديها معرفة عميقة بتطورات غرب القاهرة. تركز على تقديم تقييمات دقيقة لأغراض الرهن العقاري.',
    startingPriceEgp: 3200,
    typicalTurnaroundDays: 4,
    availability: 'next_week',
    averageRating: 4.8,
    reviewCount: 24,
    sampleWork: [],
    reviews: []
  },
  {
    id: '3',
    fullNameEn: 'Tarek Ibrahim',
    fullNameAr: 'طارق إبراهيم',
    titleEn: 'Industrial Property Specialist',
    titleAr: 'متخصص عقارات صناعية',
    fraLicenseNumber: 'FRA-5521',
    photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=400',
    yearsExperience: 20,
    primaryGovernorateEn: 'Alexandria',
    primaryGovernorateAr: 'الإسكندرية',
    serviceDistrictsEn: ['Borg El Arab', 'Smoha'],
    serviceDistrictsAr: ['برج العرب', 'سموحة'],
    specialties: [
      { propertyTypeEn: 'Industrial Warehouses', propertyTypeAr: 'مستودعات صناعية', yearsExperience: 15 },
      { propertyTypeEn: 'Commercial Port Assets', propertyTypeAr: 'أصول موانئ تجارية', yearsExperience: 5 }
    ],
    bioEn: 'Leading industrial asset appraiser in the Alexandria region with over two decades of experience in the Egyptian market.',
    bioAr: 'مقّيم أصول صناعية رائد في منطقة الإسكندرية مع أكثر من عقدين من الخبرة في السوق المصري.',
    startingPriceEgp: 8000,
    typicalTurnaroundDays: 7,
    availability: 'two_weeks',
    averageRating: 5.0,
    reviewCount: 45,
    sampleWork: [],
    reviews: []
  },
  {
    id: '4',
    fullNameEn: 'Hany Gad',
    fullNameAr: 'هاني جاد',
    titleEn: 'Real Estate Valuation Expert',
    titleAr: 'خبير تقييم عقاري',
    fraLicenseNumber: 'FRA-2290',
    photoUrl: 'https://images.unsplash.com/photo-1519085185758-2ed3f11d2698?auto=format&fit=crop&q=80&w=400',
    yearsExperience: 12,
    primaryGovernorateEn: 'Cairo',
    primaryGovernorateAr: 'القاهرة',
    serviceDistrictsEn: ['Zamalek', 'Garden City', 'Maadi'],
    serviceDistrictsAr: ['الزمالك', 'جاردن سيتي', 'المعادي'],
    specialties: [
      { propertyTypeEn: 'Heritage Buildings', propertyTypeAr: 'مباني تراثية', yearsExperience: 12 }
    ],
    bioEn: 'Specialist in heritage and classic Cairo districts. Expertise in valuing unique historic properties and luxury rentals.',
    bioAr: 'متخصص في أحياء القاهرة التراثية والكلاسيكية. خبرة في تقييم العقارات التاريخية الفريدة والإيجارات الفاخرة.',
    startingPriceEgp: 6000,
    typicalTurnaroundDays: 6,
    availability: 'this_week',
    averageRating: 4.7,
    reviewCount: 18,
    sampleWork: [],
    reviews: []
  },
  {
    id: '5',
    fullNameEn: 'Layla Hassan',
    fullNameAr: 'ليلى حسن',
    titleEn: 'Residential Appraiser',
    titleAr: 'مقّيم سكني',
    fraLicenseNumber: 'FRA-4122',
    photoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=400',
    yearsExperience: 7,
    primaryGovernorateEn: 'Cairo',
    primaryGovernorateAr: 'القاهرة',
    serviceDistrictsEn: ['Heliopolis', 'Nasr City'],
    serviceDistrictsAr: ['مصر الجديدة', 'مدينة نصر'],
    specialties: [
      { propertyTypeEn: 'Apartments', propertyTypeAr: 'شقق سكنية', yearsExperience: 7 }
    ],
    bioEn: 'Expert in East Cairo residential market. Known for quick turnarounds and detailed market analysis.',
    bioAr: 'خبيرة في سوق شرق القاهرة السكني. معروفة بسرعة الإنجاز وتحليل السوق المفصل.',
    startingPriceEgp: 2800,
    typicalTurnaroundDays: 3,
    availability: 'this_week',
    averageRating: 4.6,
    reviewCount: 15,
    sampleWork: [],
    reviews: []
  },
  {
    id: '6',
    fullNameEn: 'Omar Sharif',
    fullNameAr: 'عمر شريف',
    titleEn: 'Commercial Valuation Consultant',
    titleAr: 'استشاري تقييم تجاري',
    fraLicenseNumber: 'FRA-6701',
    photoUrl: 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&q=80&w=400',
    yearsExperience: 18,
    primaryGovernorateEn: 'Cairo',
    primaryGovernorateAr: 'القاهرة',
    serviceDistrictsEn: ['Downtown', 'Tahrir', 'Dokki'],
    serviceDistrictsAr: ['وسط البلد', 'التحرير', 'الدقي'],
    specialties: [
      { propertyTypeEn: 'Office Buildings', propertyTypeAr: 'مباني إدارية', yearsExperience: 14 },
      { propertyTypeEn: 'Retail Spaces', propertyTypeAr: 'مساحات تجزئة', yearsExperience: 4 }
    ],
    bioEn: 'Extensive experience in central Cairo commercial districts. Special interest in office occupancy and yield analysis.',
    bioAr: 'خبرة واسعة في المناطق التجارية بوسط القاهرة. اهتمام خاص بإشغال المكاتب وتحليل العائد.',
    startingPriceEgp: 7500,
    typicalTurnaroundDays: 6,
    availability: 'next_week',
    averageRating: 4.9,
    reviewCount: 38,
    sampleWork: [],
    reviews: []
  }
];
