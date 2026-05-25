-- ============================================================================
-- EXPANDED CITIES DATA
-- Adding actual cities (not districts/neighborhoods) for Egyptian governorates
-- Districts like Maadi, Nasr City, Zamalek are in the districts table
-- ============================================================================

-- Cairo Governorate - Actual separate cities (not neighborhoods within Cairo)
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Cairo'), 'New Cairo', 'القاهرة الجديدة'),
  ((select id from governorates where name_en='Cairo'), 'Helwan', 'حلوان'),
  ((select id from governorates where name_en='Cairo'), 'Badr City', 'مدينة بدر'),
  ((select id from governorates where name_en='Cairo'), 'El Obour City', 'مدينة العبور'),
  ((select id from governorates where name_en='Cairo'), 'El Shorouk City', 'مدينة الشروق'),
  ((select id from governorates where name_en='Cairo'), '15th of May City', 'مدينة 15 مايو'),
  ((select id from governorates where name_en='Cairo'), 'New Administrative Capital', 'العاصمة الإدارية الجديدة')
on conflict (governorate_id, name_en) do nothing;

-- Giza Governorate - Actual cities/markazes
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Giza'), 'Sheikh Zayed City', 'مدينة الشيخ زايد'),
  ((select id from governorates where name_en='Giza'), 'El Hawamdeya', 'الحوامدية'),
  ((select id from governorates where name_en='Giza'), 'El Badrashin', 'البدرشين'),
  ((select id from governorates where name_en='Giza'), 'El Saff', 'الصف'),
  ((select id from governorates where name_en='Giza'), 'Atfih', 'أطفيح'),
  ((select id from governorates where name_en='Giza'), 'El Ayyat', 'العياط'),
  ((select id from governorates where name_en='Giza'), 'Oseem', 'أوسيم'),
  ((select id from governorates where name_en='Giza'), 'Kerdasa', 'كرداسة'),
  ((select id from governorates where name_en='Giza'), 'Abu Rawash', 'أبو رواش')
on conflict (governorate_id, name_en) do nothing;

-- Alexandria - The city itself is both governorate and city, adding Borg El Arab
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Alexandria'), 'Borg El Arab', 'برج العرب'),
  ((select id from governorates where name_en='Alexandria'), 'New Borg El Arab', 'برج العرب الجديدة')
on conflict (governorate_id, name_en) do nothing;

-- Qalyubia Governorate - Cities
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Qalyubia'), 'Banha', 'بنها'),
  ((select id from governorates where name_en='Qalyubia'), 'Shubra El Kheima', 'شبرا الخيمة'),
  ((select id from governorates where name_en='Qalyubia'), 'Qalyub', 'قليوب'),
  ((select id from governorates where name_en='Qalyubia'), 'El Khanka', 'الخانكة'),
  ((select id from governorates where name_en='Qalyubia'), 'Shibin El Qanater', 'شبين القناطر'),
  ((select id from governorates where name_en='Qalyubia'), 'El Qanater El Khayreya', 'القناطر الخيرية'),
  ((select id from governorates where name_en='Qalyubia'), 'Toukh', 'طوخ'),
  ((select id from governorates where name_en='Qalyubia'), 'Qaha', 'قها'),
  ((select id from governorates where name_en='Qalyubia'), 'Kafr Shukr', 'كفر شكر')
on conflict (governorate_id, name_en) do nothing;

-- Sharqia Governorate - Cities
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Sharqia'), 'Zagazig', 'الزقازيق'),
  ((select id from governorates where name_en='Sharqia'), '10th of Ramadan City', 'مدينة العاشر من رمضان'),
  ((select id from governorates where name_en='Sharqia'), 'Belbeis', 'بلبيس'),
  ((select id from governorates where name_en='Sharqia'), 'Abu Hammad', 'أبو حماد'),
  ((select id from governorates where name_en='Sharqia'), 'Abu Kebir', 'أبو كبير'),
  ((select id from governorates where name_en='Sharqia'), 'Faqous', 'فاقوس'),
  ((select id from governorates where name_en='Sharqia'), 'Hihya', 'ههيا'),
  ((select id from governorates where name_en='Sharqia'), 'Kafr Saqr', 'كفر صقر'),
  ((select id from governorates where name_en='Sharqia'), 'Diarb Negm', 'ديرب نجم'),
  ((select id from governorates where name_en='Sharqia'), 'Awlad Saqr', 'أولاد صقر'),
  ((select id from governorates where name_en='Sharqia'), 'El Husseiniya', 'الحسينية'),
  ((select id from governorates where name_en='Sharqia'), 'El Ibrahimiya', 'الإبراهيمية'),
  ((select id from governorates where name_en='Sharqia'), 'Mashtoul El Souk', 'مشتول السوق'),
  ((select id from governorates where name_en='Sharqia'), 'Minya El Qamh', 'منيا القمح')
on conflict (governorate_id, name_en) do nothing;

-- Red Sea - Cities
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Red Sea'), 'Hurghada', 'الغردقة'),
  ((select id from governorates where name_en='Red Sea'), 'Safaga', 'سفاجا'),
  ((select id from governorates where name_en='Red Sea'), 'Marsa Alam', 'مرسى علم'),
  ((select id from governorates where name_en='Red Sea'), 'Ras Ghareb', 'رأس غارب'),
  ((select id from governorates where name_en='Red Sea'), 'El Quseir', 'القصير'),
  ((select id from governorates where name_en='Red Sea'), 'Shalatin', 'شلاتين'),
  ((select id from governorates where name_en='Red Sea'), 'Halayeb', 'حلايب')
on conflict (governorate_id, name_en) do nothing;

-- South Sinai - Cities
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='South Sinai'), 'Sharm El Sheikh', 'شرم الشيخ'),
  ((select id from governorates where name_en='South Sinai'), 'Dahab', 'دهب'),
  ((select id from governorates where name_en='South Sinai'), 'Nuweiba', 'نويبع'),
  ((select id from governorates where name_en='South Sinai'), 'Taba', 'طابا'),
  ((select id from governorates where name_en='South Sinai'), 'Saint Catherine', 'سانت كاترين'),
  ((select id from governorates where name_en='South Sinai'), 'Ras Sudr', 'رأس سدر'),
  ((select id from governorates where name_en='South Sinai'), 'Abu Zenima', 'أبو زنيمة'),
  ((select id from governorates where name_en='South Sinai'), 'El Tor', 'الطور')
on conflict (governorate_id, name_en) do nothing;

-- North Sinai - Cities
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='North Sinai'), 'El Arish', 'العريش'),
  ((select id from governorates where name_en='North Sinai'), 'Sheikh Zuweid', 'الشيخ زويد'),
  ((select id from governorates where name_en='North Sinai'), 'Rafah', 'رفح'),
  ((select id from governorates where name_en='North Sinai'), 'Bir El Abd', 'بئر العبد'),
  ((select id from governorates where name_en='North Sinai'), 'Nakhl', 'نخل'),
  ((select id from governorates where name_en='North Sinai'), 'El Hasana', 'الحسنة')
on conflict (governorate_id, name_en) do nothing;

-- Suez - Cities
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Suez'), 'Suez', 'السويس'),
  ((select id from governorates where name_en='Suez'), 'Ain Sokhna', 'العين السخنة')
on conflict (governorate_id, name_en) do nothing;

-- Ismailia - Cities
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Ismailia'), 'Ismailia', 'الإسماعيلية'),
  ((select id from governorates where name_en='Ismailia'), 'El Tell El Kebir', 'التل الكبير'),
  ((select id from governorates where name_en='Ismailia'), 'Abu Sweir', 'أبو صوير'),
  ((select id from governorates where name_en='Ismailia'), 'El Kassasein', 'القصاصين'),
  ((select id from governorates where name_en='Ismailia'), 'Fayed', 'فايد')
on conflict (governorate_id, name_en) do nothing;

-- Port Said - One city (governorate = city)
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Port Said'), 'Port Said', 'بورسعيد'),
  ((select id from governorates where name_en='Port Said'), 'Port Fouad', 'بور فؤاد')
on conflict (governorate_id, name_en) do nothing;

-- Matrouh (North Coast) - Cities
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Matrouh'), 'Marsa Matrouh', 'مرسى مطروح'),
  ((select id from governorates where name_en='Matrouh'), 'El Alamein', 'العلمين'),
  ((select id from governorates where name_en='Matrouh'), 'New Alamein', 'العلمين الجديدة'),
  ((select id from governorates where name_en='Matrouh'), 'Dabaa', 'الضبعة'),
  ((select id from governorates where name_en='Matrouh'), 'El Hammam', 'الحمام'),
  ((select id from governorates where name_en='Matrouh'), 'Sidi Barrani', 'سيدي براني'),
  ((select id from governorates where name_en='Matrouh'), 'Salloum', 'السلوم'),
  ((select id from governorates where name_en='Matrouh'), 'Siwa', 'سيوة')
on conflict (governorate_id, name_en) do nothing;

-- Dakahlia - Cities
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Dakahlia'), 'Mansoura', 'المنصورة'),
  ((select id from governorates where name_en='Dakahlia'), 'New Mansoura', 'المنصورة الجديدة'),
  ((select id from governorates where name_en='Dakahlia'), 'Mit Ghamr', 'ميت غمر'),
  ((select id from governorates where name_en='Dakahlia'), 'Dekernes', 'دكرنس'),
  ((select id from governorates where name_en='Dakahlia'), 'Aga', 'أجا'),
  ((select id from governorates where name_en='Dakahlia'), 'Belqas', 'بلقاس'),
  ((select id from governorates where name_en='Dakahlia'), 'Sherbin', 'شربين'),
  ((select id from governorates where name_en='Dakahlia'), 'El Sinbillawin', 'السنبلاوين'),
  ((select id from governorates where name_en='Dakahlia'), 'El Matareya', 'المطرية'),
  ((select id from governorates where name_en='Dakahlia'), 'Manzala', 'المنزلة'),
  ((select id from governorates where name_en='Dakahlia'), 'El Gamaliya', 'الجمالية'),
  ((select id from governorates where name_en='Dakahlia'), 'Talkha', 'طلخا'),
  ((select id from governorates where name_en='Dakahlia'), 'Nabaroh', 'نبروه'),
  ((select id from governorates where name_en='Dakahlia'), 'Bani Ebeid', 'بني عبيد')
on conflict (governorate_id, name_en) do nothing;

-- Beheira - Cities
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Beheira'), 'Damanhour', 'دمنهور'),
  ((select id from governorates where name_en='Beheira'), 'Kafr El Dawwar', 'كفر الدوار'),
  ((select id from governorates where name_en='Beheira'), 'Rashid', 'رشيد'),
  ((select id from governorates where name_en='Beheira'), 'Edko', 'إدكو'),
  ((select id from governorates where name_en='Beheira'), 'Abu Hummus', 'أبو حمص'),
  ((select id from governorates where name_en='Beheira'), 'El Delengat', 'الدلنجات'),
  ((select id from governorates where name_en='Beheira'), 'Itay El Barud', 'إيتاي البارود'),
  ((select id from governorates where name_en='Beheira'), 'Housh Eissa', 'حوش عيسى'),
  ((select id from governorates where name_en='Beheira'), 'Shubrakhit', 'شبراخيت'),
  ((select id from governorates where name_en='Beheira'), 'El Mahmoudeya', 'المحمودية'),
  ((select id from governorates where name_en='Beheira'), 'El Rahmaniya', 'الرحمانية'),
  ((select id from governorates where name_en='Beheira'), 'Wadi El Natroun', 'وادي النطرون'),
  ((select id from governorates where name_en='Beheira'), 'Kom Hamada', 'كوم حمادة')
on conflict (governorate_id, name_en) do nothing;

-- Gharbia - Cities
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Gharbia'), 'Tanta', 'طنطا'),
  ((select id from governorates where name_en='Gharbia'), 'El Mahalla El Kubra', 'المحلة الكبرى'),
  ((select id from governorates where name_en='Gharbia'), 'Kafr El Zayat', 'كفر الزيات'),
  ((select id from governorates where name_en='Gharbia'), 'Samannoud', 'سمنود'),
  ((select id from governorates where name_en='Gharbia'), 'Zefta', 'زفتى'),
  ((select id from governorates where name_en='Gharbia'), 'El Santa', 'السنطة'),
  ((select id from governorates where name_en='Gharbia'), 'Basyoun', 'بسيون'),
  ((select id from governorates where name_en='Gharbia'), 'Kotour', 'قطور')
on conflict (governorate_id, name_en) do nothing;

-- Monufia - Cities
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Monufia'), 'Shibin El Kom', 'شبين الكوم'),
  ((select id from governorates where name_en='Monufia'), 'Menouf', 'منوف'),
  ((select id from governorates where name_en='Monufia'), 'Ashmoun', 'أشمون'),
  ((select id from governorates where name_en='Monufia'), 'El Bagour', 'الباجور'),
  ((select id from governorates where name_en='Monufia'), 'Quesna', 'قويسنا'),
  ((select id from governorates where name_en='Monufia'), 'Berket El Sab', 'بركة السبع'),
  ((select id from governorates where name_en='Monufia'), 'Tala', 'تلا'),
  ((select id from governorates where name_en='Monufia'), 'El Shohada', 'الشهداء'),
  ((select id from governorates where name_en='Monufia'), 'Sadat City', 'مدينة السادات')
on conflict (governorate_id, name_en) do nothing;

-- Kafr El Sheikh - Cities
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Kafr El Sheikh'), 'Kafr El Sheikh', 'كفر الشيخ'),
  ((select id from governorates where name_en='Kafr El Sheikh'), 'Desouk', 'دسوق'),
  ((select id from governorates where name_en='Kafr El Sheikh'), 'Fuwwah', 'فوه'),
  ((select id from governorates where name_en='Kafr El Sheikh'), 'Baltim', 'بلطيم'),
  ((select id from governorates where name_en='Kafr El Sheikh'), 'Metoubes', 'مطوبس'),
  ((select id from governorates where name_en='Kafr El Sheikh'), 'El Reyad', 'الرياض'),
  ((select id from governorates where name_en='Kafr El Sheikh'), 'Beila', 'بيلا'),
  ((select id from governorates where name_en='Kafr El Sheikh'), 'Qallin', 'قلين'),
  ((select id from governorates where name_en='Kafr El Sheikh'), 'Sidi Salem', 'سيدي سالم'),
  ((select id from governorates where name_en='Kafr El Sheikh'), 'El Hamoul', 'الحامول')
on conflict (governorate_id, name_en) do nothing;

-- Damietta - Cities
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Damietta'), 'Damietta', 'دمياط'),
  ((select id from governorates where name_en='Damietta'), 'New Damietta', 'دمياط الجديدة'),
  ((select id from governorates where name_en='Damietta'), 'Ras El Bar', 'رأس البر'),
  ((select id from governorates where name_en='Damietta'), 'Faraskour', 'فارسكور'),
  ((select id from governorates where name_en='Damietta'), 'Kafr Saad', 'كفر سعد'),
  ((select id from governorates where name_en='Damietta'), 'El Zarqa', 'الزرقا')
on conflict (governorate_id, name_en) do nothing;

-- Fayoum - Cities
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Fayoum'), 'Fayoum', 'الفيوم'),
  ((select id from governorates where name_en='Fayoum'), 'New Fayoum', 'الفيوم الجديدة'),
  ((select id from governorates where name_en='Fayoum'), 'Ibshway', 'إبشواي'),
  ((select id from governorates where name_en='Fayoum'), 'Itsa', 'إطسا'),
  ((select id from governorates where name_en='Fayoum'), 'Tamiya', 'طامية'),
  ((select id from governorates where name_en='Fayoum'), 'Sinnuris', 'سنورس'),
  ((select id from governorates where name_en='Fayoum'), 'Yusuf El Siddiq', 'يوسف الصديق')
on conflict (governorate_id, name_en) do nothing;

-- Beni Suef - Cities
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Beni Suef'), 'Beni Suef', 'بني سويف'),
  ((select id from governorates where name_en='Beni Suef'), 'New Beni Suef', 'بني سويف الجديدة'),
  ((select id from governorates where name_en='Beni Suef'), 'El Wasta', 'الواسطى'),
  ((select id from governorates where name_en='Beni Suef'), 'Nasser', 'ناصر'),
  ((select id from governorates where name_en='Beni Suef'), 'Ihnasya', 'إهناسيا'),
  ((select id from governorates where name_en='Beni Suef'), 'Beba', 'ببا'),
  ((select id from governorates where name_en='Beni Suef'), 'Somosta', 'سمسطا'),
  ((select id from governorates where name_en='Beni Suef'), 'El Fashn', 'الفشن')
on conflict (governorate_id, name_en) do nothing;

-- Minya - Cities
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Minya'), 'Minya', 'المنيا'),
  ((select id from governorates where name_en='Minya'), 'New Minya', 'المنيا الجديدة'),
  ((select id from governorates where name_en='Minya'), 'Mallawi', 'ملوي'),
  ((select id from governorates where name_en='Minya'), 'Samalout', 'سمالوط'),
  ((select id from governorates where name_en='Minya'), 'El Edwa', 'العدوة'),
  ((select id from governorates where name_en='Minya'), 'Maghagha', 'مغاغة'),
  ((select id from governorates where name_en='Minya'), 'Beni Mazar', 'بني مزار'),
  ((select id from governorates where name_en='Minya'), 'Matai', 'مطاي'),
  ((select id from governorates where name_en='Minya'), 'Abu Qurqas', 'أبو قرقاص'),
  ((select id from governorates where name_en='Minya'), 'Deir Mawas', 'دير مواس')
on conflict (governorate_id, name_en) do nothing;

-- Assiut - Cities
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Assiut'), 'Assiut', 'أسيوط'),
  ((select id from governorates where name_en='Assiut'), 'New Assiut', 'أسيوط الجديدة'),
  ((select id from governorates where name_en='Assiut'), 'Dairout', 'ديروط'),
  ((select id from governorates where name_en='Assiut'), 'Manfalout', 'منفلوط'),
  ((select id from governorates where name_en='Assiut'), 'El Qusiya', 'القوصية'),
  ((select id from governorates where name_en='Assiut'), 'Abnub', 'أبنوب'),
  ((select id from governorates where name_en='Assiut'), 'Abu Tig', 'أبو تيج'),
  ((select id from governorates where name_en='Assiut'), 'El Ghanayem', 'الغنايم'),
  ((select id from governorates where name_en='Assiut'), 'Sahel Selim', 'ساحل سليم'),
  ((select id from governorates where name_en='Assiut'), 'El Badari', 'البداري'),
  ((select id from governorates where name_en='Assiut'), 'Sedfa', 'صدفا')
on conflict (governorate_id, name_en) do nothing;

-- Sohag - Cities
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Sohag'), 'Sohag', 'سوهاج'),
  ((select id from governorates where name_en='Sohag'), 'New Sohag', 'سوهاج الجديدة'),
  ((select id from governorates where name_en='Sohag'), 'Akhmim', 'أخميم'),
  ((select id from governorates where name_en='Sohag'), 'Girga', 'جرجا'),
  ((select id from governorates where name_en='Sohag'), 'El Balyana', 'البلينا'),
  ((select id from governorates where name_en='Sohag'), 'El Maragha', 'المراغة'),
  ((select id from governorates where name_en='Sohag'), 'El Monshah', 'المنشأة'),
  ((select id from governorates where name_en='Sohag'), 'Tahta', 'طهطا'),
  ((select id from governorates where name_en='Sohag'), 'Tema', 'طما'),
  ((select id from governorates where name_en='Sohag'), 'Dar El Salam', 'دار السلام'),
  ((select id from governorates where name_en='Sohag'), 'Sakulta', 'ساقلتة')
on conflict (governorate_id, name_en) do nothing;

-- Qena - Cities
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Qena'), 'Qena', 'قنا'),
  ((select id from governorates where name_en='Qena'), 'New Qena', 'قنا الجديدة'),
  ((select id from governorates where name_en='Qena'), 'Nag Hammadi', 'نجع حمادي'),
  ((select id from governorates where name_en='Qena'), 'Dishna', 'دشنا'),
  ((select id from governorates where name_en='Qena'), 'Qus', 'قوص'),
  ((select id from governorates where name_en='Qena'), 'Abu Tesht', 'أبو تشت'),
  ((select id from governorates where name_en='Qena'), 'Farshout', 'فرشوط'),
  ((select id from governorates where name_en='Qena'), 'Naqada', 'نقادة'),
  ((select id from governorates where name_en='Qena'), 'El Waqf', 'الوقف')
on conflict (governorate_id, name_en) do nothing;

-- Luxor - Cities
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Luxor'), 'Luxor', 'الأقصر'),
  ((select id from governorates where name_en='Luxor'), 'New Luxor', 'الأقصر الجديدة'),
  ((select id from governorates where name_en='Luxor'), 'Esna', 'إسنا'),
  ((select id from governorates where name_en='Luxor'), 'Armant', 'أرمنت'),
  ((select id from governorates where name_en='Luxor'), 'El Toud', 'الطود'),
  ((select id from governorates where name_en='Luxor'), 'El Bayadiya', 'البياضية'),
  ((select id from governorates where name_en='Luxor'), 'El Qurna', 'القرنة')
on conflict (governorate_id, name_en) do nothing;

-- Aswan - Cities
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='Aswan'), 'Aswan', 'أسوان'),
  ((select id from governorates where name_en='Aswan'), 'New Aswan', 'أسوان الجديدة'),
  ((select id from governorates where name_en='Aswan'), 'Kom Ombo', 'كوم أمبو'),
  ((select id from governorates where name_en='Aswan'), 'Edfu', 'إدفو'),
  ((select id from governorates where name_en='Aswan'), 'Daraw', 'دراو'),
  ((select id from governorates where name_en='Aswan'), 'Nasr El Nuba', 'نصر النوبة'),
  ((select id from governorates where name_en='Aswan'), 'Abu Simbel', 'أبو سمبل')
on conflict (governorate_id, name_en) do nothing;

-- New Valley - Cities
insert into cities (governorate_id, name_en, name_ar) values
  ((select id from governorates where name_en='New Valley'), 'Kharga', 'الخارجة'),
  ((select id from governorates where name_en='New Valley'), 'Dakhla', 'الداخلة'),
  ((select id from governorates where name_en='New Valley'), 'Farafra', 'الفرافرة'),
  ((select id from governorates where name_en='New Valley'), 'Baris', 'باريس'),
  ((select id from governorates where name_en='New Valley'), 'Balat', 'بلاط')
on conflict (governorate_id, name_en) do nothing;
