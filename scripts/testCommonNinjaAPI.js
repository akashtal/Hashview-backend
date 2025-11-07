/**
 * Test Common Ninja API Directly
 * Shows exact response from Common Ninja
 */

require('dotenv').config();
const axios = require('axios');

async function testAPI() {
  try {
    const widgetId = process.argv[2] || '5d3c8b16-7f0a-40c7-b263-c5477fb4e17c';

    console.log('\n🧪 Testing Common Ninja API\n');
    console.log('═══════════════════════════════════════════════════\n');
    console.log(`Widget ID: ${widgetId}`);
    console.log(`API Key: ${process.env.COMMON_NINJA_API_KEY ? '✅ Configured' : '❌ Missing'}\n`);

    const apiUrl = `https://api.commoninja.com/platform/api/v1/widgets/${widgetId}/data`;
    
    console.log(`📡 Calling: GET ${apiUrl}\n`);

    const response = await axios.get(apiUrl, {
      headers: {
        'CN-API-Token': process.env.COMMON_NINJA_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    console.log('✅ API Response Received!\n');
    console.log('═══════════════════════════════════════════════════');
    console.log('📊 FULL RESPONSE DATA:');
    console.log('═══════════════════════════════════════════════════\n');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('\n═══════════════════════════════════════════════════');
    console.log('🔍 Key Fields Extracted:');
    console.log('═══════════════════════════════════════════════════\n');

    // Try to extract rating and count from various possible structures
    const data = response.data;
    
    console.log('Top-level fields:');
    console.log(`  - averageRating: ${data.averageRating}`);
    console.log(`  - rating: ${data.rating}`);
    console.log(`  - reviewCount: ${data.reviewCount}`);
    console.log(`  - totalReviews: ${data.totalReviews}`);
    
    if (data.data) {
      console.log('\ndata.data fields:');
      console.log(`  - averageRating: ${data.data.averageRating}`);
      console.log(`  - rating: ${data.data.rating}`);
      console.log(`  - reviewCount: ${data.data.reviewCount}`);
      console.log(`  - totalReviews: ${data.data.totalReviews}`);
    }

    if (data.settings) {
      console.log('\ndata.settings fields:');
      console.log(`  - averageRating: ${data.settings.averageRating}`);
      console.log(`  - rating: ${data.settings.rating}`);
      console.log(`  - reviewCount: ${data.settings.reviewCount}`);
    }

    console.log('\n═══════════════════════════════════════════════════\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ API Error:\n');
    console.error(`Status: ${error.response?.status}`);
    console.error(`Message: ${error.message}`);
    
    if (error.response?.data) {
      console.error('\nError Response:');
      console.error(JSON.stringify(error.response.data, null, 2));
    }
    
    console.log('\n');
    process.exit(1);
  }
}

console.log('Usage: node scripts/testCommonNinjaAPI.js [widgetId]');
console.log('If widgetId not provided, uses: 5d3c8b16-7f0a-40c7-b263-c5477fb4e17c\n');

testAPI();

