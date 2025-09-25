import supabase from './src/supabase.js';

async function populateTestData() {
    console.log('🌱 Populating test data...');
    
    try {
        // First, get a city ID to use for hotels
        console.log('📍 Getting city data...');
        const { data: cities, error: citiesError } = await supabase
            .from('cities')
            .select('id, key, names')
            .limit(1);
        
        if (citiesError || !cities || cities.length === 0) {
            console.log('❌ No cities found. Creating test city...');
            
            const { data: newCity, error: cityCreateError } = await supabase
                .from('cities')
                .insert([{
                    key: 'addis_ababa',
                    names: {
                        en: 'Addis Ababa',
                        am: 'አዲስ አበባ',
                        so: 'Addis Ababa',
                        or: 'Finfinnee',
                        ti: 'አዲስ አበባ'
                    },
                    coordinates: {
                        latitude: 9.0054,
                        longitude: 38.7636
                    }
                }])
                .select()
                .single();
            
            if (cityCreateError) {
                console.log('❌ Failed to create test city:', cityCreateError);
                return;
            }
            
            console.log('✅ Test city created:', newCity.names.en);
            cities[0] = newCity;
        }
        
        const cityId = cities[0].id;
        console.log('✅ Using city:', cities[0].names?.en || cities[0].key);
        
        // Check if hotels table is accessible
        console.log('🏨 Testing hotels table...');
        const { data: existingHotels, error: hotelsError } = await supabase
            .from('hotels')
            .select('*')
            .limit(1);
        
        if (hotelsError) {
            console.log('❌ Hotels table error:', hotelsError.message);
            console.log('📋 Please run the fix-database.sql file in your Supabase SQL editor first.');
            return;
        }
        
        console.log('✅ Hotels table is accessible');
        
        // Add test hotels if none exist
        if (!existingHotels || existingHotels.length === 0) {
            console.log('🏨 Adding test hotels...');
            
            const testHotels = [
                {
                    city_id: cityId,
                    name: 'Sheraton Addis',
                    price_per_night: 15000,
                    rating: 5,
                    description: {
                        en: 'Luxury hotel in the heart of Addis Ababa',
                        am: 'በአዲስ አበባ ልብ ውስጥ የሚገኝ የቅንጦት ሆቴል',
                        so: 'Hotel raaxo ah oo ku yaal xarunta Addis Ababa',
                        or: 'Hotela mi\'aawaa Finfinnee keessatti argamu',
                        ti: 'ኣብ ልቢ አዲስ አበባ ዝርከብ ናይ ቅንጦት ሆቴል'
                    },
                    images: ['https://example.com/sheraton1.jpg'],
                    coordinates: { latitude: 9.0054, longitude: 38.7636 },
                    amenities: ['WiFi', 'Pool', 'Spa', 'Restaurant']
                },
                {
                    city_id: cityId,
                    name: 'Radisson Blu Hotel',
                    price_per_night: 12000,
                    rating: 4,
                    description: {
                        en: 'Modern business hotel with excellent facilities',
                        am: 'ዘመናዊ የንግድ ሆቴል ከጥሩ መገልገያዎች ጋር',
                        so: 'Hotel casri ah oo leh agabyo fiican',
                        or: 'Hotela daldalaa ammayyaa tajaajila gaarii qabu',
                        ti: 'ዘመናዊ ናይ ንግዲ ሆቴል ብጽቡቕ ኣገልግሎት'
                    },
                    images: ['https://example.com/radisson1.jpg'],
                    coordinates: { latitude: 9.0154, longitude: 38.7736 },
                    amenities: ['WiFi', 'Gym', 'Restaurant', 'Conference Room']
                },
                {
                    city_id: cityId,
                    name: 'Capital Hotel',
                    price_per_night: 8000,
                    rating: 3,
                    description: {
                        en: 'Comfortable mid-range hotel with good service',
                        am: 'ምቹ የመካከለኛ ደረጃ ሆቴል ከጥሩ አገልግሎት ጋር',
                        so: 'Hotel ku habboon oo adeeg fiican leh',
                        or: 'Hotela giddu galeessaa mijataa tajaajila gaarii qabu',
                        ti: 'ምቹእ ማእከላይ ደረጃ ሆቴል ብጽቡቕ ኣገልግሎት'
                    },
                    images: ['https://example.com/capital1.jpg'],
                    coordinates: { latitude: 9.0254, longitude: 38.7836 },
                    amenities: ['WiFi', 'Restaurant', 'Parking']
                }
            ];
            
            const { data: insertedHotels, error: insertError } = await supabase
                .from('hotels')
                .insert(testHotels)
                .select();
            
            if (insertError) {
                console.log('❌ Failed to insert hotels:', insertError);
                return;
            }
            
            console.log(`✅ Added ${insertedHotels.length} test hotels`);
        } else {
            console.log('✅ Hotels already exist in database');
        }
        
        // Test payment methods
        console.log('💳 Testing payment methods...');
        const { data: paymentMethods, error: paymentError } = await supabase
            .from('payment_methods')
            .select('*')
            .limit(3);
        
        if (paymentError) {
            console.log('❌ Payment methods error:', paymentError);
        } else {
            console.log(`✅ Found ${paymentMethods.length} payment methods`);
        }
        
        console.log('🎉 Test data population completed!');
        
    } catch (error) {
        console.error('❌ Error populating test data:', error);
    }
}

populateTestData();