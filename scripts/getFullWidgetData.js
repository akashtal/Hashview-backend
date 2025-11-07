/**
 * Get Full Widget Data from Common Ninja
 */

require('dotenv').config();
const axios = require('axios');

async function getWidget() {
  try {
    const widgetId = '5d3c8b16-7f0a-40c7-b263-c5477fb4e17c';
    const apiKey = process.env.COMMON_NINJA_API_KEY;

    console.log('\n🔍 Fetching Full Widget Data\n');
    
    const response = await axios.get(
      `https://api.commoninja.com/platform/api/v1/widgets/${widgetId}`,
      {
        headers: {
          'CN-API-Token': apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('═══════════════════════════════════════════════════');
    console.log('📊 FULL WIDGET DATA:');
    console.log('═══════════════════════════════════════════════════\n');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('\n═══════════════════════════════════════════════════\n');

    process.exit(0);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

getWidget();

