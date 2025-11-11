/**
 * Test Google Geocoding API for Business Addresses
 */

const fetch = require('node-fetch');

const GOOGLE_API_KEY = 'AIzaSyCgafT4Tw62CuxxN5DwbkqWIK9pVflKEXI';

async function testGoogleGeocoding() {
  console.log('🧪 TESTING GOOGLE GEOCODING API\n');
  console.log('='.repeat(80));
  
  const addresses = [
    'Rolling Mill, Lokhra Rd, above KFC, Lal Ganesh, Guwahati, Assam 781018',
    'Indulge, Lal Ganesh, Guwahati',
    'House No.7 Dhopolia, Jyotikuchi, Guwahati, Assam 781040',
    'J D CONSULTANCY, Jyotikuchi, Guwahati'
  ];

  for (const address of addresses) {
    console.log(`\n📍 Testing: "${address}"`);
    console.log('-'.repeat(80));
    
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&components=country:IN&key=${GOOGLE_API_KEY}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results.length > 0) {
        console.log(`✅ Found ${data.results.length} result(s):\n`);
        
        data.results.forEach((result, index) => {
          const coords = result.geometry.location;
          console.log(`Result ${index + 1}:`);
          console.log(`   Address: ${result.formatted_address}`);
          console.log(`   Coordinates: [${coords.lng}, ${coords.lat}]`);
          console.log(`   Latitude: ${coords.lat}`);
          console.log(`   Longitude: ${coords.lng}`);
          console.log(`   📍 Google Maps: https://maps.google.com/?q=${coords.lat},${coords.lng}`);
          console.log(`   Place ID: ${result.place_id}`);
          console.log(`   Type: ${result.types.join(', ')}`);
          console.log('');
        });
      } else {
        console.log(`❌ Status: ${data.status}`);
        if (data.error_message) {
          console.log(`   Error: ${data.error_message}`);
        }
      }
      
      // Wait 500ms between requests
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Test complete!\n');
}

testGoogleGeocoding();

