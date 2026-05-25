-- Beit Index Seed Data
-- Comprehensive Egyptian Gazetteer: Governorates, Cities, Districts

-- ============================================================================
-- GOVERNORATES (All 27 Egyptian Governorates)
-- ============================================================================

insert into governorates (name_en, name_ar) values
  ('Cairo', 'القاهرة'),
  ('Giza', 'الجيزة'),
  ('Alexandria', 'الإسكندرية'),
  ('Qalyubia', 'القليوبية'),
  ('Sharqia', 'الشرقية'),
  ('Dakahlia', 'الدقهلية'),
  ('Beheira', 'البحيرة'),
  ('Gharbia', 'الغربية'),
  ('Monufia', 'المنوفية'),
  ('Kafr El Sheikh', 'كفر الشيخ'),
  ('Damietta', 'دمياط'),
  ('Port Said', 'بورسعيد'),
  ('Ismailia', 'الإسماعيلية'),
  ('Suez', 'السويس'),
  ('North Sinai', 'شمال سيناء'),
  ('South Sinai', 'جنوب سيناء'),
  ('Red Sea', 'البحر الأحمر'),
  ('Matrouh', 'مطروح'),
  ('Fayoum', 'الفيوم'),
  ('Beni Suef', 'بني سويف'),
  ('Minya', 'المنيا'),
  ('Assiut', 'أسيوط'),
  ('Sohag', 'سوهاج'),
  ('Qena', 'قنا'),
  ('Luxor', 'الأقصر'),
  ('Aswan', 'أسوان'),
  ('New Valley', 'الوادي الجديد')
on conflict (name_en) do nothing;

-- ============================================================================
-- CITIES
-- ============================================================================

-- Cairo Governorate
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Cairo'), 'Cairo', 'القاهرة'),
  ((select id from governorates where name_en='Cairo'), 'New Cairo', 'القاهرة الجديدة'),
  ((select id from governorates where name_en='Cairo'), 'Helwan', 'حلوان'),
  ((select id from governorates where name_en='Cairo'), '15th of May', 'الخامس عشر من مايو')
on conflict (governorate_id, name_en) do nothing;

-- Giza Governorate
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Giza'), 'Giza', 'الجيزة'),
  ((select id from governorates where name_en='Giza'), '6th October', 'السادس من أكتوبر'),
  ((select id from governorates where name_en='Giza'), 'Sheikh Zayed', 'الشيخ زايد'),
  ((select id from governorates where name_en='Giza'), 'Hadayek October', 'حدائق أكتوبر'),
  ((select id from governorates where name_en='Giza'), 'Sphinx', 'سفنكس')
on conflict (governorate_id, name_en) do nothing;

-- Qalyubia Governorate
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Qalyubia'), 'Banha', 'بنها'),
  ((select id from governorates where name_en='Qalyubia'), 'Shubra El Kheima', 'شبرا الخيمة'),
  ((select id from governorates where name_en='Qalyubia'), 'Qalyub', 'قليوب'),
  ((select id from governorates where name_en='Qalyubia'), 'El Obour', 'العبور'),
  ((select id from governorates where name_en='Qalyubia'), 'El Khanka', 'الخانكة'),
  ((select id from governorates where name_en='Qalyubia'), 'Khosous', 'الخصوص')
on conflict (governorate_id, name_en) do nothing;

-- Sharqia Governorate
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Sharqia'), 'Zagazig', 'الزقازيق'),
  ((select id from governorates where name_en='Sharqia'), '10th of Ramadan', 'العاشر من رمضان'),
  ((select id from governorates where name_en='Sharqia'), 'Belbeis', 'بلبيس'),
  ((select id from governorates where name_en='Sharqia'), 'Abu Hammad', 'أبو حماد'),
  ((select id from governorates where name_en='Sharqia'), 'Minya El Qamh', 'منيا القمح')
on conflict (governorate_id, name_en) do nothing;

-- Alexandria
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Alexandria'), 'Alexandria', 'الإسكندرية'),
  ((select id from governorates where name_en='Alexandria'), 'Borg El Arab', 'برج العرب'),
  ((select id from governorates where name_en='Alexandria'), 'New Borg El Arab', 'برج العرب الجديدة')
on conflict (governorate_id, name_en) do nothing;

-- Red Sea
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Red Sea'), 'Hurghada', 'الغردقة'),
  ((select id from governorates where name_en='Red Sea'), 'El Gouna', 'الجونة'),
  ((select id from governorates where name_en='Red Sea'), 'Safaga', 'سفاجا'),
  ((select id from governorates where name_en='Red Sea'), 'Marsa Alam', 'مرسى علم')
on conflict (governorate_id, name_en) do nothing;

-- South Sinai
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='South Sinai'), 'Sharm El Sheikh', 'شرم الشيخ'),
  ((select id from governorates where name_en='South Sinai'), 'Dahab', 'دهب'),
  ((select id from governorates where name_en='South Sinai'), 'Nuweiba', 'نويبع'),
  ((select id from governorates where name_en='South Sinai'), 'Taba', 'طابا'),
  ((select id from governorates where name_en='South Sinai'), 'Saint Catherine', 'سانت كاترين')
on conflict (governorate_id, name_en) do nothing;

-- Suez
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Suez'), 'Suez', 'السويس'),
  ((select id from governorates where name_en='Suez'), 'Ain Sokhna', 'العين السخنة')
on conflict (governorate_id, name_en) do nothing;

-- Ismailia
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Ismailia'), 'Ismailia', 'الإسماعيلية'),
  ((select id from governorates where name_en='Ismailia'), 'Fayed', 'فايد'),
  ((select id from governorates where name_en='Ismailia'), 'El Qantara', 'القنطرة')
on conflict (governorate_id, name_en) do nothing;

-- Port Said
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Port Said'), 'Port Said', 'بورسعيد'),
  ((select id from governorates where name_en='Port Said'), 'Port Fouad', 'بورفؤاد')
on conflict (governorate_id, name_en) do nothing;

-- Matrouh (North Coast)
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Matrouh'), 'Marsa Matrouh', 'مرسى مطروح'),
  ((select id from governorates where name_en='Matrouh'), 'North Coast', 'الساحل الشمالي'),
  ((select id from governorates where name_en='Matrouh'), 'Alamein', 'العلمين'),
  ((select id from governorates where name_en='Matrouh'), 'Sidi Abdel Rahman', 'سيدي عبدالرحمن')
on conflict (governorate_id, name_en) do nothing;

-- Dakahlia
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Dakahlia'), 'Mansoura', 'المنصورة'),
  ((select id from governorates where name_en='Dakahlia'), 'Talkha', 'طلخا'),
  ((select id from governorates where name_en='Dakahlia'), 'Mit Ghamr', 'ميت غمر'),
  ((select id from governorates where name_en='Dakahlia'), 'Gamasa', 'جمصة')
on conflict (governorate_id, name_en) do nothing;

-- Beheira
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Beheira'), 'Damanhur', 'دمنهور'),
  ((select id from governorates where name_en='Beheira'), 'Kafr El Dawwar', 'كفر الدوار'),
  ((select id from governorates where name_en='Beheira'), 'Rashid', 'رشيد')
on conflict (governorate_id, name_en) do nothing;

-- Gharbia
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Gharbia'), 'Tanta', 'طنطا'),
  ((select id from governorates where name_en='Gharbia'), 'El Mahalla El Kubra', 'المحلة الكبرى'),
  ((select id from governorates where name_en='Gharbia'), 'Kafr El Zayat', 'كفر الزيات')
on conflict (governorate_id, name_en) do nothing;

-- Upper Egypt
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Luxor'), 'Luxor', 'الأقصر'),
  ((select id from governorates where name_en='Aswan'), 'Aswan', 'أسوان'),
  ((select id from governorates where name_en='Fayoum'), 'Fayoum', 'الفيوم'),
  ((select id from governorates where name_en='Minya'), 'Minya', 'المنيا'),
  ((select id from governorates where name_en='Assiut'), 'Assiut', 'أسيوط'),
  ((select id from governorates where name_en='Sohag'), 'Sohag', 'سوهاج')
on conflict (governorate_id, name_en) do nothing;

-- ============================================================================
-- DISTRICTS
-- ============================================================================

-- ===================
-- CAIRO DISTRICTS
-- ===================
insert into districts (city_id, name_en, name_ar) values
  -- Central Cairo
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'Maadi', 'المعادي'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'Old Maadi', 'المعادي القديمة'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'New Maadi', 'المعادي الجديدة'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'Degla Maadi', 'دجلة المعادي'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'Sarayat Maadi', 'سرايات المعادي'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'Zahraa El Maadi', 'زهراء المعادي'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'Heliopolis', 'مصر الجديدة'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'Korba', 'كوربة'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'Sheraton', 'شيراتون'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'Nasr City', 'مدينة نصر'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'Zamalek', 'الزمالك'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'Garden City', 'جاردن سيتي'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'Downtown', 'وسط البلد'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'Mokattam', 'المقطم'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'Ain Shams', 'عين شمس'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'El Marg', 'المرج'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'El Salam', 'السلام'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'El Matareya', 'المطرية'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'El Zeitoun', 'الزيتون'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'Hadayek El Kobba', 'حدائق القبة'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'Abbassia', 'العباسية'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'El Nozha', 'النزهة'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'El Nozha El Gedida', 'النزهة الجديدة'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'El Basateen', 'البساتين'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'Dar El Salam', 'دار السلام'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'Sayeda Zeinab', 'السيدة زينب'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'Sayeda Aisha', 'السيدة عائشة'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'El Khalifa', 'الخليفة'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'El Darb El Ahmar', 'الدرب الأحمر'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'El Gamaliya', 'الجمالية'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'Shubra', 'شبرا'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'Rod El Farag', 'روض الفرج'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'El Waili', 'الوايلي'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'Manshiyyet Nasser', 'منشية ناصر'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'El Tebbin', 'التبين'),
  ((select id from cities where name_en='Cairo' and governorate_id=(select id from governorates where name_en='Cairo')), 'Tura', 'طرة')
on conflict (city_id, name_en) do nothing;

-- ===================
-- NEW CAIRO DISTRICTS (Comprehensive)
-- ===================
insert into districts (city_id, name_en, name_ar) values
  -- Settlements
  ((select id from cities where name_en='New Cairo'), '1st Settlement', 'التجمع الأول'),
  ((select id from cities where name_en='New Cairo'), '3rd Settlement', 'التجمع الثالث'),
  ((select id from cities where name_en='New Cairo'), '5th Settlement', 'التجمع الخامس'),
  -- Districts (Ahya2)
  ((select id from cities where name_en='New Cairo'), 'First District', 'الحى الأول'),
  ((select id from cities where name_en='New Cairo'), 'Second District', 'الحى الثاني'),
  ((select id from cities where name_en='New Cairo'), 'Third District', 'الحى الثالث'),
  ((select id from cities where name_en='New Cairo'), 'Fourth District', 'الحى الرابع'),
  ((select id from cities where name_en='New Cairo'), 'Fifth District', 'الحى الخامس'),
  ((select id from cities where name_en='New Cairo'), 'Sixth District', 'الحى السادس'),
  ((select id from cities where name_en='New Cairo'), 'Seventh District', 'الحى السابع'),
  ((select id from cities where name_en='New Cairo'), 'Eighth District', 'الحى الثامن'),
  ((select id from cities where name_en='New Cairo'), 'Ninth District', 'الحى التاسع'),
  ((select id from cities where name_en='New Cairo'), 'Tenth District', 'الحى العاشر'),
  -- Neighborhoods
  ((select id from cities where name_en='New Cairo'), 'El Narges', 'النرجس'),
  ((select id from cities where name_en='New Cairo'), 'El Yasmin', 'الياسمين'),
  ((select id from cities where name_en='New Cairo'), 'Banafseg', 'البنفسج'),
  ((select id from cities where name_en='New Cairo'), 'El Lotus', 'اللوتس'),
  ((select id from cities where name_en='New Cairo'), 'El Andalus', 'الأندلس'),
  ((select id from cities where name_en='New Cairo'), 'El Burouj', 'البروج'),
  ((select id from cities where name_en='New Cairo'), 'South Academy', 'جنوب الأكاديمية'),
  ((select id from cities where name_en='New Cairo'), 'North Investors', 'شمال المستثمرين'),
  ((select id from cities where name_en='New Cairo'), 'North Teseen', 'شمال التسعين'),
  ((select id from cities where name_en='New Cairo'), 'South Teseen', 'جنوب التسعين'),
  -- Housing Projects
  ((select id from cities where name_en='New Cairo'), 'Social Housing', 'الإسكان الاجتماعي'),
  ((select id from cities where name_en='New Cairo'), 'Upgraded Housing', 'الإسكان المتطور'),
  ((select id from cities where name_en='New Cairo'), 'Youth Housing', 'إسكان الشباب'),
  ((select id from cities where name_en='New Cairo'), 'Distinctive Housing', 'الإسكان المتميز'),
  -- Compounds and Developments
  ((select id from cities where name_en='New Cairo'), 'Katameya Heights', 'كتاميا هايتس'),
  ((select id from cities where name_en='New Cairo'), 'Katameya Dunes', 'كتاميا ديونز'),
  ((select id from cities where name_en='New Cairo'), 'Katameya Gardens', 'حدائق القطامية'),
  ((select id from cities where name_en='New Cairo'), 'Mountain View', 'ماونتن فيو'),
  ((select id from cities where name_en='New Cairo'), 'Mivida', 'ميفيدا'),
  ((select id from cities where name_en='New Cairo'), 'Lake View', 'ليك فيو'),
  ((select id from cities where name_en='New Cairo'), 'Palm Hills Katameya', 'بالم هيلز القطامية'),
  ((select id from cities where name_en='New Cairo'), 'Arabella Park', 'أرابيلا بارك'),
  ((select id from cities where name_en='New Cairo'), 'The Waterway', 'ذا واتر واي'),
  ((select id from cities where name_en='New Cairo'), 'Hyde Park', 'هايد بارك'),
  ((select id from cities where name_en='New Cairo'), 'Village Gate', 'فيلدج جيت'),
  ((select id from cities where name_en='New Cairo'), 'Village Gardens', 'فيلدج جاردنز'),
  ((select id from cities where name_en='New Cairo'), 'Stone Park', 'ستون بارك'),
  ((select id from cities where name_en='New Cairo'), 'Eastown', 'إيست تاون'),
  ((select id from cities where name_en='New Cairo'), 'Sodic East', 'سوديك إيست'),
  ((select id from cities where name_en='New Cairo'), 'Galleria', 'جاليريا'),
  -- Satellite Cities
  ((select id from cities where name_en='New Cairo'), 'Madinaty', 'مدينتي'),
  ((select id from cities where name_en='New Cairo'), 'Rehab City', 'مدينة الرحاب'),
  ((select id from cities where name_en='New Cairo'), 'Shorouk City', 'مدينة الشروق'),
  ((select id from cities where name_en='New Cairo'), 'Badr City', 'مدينة بدر'),
  -- New Administrative Capital
  ((select id from cities where name_en='New Cairo'), 'New Administrative Capital', 'العاصمة الإدارية الجديدة'),
  ((select id from cities where name_en='New Cairo'), 'R5 Compound', 'كمبوند R5'),
  ((select id from cities where name_en='New Cairo'), 'R7 Compound', 'كمبوند R7'),
  ((select id from cities where name_en='New Cairo'), 'R8 Compound', 'كمبوند R8')
on conflict (city_id, name_en) do nothing;

-- ===================
-- GIZA DISTRICTS
-- ===================
insert into districts (city_id, name_en, name_ar) values
  ((select id from cities where name_en='Giza' and governorate_id=(select id from governorates where name_en='Giza')), 'Dokki', 'الدقي'),
  ((select id from cities where name_en='Giza' and governorate_id=(select id from governorates where name_en='Giza')), 'Mohandessin', 'المهندسين'),
  ((select id from cities where name_en='Giza' and governorate_id=(select id from governorates where name_en='Giza')), 'Agouza', 'العجوزة'),
  ((select id from cities where name_en='Giza' and governorate_id=(select id from governorates where name_en='Giza')), 'Haram', 'الهرم'),
  ((select id from cities where name_en='Giza' and governorate_id=(select id from governorates where name_en='Giza')), 'Faisal', 'فيصل'),
  ((select id from cities where name_en='Giza' and governorate_id=(select id from governorates where name_en='Giza')), 'Imbaba', 'إمبابة'),
  ((select id from cities where name_en='Giza' and governorate_id=(select id from governorates where name_en='Giza')), 'Bulaq Dakrour', 'بولاق الدكرور'),
  ((select id from cities where name_en='Giza' and governorate_id=(select id from governorates where name_en='Giza')), 'Kerdasa', 'كرداسة'),
  ((select id from cities where name_en='Giza' and governorate_id=(select id from governorates where name_en='Giza')), 'Omraneya', 'العمرانية'),
  ((select id from cities where name_en='Giza' and governorate_id=(select id from governorates where name_en='Giza')), 'Warraq', 'الوراق'),
  ((select id from cities where name_en='Giza' and governorate_id=(select id from governorates where name_en='Giza')), 'Giza Square', 'ميدان الجيزة'),
  ((select id from cities where name_en='Giza' and governorate_id=(select id from governorates where name_en='Giza')), 'Lebanon Square', 'ميدان لبنان'),
  ((select id from cities where name_en='Giza' and governorate_id=(select id from governorates where name_en='Giza')), 'Kit Kat', 'كيت كات'),
  ((select id from cities where name_en='Giza' and governorate_id=(select id from governorates where name_en='Giza')), 'Remaya Square', 'ميدان الرماية'),
  ((select id from cities where name_en='Giza' and governorate_id=(select id from governorates where name_en='Giza')), 'Mariouteyya', 'المريوطية'),
  ((select id from cities where name_en='Giza' and governorate_id=(select id from governorates where name_en='Giza')), 'Hadayek El Ahram', 'حدائق الأهرام')
on conflict (city_id, name_en) do nothing;

-- ===================
-- 6TH OCTOBER DISTRICTS
-- ===================
insert into districts (city_id, name_en, name_ar) values
  ((select id from cities where name_en='6th October'), '1st District', 'الحى الأول'),
  ((select id from cities where name_en='6th October'), '2nd District', 'الحى الثاني'),
  ((select id from cities where name_en='6th October'), '3rd District', 'الحى الثالث'),
  ((select id from cities where name_en='6th October'), '4th District', 'الحى الرابع'),
  ((select id from cities where name_en='6th October'), '5th District', 'الحى الخامس'),
  ((select id from cities where name_en='6th October'), '6th District', 'الحى السادس'),
  ((select id from cities where name_en='6th October'), '7th District', 'الحى السابع'),
  ((select id from cities where name_en='6th October'), '8th District', 'الحى الثامن'),
  ((select id from cities where name_en='6th October'), '9th District', 'الحى التاسع'),
  ((select id from cities where name_en='6th October'), '10th District', 'الحى العاشر'),
  ((select id from cities where name_en='6th October'), '11th District', 'الحى الحادى عشر'),
  ((select id from cities where name_en='6th October'), '12th District', 'الحى الثانى عشر'),
  ((select id from cities where name_en='6th October'), 'Motamayez District', 'الحى المتميز'),
  ((select id from cities where name_en='6th October'), 'Youth Housing', 'إسكان الشباب'),
  ((select id from cities where name_en='6th October'), 'Social Housing', 'الإسكان الاجتماعي'),
  -- Compounds
  ((select id from cities where name_en='6th October'), 'Dreamland', 'دريم لاند'),
  ((select id from cities where name_en='6th October'), 'Beverly Hills', 'بيفرلي هيلز'),
  ((select id from cities where name_en='6th October'), 'Palm Hills', 'بالم هيلز'),
  ((select id from cities where name_en='6th October'), 'Palm Parks', 'بالم باركس'),
  ((select id from cities where name_en='6th October'), 'Allegria', 'أليجريا'),
  ((select id from cities where name_en='6th October'), 'Casa', 'كازا'),
  ((select id from cities where name_en='6th October'), 'Badya', 'بادية'),
  ((select id from cities where name_en='6th October'), 'Mountain View October', 'ماونتن فيو أكتوبر'),
  ((select id from cities where name_en='6th October'), 'Sun Capital', 'صن كابيتال'),
  ((select id from cities where name_en='6th October'), 'O West', 'أو ويست'),
  ((select id from cities where name_en='6th October'), 'October Plaza', 'أكتوبر بلازا'),
  ((select id from cities where name_en='6th October'), 'Compound Egypt', 'كمبوند مصر'),
  ((select id from cities where name_en='6th October'), 'Green Belt', 'جرين بيلت'),
  ((select id from cities where name_en='6th October'), 'Dara Gardens', 'دارا جاردنز'),
  ((select id from cities where name_en='6th October'), 'La Vista City', 'لافيستا سيتي'),
  ((select id from cities where name_en='6th October'), 'Westown', 'ويست تاون')
on conflict (city_id, name_en) do nothing;

-- ===================
-- SHEIKH ZAYED DISTRICTS
-- ===================
insert into districts (city_id, name_en, name_ar) values
  ((select id from cities where name_en='Sheikh Zayed'), '1st District', 'الحى الأول'),
  ((select id from cities where name_en='Sheikh Zayed'), '2nd District', 'الحى الثاني'),
  ((select id from cities where name_en='Sheikh Zayed'), '3rd District', 'الحى الثالث'),
  ((select id from cities where name_en='Sheikh Zayed'), '4th District', 'الحى الرابع'),
  ((select id from cities where name_en='Sheikh Zayed'), '5th District', 'الحى الخامس'),
  ((select id from cities where name_en='Sheikh Zayed'), '6th District', 'الحى السادس'),
  ((select id from cities where name_en='Sheikh Zayed'), '7th District', 'الحى السابع'),
  ((select id from cities where name_en='Sheikh Zayed'), '8th District', 'الحى الثامن'),
  ((select id from cities where name_en='Sheikh Zayed'), '9th District', 'الحى التاسع'),
  ((select id from cities where name_en='Sheikh Zayed'), '10th District', 'الحى العاشر'),
  ((select id from cities where name_en='Sheikh Zayed'), '11th District', 'الحى الحادى عشر'),
  ((select id from cities where name_en='Sheikh Zayed'), '12th District', 'الحى الثانى عشر'),
  ((select id from cities where name_en='Sheikh Zayed'), '13th District', 'الحى الثالث عشر'),
  ((select id from cities where name_en='Sheikh Zayed'), '14th District', 'الحى الرابع عشر'),
  ((select id from cities where name_en='Sheikh Zayed'), '15th District', 'الحى الخامس عشر'),
  ((select id from cities where name_en='Sheikh Zayed'), '16th District', 'الحى السادس عشر'),
  -- Compounds
  ((select id from cities where name_en='Sheikh Zayed'), 'Zayed 2000', 'زايد ألفين'),
  ((select id from cities where name_en='Sheikh Zayed'), 'Arkan', 'أركان'),
  ((select id from cities where name_en='Sheikh Zayed'), 'Westown Hub', 'ويست تاون هب'),
  ((select id from cities where name_en='Sheikh Zayed'), 'Zed West', 'زيد ويست'),
  ((select id from cities where name_en='Sheikh Zayed'), 'Sodic West', 'سوديك ويست'),
  ((select id from cities where name_en='Sheikh Zayed'), 'The Estates', 'ذا إستيتس'),
  ((select id from cities where name_en='Sheikh Zayed'), 'Forty West', 'فورتى ويست'),
  ((select id from cities where name_en='Sheikh Zayed'), 'El Rabwa', 'الربوة'),
  ((select id from cities where name_en='Sheikh Zayed'), 'Karma Heights', 'كارما هايتس')
on conflict (city_id, name_en) do nothing;

-- ===================
-- HADAYEK OCTOBER (October Gardens)
-- ===================
insert into districts (city_id, name_en, name_ar) values
  ((select id from cities where name_en='Hadayek October'), '1st District', 'الحى الأول'),
  ((select id from cities where name_en='Hadayek October'), '2nd District', 'الحى الثاني'),
  ((select id from cities where name_en='Hadayek October'), '3rd District', 'الحى الثالث'),
  ((select id from cities where name_en='Hadayek October'), 'Ashgar City', 'أشجار سيتي'),
  ((select id from cities where name_en='Hadayek October'), 'October Park', 'أكتوبر بارك'),
  ((select id from cities where name_en='Hadayek October'), 'Green Square', 'جرين سكوير')
on conflict (city_id, name_en) do nothing;

-- ===================
-- ALEXANDRIA DISTRICTS
-- ===================
insert into districts (city_id, name_en, name_ar) values
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'Smouha', 'سموحة'),
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'Stanley', 'ستانلي'),
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'Roushdy', 'رشدي'),
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'Sidi Gaber', 'سيدي جابر'),
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'Gleem', 'جليم'),
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'San Stefano', 'سان ستيفانو'),
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'Sporting', 'سبورتنج'),
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'Louran', 'لوران'),
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'Cleopatra', 'كليوباترا'),
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'Montazah', 'المنتزه'),
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'Camp Caesar', 'كامب شيزار'),
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'Mandara', 'المندرة'),
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'Miami', 'ميامي'),
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'Asafra', 'العصافرة'),
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'Sidi Bishr', 'سيدي بشر'),
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'Victoria', 'فكتوريا'),
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'Kafr Abdo', 'كفر عبده'),
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'Zezenia', 'زيزينيا'),
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'Ibrahimia', 'الإبراهيمية'),
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'Agami', 'العجمي'),
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'Bitash', 'البيطاش'),
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'Hannoville', 'هانوفيل'),
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'King Mariout', 'كنج مريوط'),
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'El Azarita', 'الأزاريطة'),
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'Mahatet El Raml', 'محطة الرمل'),
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'Karmouz', 'كرموز'),
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'Moharam Bek', 'محرم بك'),
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'Attarin', 'العطارين'),
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'Manshiya', 'المنشية'),
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'Bab Sharq', 'باب شرق'),
  ((select id from cities where name_en='Alexandria' and governorate_id=(select id from governorates where name_en='Alexandria')), 'Anfushi', 'الأنفوشي')
on conflict (city_id, name_en) do nothing;

-- ===================
-- NORTH COAST DISTRICTS
-- ===================
insert into districts (city_id, name_en, name_ar) values
  ((select id from cities where name_en='North Coast'), 'Sidi Abdel Rahman', 'سيدي عبد الرحمن'),
  ((select id from cities where name_en='North Coast'), 'Marina', 'مارينا'),
  ((select id from cities where name_en='North Coast'), 'Marassi', 'مراسي'),
  ((select id from cities where name_en='North Coast'), 'Hacienda Bay', 'هاسيندا باي'),
  ((select id from cities where name_en='North Coast'), 'Hacienda White', 'هاسيندا وايت'),
  ((select id from cities where name_en='North Coast'), 'Mountain View Ras El Hikma', 'ماونتن فيو رأس الحكمة'),
  ((select id from cities where name_en='North Coast'), 'La Vista Bay', 'لافيستا باي'),
  ((select id from cities where name_en='North Coast'), 'Telal El Sahel', 'تلال الساحل'),
  ((select id from cities where name_en='North Coast'), 'Amwaj', 'أمواج'),
  ((select id from cities where name_en='North Coast'), 'Bo Islands', 'بو أيلاندز'),
  ((select id from cities where name_en='North Coast'), 'Fouka Bay', 'فوكا باي'),
  ((select id from cities where name_en='North Coast'), 'Jefaira', 'جيفيرا'),
  ((select id from cities where name_en='North Coast'), 'Playa', 'بلايا'),
  ((select id from cities where name_en='North Coast'), 'Seazen', 'سيزن'),
  ((select id from cities where name_en='North Coast'), 'North Edge', 'نورث إيدج'),
  ((select id from cities where name_en='North Coast'), 'D-Bay', 'دي باي'),
  ((select id from cities where name_en='North Coast'), 'Silver Sands', 'سيلفر ساندز'),
  ((select id from cities where name_en='North Coast'), 'Caesar', 'قيصر'),
  ((select id from cities where name_en='North Coast'), 'Zahran', 'زهران'),
  ((select id from cities where name_en='North Coast'), 'Ras El Hikma', 'رأس الحكمة')
on conflict (city_id, name_en) do nothing;

-- ===================
-- ALAMEIN DISTRICTS
-- ===================
insert into districts (city_id, name_en, name_ar) values
  ((select id from cities where name_en='Alamein'), 'New Alamein', 'العلمين الجديدة'),
  ((select id from cities where name_en='Alamein'), 'Alamein Towers', 'أبراج العلمين'),
  ((select id from cities where name_en='Alamein'), 'Latin District', 'الحي اللاتيني'),
  ((select id from cities where name_en='Alamein'), 'Heritage District', 'حي التراث'),
  ((select id from cities where name_en='Alamein'), 'Beach District', 'الحي الشاطئي')
on conflict (city_id, name_en) do nothing;

-- ===================
-- EL OBOUR DISTRICTS
-- ===================
insert into districts (city_id, name_en, name_ar) values
  ((select id from cities where name_en='El Obour'), '1st District', 'الحى الأول'),
  ((select id from cities where name_en='El Obour'), '2nd District', 'الحى الثاني'),
  ((select id from cities where name_en='El Obour'), '3rd District', 'الحى الثالث'),
  ((select id from cities where name_en='El Obour'), '4th District', 'الحى الرابع'),
  ((select id from cities where name_en='El Obour'), '5th District', 'الحى الخامس'),
  ((select id from cities where name_en='El Obour'), '6th District', 'الحى السادس'),
  ((select id from cities where name_en='El Obour'), '7th District', 'الحى السابع'),
  ((select id from cities where name_en='El Obour'), '8th District', 'الحى الثامن'),
  ((select id from cities where name_en='El Obour'), 'Golf City', 'جولف سيتي'),
  ((select id from cities where name_en='El Obour'), 'Royal City', 'رويال سيتي')
on conflict (city_id, name_en) do nothing;

-- ===================
-- 10TH OF RAMADAN DISTRICTS
-- ===================
insert into districts (city_id, name_en, name_ar) values
  ((select id from cities where name_en='10th of Ramadan'), 'District A', 'الحي أ'),
  ((select id from cities where name_en='10th of Ramadan'), 'District B', 'الحي ب'),
  ((select id from cities where name_en='10th of Ramadan'), 'District C', 'الحي ج'),
  ((select id from cities where name_en='10th of Ramadan'), 'Youth Housing', 'إسكان الشباب'),
  ((select id from cities where name_en='10th of Ramadan'), 'Social Housing', 'الإسكان الاجتماعي')
on conflict (city_id, name_en) do nothing;

-- ===================
-- HURGHADA DISTRICTS
-- ===================
insert into districts (city_id, name_en, name_ar) values
  ((select id from cities where name_en='Hurghada'), 'El Dahar', 'الدهار'),
  ((select id from cities where name_en='Hurghada'), 'Sekalla', 'سقالة'),
  ((select id from cities where name_en='Hurghada'), 'El Kawther', 'الكوثر'),
  ((select id from cities where name_en='Hurghada'), 'El Helal', 'الهلال'),
  ((select id from cities where name_en='Hurghada'), 'El Ahyaa', 'الأحياء'),
  ((select id from cities where name_en='Hurghada'), 'El Mamsha', 'الممشى'),
  ((select id from cities where name_en='Hurghada'), 'Sahl Hasheesh', 'سهل حشيش'),
  ((select id from cities where name_en='Hurghada'), 'Makadi Bay', 'مكادي باي'),
  ((select id from cities where name_en='Hurghada'), 'Arabia', 'العربية')
on conflict (city_id, name_en) do nothing;

-- ===================
-- SHARM EL SHEIKH DISTRICTS
-- ===================
insert into districts (city_id, name_en, name_ar) values
  ((select id from cities where name_en='Sharm El Sheikh'), 'Naama Bay', 'خليج نعمة'),
  ((select id from cities where name_en='Sharm El Sheikh'), 'Old Market', 'السوق القديم'),
  ((select id from cities where name_en='Sharm El Sheikh'), 'Hadaba', 'الهضبة'),
  ((select id from cities where name_en='Sharm El Sheikh'), 'Nabq Bay', 'خليج نبق'),
  ((select id from cities where name_en='Sharm El Sheikh'), 'Sharks Bay', 'خليج القرش'),
  ((select id from cities where name_en='Sharm El Sheikh'), 'Ras Um Sid', 'رأس أم سيد'),
  ((select id from cities where name_en='Sharm El Sheikh'), 'El Montazah', 'المنتزه'),
  ((select id from cities where name_en='Sharm El Sheikh'), 'El Ruwaisat', 'الرويسات')
on conflict (city_id, name_en) do nothing;

-- ===================
-- AIN SOKHNA DISTRICTS
-- ===================
insert into districts (city_id, name_en, name_ar) values
  ((select id from cities where name_en='Ain Sokhna'), 'Ain Sokhna', 'العين السخنة'),
  ((select id from cities where name_en='Ain Sokhna'), 'Porto Sokhna', 'بورتو السخنة'),
  ((select id from cities where name_en='Ain Sokhna'), 'La Vista', 'لافيستا'),
  ((select id from cities where name_en='Ain Sokhna'), 'Telal Sokhna', 'تلال السخنة'),
  ((select id from cities where name_en='Ain Sokhna'), 'Mountain View Sokhna', 'ماونتن فيو السخنة'),
  ((select id from cities where name_en='Ain Sokhna'), 'Azha', 'أزها'),
  ((select id from cities where name_en='Ain Sokhna'), 'Il Monte Galala', 'إل مونت جلالة')
on conflict (city_id, name_en) do nothing;
