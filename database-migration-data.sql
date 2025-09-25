-- =====================================================
-- eQabo.com Telegram Bot - Data Migration Script
-- Populating database tables with existing hardcoded data
-- =====================================================

-- =====================================================
-- 1. POPULATE KNOWLEDGE BASE TABLE
-- Migrating all hardcoded messages to database
-- =====================================================

-- English messages
INSERT INTO knowledge_base (key, language, message, category) VALUES
('greeting', 'en', '🏨 Welcome to eQabo.com! Ethiopia''s #1 hotel booking assistant.\n\nI''ll help you find and book the perfect hotel in just a few steps! 😊', 'greeting'),
('selectLanguage', 'en', 'Please select your preferred language:', 'language'),
('destination', 'en', '🌍 Which Ethiopian city would you like to visit?', 'booking'),
('hotels', 'en', '🏨 Here are the best hotels in', 'booking'),
('selectHotel', 'en', 'Which hotel interests you?', 'booking'),
('checkIn', 'en', '📅 When would you like to check in? (MM/DD/YYYY)', 'booking'),
('checkOut', 'en', '📅 When would you like to check out? (MM/DD/YYYY)', 'booking'),
('guests', 'en', '👥 How many guests will be staying?', 'booking'),
('payment', 'en', '💳 Choose your preferred payment method:', 'payment'),
('confirmation', 'en', '✅ Booking Summary:', 'booking'),
('confirmBooking', 'en', 'Confirm Booking', 'booking'),
('thankYou', 'en', '🎉 Thank you! Your booking has been confirmed.\n\n📱 Confirmation sent to your phone/email.', 'booking'),
('backToStart', 'en', '🏠 Start New Booking', 'navigation'),
('invalidDate', 'en', '❌ Invalid date format. Please use MM/DD/YYYY', 'validation'),
('invalidGuests', 'en', '❌ Please enter a valid number of guests (1-10)', 'validation'),
('error', 'en', '❌ Something went wrong. Please try again.', 'error'),
('mainMenu', 'en', '🏨 *eQabo.com - Ethiopia Hotel Booking*\n\nWhat would you like to do?', 'menu'),
('searchHotels', 'en', '🔍 Search Hotels', 'menu'),
('myBookings', 'en', '📋 My Bookings', 'menu'),
('support', 'en', '🆘 Customer Support', 'menu'),
('about', 'en', 'ℹ️ About eQabo', 'menu'),
('backToMenu', 'en', '🔙 Back to Menu', 'navigation'),
('noAnswer', 'en', 'I don''t have information about that. Would you like to speak with a human agent?', 'support'),
('escalationReceived', 'en', '✅ Your request has been forwarded to our support team. We''ll get back to you soon!', 'support'),
('feedbackThanks', 'en', 'Thank you for your feedback! It helps us improve our service.', 'support');

-- Amharic messages
INSERT INTO knowledge_base (key, language, message, category) VALUES
('greeting', 'am', '🏨 ወደ eQabo.com እንኳን በደህና መጡ! የኢትዮጵያ #1 የሆቴል ቦታ ማስያዝ ረዳት።\n\nበጥቂት ደረጃዎች ውስጥ ፍጹም ሆቴል እንዲያገኙ እና እንዲያስይዙ እረዳዎታለሁ! 😊', 'greeting'),
('selectLanguage', 'am', 'እባክዎን የሚመርጡትን ቋንቋ ይምረጡ:', 'language'),
('destination', 'am', '🌍 የትኛውን የኢትዮጵያ ከተማ መጎብኘት ይፈልጋሉ?', 'booking'),
('hotels', 'am', '🏨 እነዚህ በ', 'booking'),
('selectHotel', 'am', 'የትኛው ሆቴል ይስብዎታል?', 'booking'),
('checkIn', 'am', '📅 መቼ መግባት ይፈልጋሉ? (ወወ/ቀቀ/ዓዓዓዓ)', 'booking'),
('checkOut', 'am', '📅 መቼ መውጣት ይፈልጋሉ? (ወወ/ቀቀ/ዓዓዓዓ)', 'booking'),
('guests', 'am', '👥 ስንት እንግዶች ይቆያሉ?', 'booking'),
('payment', 'am', '💳 የሚመርጡትን የክፍያ ዘዴ ይምረጡ:', 'payment'),
('confirmation', 'am', '✅ የቦታ ማስያዝ ማጠቃለያ:', 'booking'),
('confirmBooking', 'am', 'ቦታ ማስያዝን አረጋግጥ', 'booking'),
('thankYou', 'am', '🎉 አመሰግናለሁ! የእርስዎ ቦታ ማስያዝ ተረጋግጧል።\n\n📱 ማረጋገጫ ወደ ስልክዎ/ኢሜልዎ ተልኳል።', 'booking'),
('backToStart', 'am', '🏠 አዲስ ቦታ ማስያዝ ጀምር', 'navigation'),
('invalidDate', 'am', '❌ የተሳሳተ የቀን ቅርጸት። እባክዎን ወወ/ቀቀ/ዓዓዓዓ ይጠቀሙ', 'validation'),
('invalidGuests', 'am', '❌ እባክዎን ትክክለኛ የእንግዶች ቁጥር ያስገቡ (1-10)', 'validation'),
('error', 'am', '❌ የሆነ ችግር ተፈጥሯል። እባክዎን እንደገና ይሞክሩ።', 'error'),
('mainMenu', 'am', '🏨 *eQabo.com - የኢትዮጵያ ሆቴል ቦታ ማስያዝ*\n\nምን ማድረግ ይፈልጋሉ?', 'menu'),
('searchHotels', 'am', '🔍 ሆቴሎችን ፈልግ', 'menu'),
('myBookings', 'am', '📋 የእኔ ቦታ ማስያዞች', 'menu'),
('support', 'am', '🆘 የደንበኞች ድጋፍ', 'menu'),
('about', 'am', 'ℹ️ ስለ eQabo', 'menu'),
('backToMenu', 'am', '🔙 ወደ ዋናው ሜኑ ተመለስ', 'navigation'),
('noAnswer', 'am', 'ስለዚያ መረጃ የለኝም። ከሰው ወኪል ጋር መነጋገር ይፈልጋሉ?', 'support'),
('escalationReceived', 'am', '✅ የእርስዎ ጥያቄ ወደ ድጋፍ ቡድናችን ተላልፏል። በቅርቡ እንመልስልዎታለን!', 'support'),
('feedbackThanks', 'am', 'ለግብረመልስዎ አመሰግናለሁ! አገልግሎታችንን ለማሻሻል ይረዳናል።', 'support');

-- Somali messages
INSERT INTO knowledge_base (key, language, message, category) VALUES
('greeting', 'so', '🏨 Ku soo dhawoow eQabo.com! Kaaliyaha tirooyinka hotellada #1 ee Itoobiya.\n\nWaxaan kaa caawin doonaa inaad hesho oo aad buuxiso hoteel fiican dhawr tallaabo gudahood! 😊', 'greeting'),
('selectLanguage', 'so', 'Fadlan dooro luqadda aad door bidayso:', 'language'),
('destination', 'so', '🌍 Magaalo kee oo Itoobiya ah ayaad jeclaan lahayd inaad booqato?', 'booking'),
('hotels', 'so', '🏨 Kuwan waa hotelladda ugu fiican', 'booking'),
('selectHotel', 'so', 'Hoteel kee ayaa ku xiiseynaya?', 'booking'),
('checkIn', 'so', '📅 Goorma ayaad jeclaan lahayd inaad gasho? (MM/BB/SSSS)', 'booking'),
('checkOut', 'so', '📅 Goorma ayaad jeclaan lahayd inaad baxdo? (MM/BB/SSSS)', 'booking'),
('guests', 'so', '👥 Immisa marti ayaa joogi doona?', 'booking'),
('payment', 'so', '💳 Dooro habka lacag bixinta ee aad door bidayso:', 'payment'),
('confirmation', 'so', '✅ Soo koobida buuxinta:', 'booking'),
('confirmBooking', 'so', 'Xaqiiji Buuxinta', 'booking'),
('thankYou', 'so', '🎉 Mahadsanid! Buuxintaada waa la xaqiijiyay.\n\n📱 Xaqiijinta waxaa loo diray taleefankaaga/iimaylkaaga.', 'booking'),
('backToStart', 'so', '🏠 Bilow Buuxin Cusub', 'navigation'),
('invalidDate', 'so', '❌ Qaabka taariikhda khaldan. Fadlan isticmaal MM/BB/SSSS', 'validation'),
('invalidGuests', 'so', '❌ Fadlan geli tiro sax ah oo martida ah (1-10)', 'validation'),
('error', 'so', '❌ Wax khaldan ayaa dhacay. Fadlan mar kale isku day.', 'error'),
('mainMenu', 'so', '🏨 *eQabo.com - Buuxinta Hotellada Itoobiya*\n\nMaxaad samayn doontaa?', 'menu'),
('searchHotels', 'so', '🔍 Raadi Hotelladda', 'menu'),
('myBookings', 'so', '📋 Buuxinnadayda', 'menu'),
('support', 'so', '🆘 Taageerada Macaamiisha', 'menu'),
('about', 'so', 'ℹ️ Ku saabsan eQabo', 'menu'),
('backToMenu', 'so', '🔙 Ku noqo Menu-ga', 'navigation'),
('noAnswer', 'so', 'Ma hayo macluumaad ku saabsan taas. Ma jeclaan lahayd inaad la hadashid wakiil dad ah?', 'support'),
('escalationReceived', 'so', '✅ Codsigaaga waxaa loo gudbiyay kooxda taageerada. Dhawaan ayaan kuu jawaabi doonaa!', 'support'),
('feedbackThanks', 'so', 'Mahadsanid jawaabkaaga! Waxay naga caawisaa inaan hagaajinno adeegayada.', 'support');

-- Oromo messages
INSERT INTO knowledge_base (key, language, message, category) VALUES
('greeting', 'or', '🏨 Gara eQabo.com baga nagattan! Gargaaraa buufata mana keessummaa #1 Itoophiyaa.\n\nMana keessummaa gaarii argachuu fi qabachuu keessaniif tarkaanfii muraasa keessatti isin gargaara! 😊', 'greeting'),
('selectLanguage', 'or', 'Maaloo afaan filattan filadhu:', 'language'),
('destination', 'or', '🌍 Magaalaa Itoobiyaa kam daawwachuu barbaaddu?', 'booking'),
('hotels', 'or', '🏨 Kunneen mana keessummaa gaarii', 'booking'),
('selectHotel', 'or', 'Manni keessummaa kam si hawwata?', 'booking'),
('checkIn', 'or', '📅 Yoom seenuu barbaadda? (GG/JJ/WWWW)', 'booking'),
('checkOut', 'or', '📅 Yoom baʼuu barbaadda? (GG/JJ/WWWW)', 'booking'),
('guests', 'or', '👥 Keessummoonni meeqa turaniiru?', 'booking'),
('payment', 'or', '💳 Mala kaffaltii filattan filadhu:', 'payment'),
('confirmation', 'or', '✅ Cuunfaa qabachuu:', 'booking'),
('confirmBooking', 'or', 'Qabachuu Mirkaneessi', 'booking'),
('thankYou', 'or', '🎉 Galatoomaa! Qabachuun keessan mirkanaaʼeera.\n\n📱 Mirkaneessaan gara bilbila/iimeelii keessaniitti ergameera.', 'booking'),
('backToStart', 'or', '🏠 Qabachuu Haaraa Jalqabi', 'navigation'),
('invalidDate', 'or', '❌ Bifa guyyaa dogoggoraa. Maaloo GG/JJ/WWWW fayyadamaa', 'validation'),
('invalidGuests', 'or', '❌ Maaloo lakkoofsa keessummootaa sirrii galchaa (1-10)', 'validation'),
('error', 'or', '❌ Wanti tokko dogoggoreera. Maaloo irra deebiʼaa yaali.', 'error'),
('mainMenu', 'or', '🏨 *eQabo.com - Buufata Mana Keessummaa Itoophiyaa*\n\nMaal gochuu barbaaddu?', 'menu'),
('searchHotels', 'or', '🔍 Mana Keessummaa Barbaadi', 'menu'),
('myBookings', 'or', '📋 Qabachuu Koo', 'menu'),
('support', 'or', '🆘 Tajaajila Maamilaa', 'menu'),
('about', 'or', 'ℹ️ Waaʼee eQabo', 'menu'),
('backToMenu', 'or', '🔙 Gara Menu Deebiʼi', 'navigation'),
('noAnswer', 'or', 'Waaʼee kanaa odeeffannoo hin qabu. Nama dhugaa waliin haasaʼuu barbaadduu?', 'support'),
('escalationReceived', 'or', '✅ Gaaffiin keessan gara garee deeggaraatti dabarfameera. Dhiheenyatti deebii siif kennina!', 'support'),
('feedbackThanks', 'or', 'Yaada keessaniif galatoomaa! Tajaajila keenya fooyyessuuf nu gargaara.', 'support');

-- Tigrinya messages
INSERT INTO knowledge_base (key, language, message, category) VALUES
('greeting', 'ti', '🏨 ናብ eQabo.com እንቋዕ ብደሓን መጻእኩም! ናይ ኢትዮጵያ #1 ናይ ሆቴል ቦታ ምሕዛዝ ረዳኢ።\n\nብውሑድ ደረጃታት ፍጹም ሆቴል ክትረኽቡን ክትሕዙን ክሕግዘኩም! 😊', 'greeting'),
('selectLanguage', 'ti', 'በጃኹም ዝመረጽኩሞ ቋንቋ ምረጹ:', 'language'),
('destination', 'ti', '🌍 ኣየናይ ናይ ኢትዮጵያ ከተማ ክትበጽሑ ትደልዩ?', 'booking'),
('hotels', 'ti', '🏨 እዞም ኣብ', 'booking'),
('selectHotel', 'ti', 'ኣየናይ ሆቴል ይስሕበኩም?', 'booking'),
('checkIn', 'ti', '📅 መዓስ ክትኣትዉ ትደልዩ? (ወወ/ቀቀ/ዓዓዓዓ)', 'booking'),
('checkOut', 'ti', '📅 መዓስ ክትወጽኡ ትደልዩ? (ወወ/ቀቀ/ዓዓዓዓ)', 'booking'),
('guests', 'ti', '👥 ክንደይ ኣዕሩኽ ክነብሩ እዮም?', 'booking'),
('payment', 'ti', '💳 ዝመረጽኩሞ ናይ ክፍሊት ኣገባብ ምረጹ:', 'payment'),
('confirmation', 'ti', '✅ ናይ ቦታ ምሕዛዝ ጽማቕ:', 'booking'),
('confirmBooking', 'ti', 'ቦታ ምሕዛዝ ኣረጋግጹ', 'booking'),
('thankYou', 'ti', '🎉 የቐንየልና! ናይ ቦታ ምሕዛዝኩም ተረጋጊጹ።\n\n📱 ምርግጋጽ ናብ ተሌፎንኩም/ኢሜልኩም ተላኢኹ።', 'booking'),
('backToStart', 'ti', '🏠 ሓዲሽ ቦታ ምሕዛዝ ጀምሩ', 'navigation'),
('invalidDate', 'ti', '❌ ዘይቅኑዕ ናይ ዕለት ቅርጺ። በጃኹም ወወ/ቀቀ/ዓዓዓዓ ተጠቐሙ', 'validation'),
('invalidGuests', 'ti', '❌ በጃኹም ቅኑዕ ቁጽሪ ኣዕሩኽ ኣእትዉ (1-10)', 'validation'),
('error', 'ti', '❌ ሓደ ነገር ተጋግዩ። በጃኹም ደጊምኩም ፈትኑ።', 'error'),
('mainMenu', 'ti', '🏨 *eQabo.com - ናይ ኢትዮጵያ ሆቴል ቦታ ምሕዛዝ*\n\nእንታይ ክትገብሩ ትደልዩ?', 'menu'),
('searchHotels', 'ti', '🔍 ሆቴላት ድለዩ', 'menu'),
('myBookings', 'ti', '📋 ናይ ቦታ ምሕዛዝ', 'menu'),
('support', 'ti', '🆘 ናይ ዓማዊል ደገፍ', 'menu'),
('about', 'ti', 'ℹ️ ብዛዕባ eQabo', 'menu'),
('backToMenu', 'ti', '🔙 ናብ ቀንዲ ሜኑ ተመለሱ', 'navigation'),
('noAnswer', 'ti', 'ብዛዕባ እዚ ሓበሬታ የብለይን። ምስ ሰብ ወኪል ክትዛረቡ ትደልዩ ዶ?', 'support'),
('escalationReceived', 'ti', '✅ ሕቶኹም ናብ ደገፍ ጋንታና ተላኢኹ። ቀልጢፍና ክንምልሰልኩም!', 'support'),
('feedbackThanks', 'ti', 'ንርእይቶኹም የቐንየልና! ኣገልግሎትና ንምምሕያሽ ይሕግዘና።', 'support');

-- =====================================================
-- 2. POPULATE CITIES TABLE
-- Migrating Ethiopian cities data
-- =====================================================
INSERT INTO cities (key, names, coordinates) VALUES
('addis_ababa', '{"en": "Addis Ababa", "am": "አዲስ አበባ", "so": "Addis Ababa", "or": "Finfinnee", "ti": "አዲስ አበባ"}', '{"latitude": 9.0054, "longitude": 38.7636}'),
('bahir_dar', '{"en": "Bahir Dar", "am": "ባሕር ዳር", "so": "Bahir Dar", "or": "Baahir Daar", "ti": "ባሕሪ ዳር"}', '{"latitude": 11.5998, "longitude": 37.3905}'),
('dire_dawa', '{"en": "Dire Dawa", "am": "ድሬ ዳዋ", "so": "Dire Dawa", "or": "Dire Dhawaa", "ti": "ድሬ ዳዋ"}', '{"latitude": 9.5931, "longitude": 41.8661}'),
('hawassa', '{"en": "Hawassa", "am": "ሐዋሳ", "so": "Hawassa", "or": "Hawassa", "ti": "ሐዋሳ"}', '{"latitude": 7.0621, "longitude": 38.4776}'),
('mekelle', '{"en": "Mekelle", "am": "መቀሌ", "so": "Mekelle", "or": "Maqallee", "ti": "መቐለ"}', '{"latitude": 13.4967, "longitude": 39.4753}'),
('gondar', '{"en": "Gondar", "am": "ጎንደር", "so": "Gondar", "or": "Gondaar", "ti": "ጎንደር"}', '{"latitude": 12.6090, "longitude": 37.4671}'),
('adama', '{"en": "Adama", "am": "አዳማ", "so": "Adama", "or": "Adaamaa", "ti": "አዳማ"}', '{"latitude": 8.5400, "longitude": 39.2675}'),
('jimma', '{"en": "Jimma", "am": "ጅማ", "so": "Jimma", "or": "Jimmaa", "ti": "ጅማ"}', '{"latitude": 7.6731, "longitude": 36.8344}');

-- =====================================================
-- 3. POPULATE HOTELS TABLE
-- Migrating hotel data with city relationships
-- =====================================================

-- Get city IDs for reference
-- Addis Ababa hotels
INSERT INTO hotels (city_id, name, price_per_night, rating, description, images, coordinates) VALUES
((SELECT id FROM cities WHERE key = 'addis_ababa'), 'Sheraton Addis', 8500, 5, 
 '{"en": "Luxury hotel in city center", "am": "በከተማ መሃል የሚገኝ የቅንጦት ሆቴል", "so": "Hotel raaxo leh oo ku yaal xarunta magaalada", "or": "Mana keessummaa mi''aawaa magaalaa gidduutti", "ti": "ኣብ ማእከል ከተማ ዘሎ ናይ ቅንጦት ሆቴል"}',
 '["https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&h=600&fit=crop", "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&h=600&fit=crop", "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&h=600&fit=crop"]',
 '{"latitude": 9.0054, "longitude": 38.7636}'),

((SELECT id FROM cities WHERE key = 'addis_ababa'), 'Radisson Blu', 6200, 4,
 '{"en": "Modern business hotel", "am": "ዘመናዊ የንግድ ሆቴል", "so": "Hotel casri ah oo ganacsi", "or": "Mana keessummaa daldalaa ammayyaa", "ti": "ሓዲሽ ናይ ንግዲ ሆቴል"}',
 '["https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800&h=600&fit=crop", "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&h=600&fit=crop", "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&h=600&fit=crop"]',
 '{"latitude": 9.0084, "longitude": 38.7575}'),

((SELECT id FROM cities WHERE key = 'addis_ababa'), 'Hyatt Regency', 7800, 5,
 '{"en": "Premium hotel with spa", "am": "ከስፓ ጋር የተሟላ ሆቴል", "so": "Hotel heer sare leh oo leh spa", "or": "Mana keessummaa olaanaa spa qabu", "ti": "ምስ ስፓ ዘሎ ልዑል ሆቴል"}',
 '["https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&h=600&fit=crop", "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop", "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800&h=600&fit=crop"]',
 '{"latitude": 9.0065, "longitude": 38.7689}'),

((SELECT id FROM cities WHERE key = 'addis_ababa'), 'Capital Hotel', 3500, 3,
 '{"en": "Budget-friendly downtown hotel", "am": "በጀት ተስማሚ የከተማ ሆቴል", "so": "Hotel jaban oo ku habboon", "or": "Mana keessummaa baasii salphaa", "ti": "ናይ በጀት ተመጣጣኒ ሆቴል"}',
 '["https://images.unsplash.com/photo-1455587734955-081b22074882?w=800&h=600&fit=crop", "https://images.unsplash.com/photo-1586611292717-f828b167408c?w=800&h=600&fit=crop", "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&h=600&fit=crop"]',
 '{"latitude": 9.0045, "longitude": 38.7612}');

-- Bahir Dar hotels
INSERT INTO hotels (city_id, name, price_per_night, rating, description, images, coordinates) VALUES
((SELECT id FROM cities WHERE key = 'bahir_dar'), 'Kuriftu Resort', 4500, 4,
 '{"en": "Lakeside resort hotel", "am": "በሐይቅ ዳርቻ ሪዞርት ሆቴል", "so": "Hotel resort oo hareeraha harada ku yaal", "or": "Mana keessummaa rizoortii haroo cinatti", "ti": "ኣብ ገማግም ባሕሪ ሪዞርት ሆቴል"}',
 '["https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop", "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&h=600&fit=crop", "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop"]',
 '{"latitude": 11.5998, "longitude": 37.3905}'),

((SELECT id FROM cities WHERE key = 'bahir_dar'), 'Tana Hotel', 2800, 3,
 '{"en": "Comfortable city hotel", "am": "ምቹ የከተማ ሆቴል", "so": "Hotel raaxo leh oo magaalada ku yaal", "or": "Mana keessummaa mijataa magaalaa", "ti": "ምቹእ ናይ ከተማ ሆቴል"}',
 '["https://images.unsplash.com/photo-1455587734955-081b22074882?w=800&h=600&fit=crop", "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800&h=600&fit=crop", "https://images.unsplash.com/photo-1586611292717-f828b167408c?w=800&h=600&fit=crop"]',
 '{"latitude": 11.5998, "longitude": 37.3905}'),

((SELECT id FROM cities WHERE key = 'bahir_dar'), 'Blue Nile Resort', 3200, 4,
 '{"en": "Scenic river view hotel", "am": "የወንዝ እይታ ያለው ሆቴል", "so": "Hotel leh muuqaal qurux badan", "or": "Mana keessummaa mul''ata laga", "ti": "ናይ ወንዚ ትርኢት ዘለዎ ሆቴል"}',
 '["https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop", "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&h=600&fit=crop", "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop"]',
 '{"latitude": 11.6020, "longitude": 37.3920}');

-- =====================================================
-- 4. POPULATE PAYMENT METHODS TABLE
-- Migrating payment methods with translations
-- =====================================================
INSERT INTO payment_methods (key, translations, display_order) VALUES
('telebirr', '{"en": "Telebirr", "am": "ቴሌብር", "so": "Telebirr", "or": "Telebirr", "ti": "ቴሌብር"}', 1),
('chappa', '{"en": "Chappa", "am": "ቻፓ", "so": "Chappa", "or": "Chappa", "ti": "ቻፓ"}', 2),
('ebirr', '{"en": "eBirr", "am": "ኢብር", "so": "eBirr", "or": "eBirr", "ti": "ኢብር"}', 3),
('bank', '{"en": "Bank Transfer", "am": "የባንክ ዝውውር", "so": "Wareejinta Bangiga", "or": "Dabarsa Baankii", "ti": "ናይ ባንክ ምልውዋጥ"}', 4);

-- =====================================================
-- DATA MIGRATION COMPLETE
-- =====================================================
-- Summary:
-- ✅ Knowledge base: 25 keys × 5 languages = 125 entries
-- ✅ Cities: 8 Ethiopian cities with coordinates
-- ✅ Hotels: 7 hotels across 2 cities (expandable)
-- ✅ Payment methods: 4 methods with translations
-- 
-- Next steps:
-- 1. Create database service functions
-- 2. Update bot.js to use database queries
-- 3. Test the new dynamic system
-- =====================================================