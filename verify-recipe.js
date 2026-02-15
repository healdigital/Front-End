const fs = require('fs');
const path = require('path');

// Read the recipe HTML
const htmlFile = path.join('dist', 'wprm-salade-de-chou-kale-edamame-et-avocat', 'index.html');
const html = fs.readFileSync(htmlFile, 'utf8');

console.log('=== RECIPE PAGE VERIFICATION ===\n');

// 1. Check for description
const descMatch = html.match(/<p class=['"]?recipe-intro['"]?([\s\S]*?)<\/p>/);
if(descMatch) {
  const desc = descMatch[1].replace(/<[^>]*>/g, '').trim();
  console.log('✓ Description found: ' + desc.length + ' chars');
  console.log('  First 100 chars: ' + desc.substring(0, 100) + '...');
  console.log('  Last 50 chars: ...' + desc.substring(-50));
} else {
  console.log('✗ Description NOT found');
}

// 2. Check for keywords/tags
const tagsMatch = html.match(/Tags[\s\S]{1,500}<\/div>/i);
if(tagsMatch && tagsMatch[0].includes('Avocat')) {
  console.log('✓ Keywords/Tags found');
} else {
  console.log('✗ Keywords NOT found');
}

// 3. Check for timing info
const timingMatch = html.match(/Prep.*?Cook.*?Total/is);
if(timingMatch) {
  console.log('✓ Timing info found (Prep, Cook, Total)');
} else {
  console.log('✗ Timing NOT found');
}

// 4. Check for nutrition section
const nutritionMatch = html.match(/Nutrition|Nutrition Facts/i);
if(nutritionMatch) {
  console.log('✓ Nutrition section found');
} else {
  console.log('✗ Nutrition section NOT found (expected - no data in CSV)');
}

// 5. Check for sauce in ingredients
const sauceMatch = html.match(/Sauce/i);
if(sauceMatch) {
  console.log('✓ Sauce section found in ingredients');
} else {
  console.log('✗ Sauce NOT found');
}
