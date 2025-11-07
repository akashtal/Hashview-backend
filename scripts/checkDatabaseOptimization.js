/**
 * Database Optimization Check Script
 * Analyzes models for proper indexes and optimization
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 CHECKING DATABASE OPTIMIZATION...\n');

const modelsDir = path.join(__dirname, '../models');
const modelFiles = fs.readdirSync(modelsDir).filter(f => f.endsWith('.model.js'));

console.log(`📁 Found ${modelFiles.length} model files:\n`);

const analysis = {
  totalModels: modelFiles.length,
  modelsWithIndexes: 0,
  modelsWithoutIndexes: 0,
  totalIndexes: 0,
  recommendations: []
};

modelFiles.forEach(file => {
  const content = fs.readFileSync(path.join(modelsDir, file), 'utf-8');
  const modelName = file.replace('.model.js', '');
  
  // Check for indexes
  const indexMatches = content.match(/\.index\(/g);
  const indexCount = indexMatches ? indexMatches.length : 0;
  
  // Check for geospatial index
  const hasGeoIndex = content.includes("'2dsphere'");
  
  // Check for unique fields
  const uniqueFields = (content.match(/unique:\s*true/g) || []).length;
  
  console.log(`\n📌 ${modelName}:`);
  console.log(`   Indexes: ${indexCount}`);
  console.log(`   Unique Fields: ${uniqueFields}`);
  console.log(`   Geospatial: ${hasGeoIndex ? 'Yes' : 'No'}`);
  
  if (indexCount > 0) {
    analysis.modelsWithIndexes++;
    analysis.totalIndexes += indexCount;
  } else {
    analysis.modelsWithoutIndexes++;
    analysis.recommendations.push(`⚠️  ${modelName}: No indexes found - consider adding indexes for frequently queried fields`);
  }
  
  // Check for common performance issues
  if (content.includes('type: String') && !content.includes('trim: true')) {
    analysis.recommendations.push(`💡 ${modelName}: Consider adding trim: true to String fields`);
  }
});

console.log('\n\n📊 SUMMARY:');
console.log(`   Total Models: ${analysis.totalModels}`);
console.log(`   Models with Indexes: ${analysis.modelsWithIndexes}`);
console.log(`   Models without Indexes: ${analysis.modelsWithoutIndexes}`);
console.log(`   Total Indexes: ${analysis.totalIndexes}`);

if (analysis.recommendations.length > 0) {
  console.log('\n\n💡 RECOMMENDATIONS:');
  analysis.recommendations.forEach(rec => console.log(`   ${rec}`));
}

console.log('\n\n✅ ANALYSIS COMPLETE!\n');

