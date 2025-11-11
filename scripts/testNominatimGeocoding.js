/**
 * Test Nominatim Geocoding for Indulge Address
 * 
 * Check what coordinates Nominatim returns for the actual address
 */

const fetch = require('node-fetch');

async function testGeocoding() {
  try {
    console.log('🧪 TESTING NOMINATIM GEOCODING\n');
    console.log('='.repeat(80));
    
    const addresses = [
      'Rolling Mill, Lokhra Rd, above KFC, Ganapati Nagar, Lal Ganesh, Guwahati, Assam 781018',
      'Indulge, Lal Ganesh, Guwahati',
      'KFC Lal Ganesh Guwahati',
      'House No.7 Dhopolia, Ujjal Path, near Chhat Puja Ghat, Jyotikuchi, Guwahati, Assam 781040',
      'J D CONSULTANCY Jyotikuchi Guwahati'
    ];

    for (const address of addresses) {
      console.log(`\n📍 Testing: "${address}"`);
      console.log('-'.repeat(80));
      
      const encodedAddress = encodeURIComponent(address);
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=3&addressdetails=1`;
      
      console.log(`Request: ${url}\n`);
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HashView/1.0'
        }
      });
      
      const data = await response.json();
      
      if (data.length === 0) {
        console.log('❌ No results found!');
        continue;
      }
      
      console.log(`✅ Found ${data.length} results:\n`);
      
      data.forEach((result, index) => {
        console.log(`Result ${index + 1}:`);
        console.log(`   Display Name: ${result.display_name}`);
        console.log(`   Coordinates: [${result.lon}, ${result.lat}]`);
        console.log(`   Longitude: ${result.lon}`);
        console.log(`   Latitude: ${result.lat}`);
        console.log(`   📍 Google Maps: https://maps.google.com/?q=${result.lat},${result.lon}`);
        console.log(`   Type: ${result.type}`);
        console.log(`   Class: ${result.class}`);
        console.log('');
      });
      
      // Wait 1 second between requests (Nominatim rate limit)
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('='.repeat(80));
    console.log('\n✅ Test complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testGeocoding();

