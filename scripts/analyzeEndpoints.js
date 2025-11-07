/**
 * Script to analyze all backend endpoints and check for issues
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 ANALYZING BACKEND ENDPOINTS...\n');

const routesDir = path.join(__dirname, '../routes');
const controllersDir = path.join(__dirname, '../controllers');

// Read all route files
const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.routes.js'));

console.log(`📁 Found ${routeFiles.length} route files:\n`);

const allEndpoints = [];

routeFiles.forEach(file => {
  const content = fs.readFileSync(path.join(routesDir, file), 'utf-8');
  const lines = content.split('\n');
  
  const endpoints = lines
    .filter(line => line.match(/router\.(get|post|put|delete|patch)\(/))
    .map(line => {
      const match = line.match(/router\.(get|post|put|delete|patch)\('([^']+)'/);
      if (match) {
        return {
          method: match[1].toUpperCase(),
          path: match[2],
          file: file.replace('.routes.js', '')
        };
      }
      return null;
    })
    .filter(Boolean);
  
  console.log(`\n📌 ${file}:`);
  endpoints.forEach(ep => {
    console.log(`   ${ep.method.padEnd(7)} /api/${ep.file}${ep.path}`);
    allEndpoints.push({...ep, fullPath: `/api/${ep.file}${ep.path}`});
  });
});

console.log(`\n\n✅ TOTAL ENDPOINTS: ${allEndpoints.length}\n`);

// Check for duplicate routes
console.log('\n🔍 CHECKING FOR DUPLICATES...\n');
const pathMap = {};
allEndpoints.forEach(ep => {
  const key = `${ep.method} ${ep.fullPath}`;
  if (pathMap[key]) {
    console.log(`⚠️  DUPLICATE: ${key}`);
  } else {
    pathMap[key] = true;
  }
});

console.log('\n✅ ANALYSIS COMPLETE!\n');

