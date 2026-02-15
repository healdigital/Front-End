const fs = require('fs');

const files = ['src/data/articles_en.json', 'src/data/articles_fr.json'];

files.forEach(file => {
  try {
    const buffer = fs.readFileSync(file);
    const text = buffer.toString('utf8');
    
    // Fix corrupted UTF-8 patterns
    let fixed = text
      .replace(/ï¿½/g, '')
      .replace(/â€™/g, "'")
      .replace(/â€œ/g, '"')
      .replace(/â€\u009d/g, '"')
      .replace(/â€"/g, '"')
      .replace(/Mï¿½langez/g, 'Mélangez')
      .replace(/ï¿½uf/g, 'œuf')
      .replace(/spï¿½culos/g, 'spéculos')
      .replace(/crï¿½me/g, 'crème')
      .replace(/pï¿½te/g, 'pâte')
      .replace(/dï¿½lice/g, 'délice')
      .replace(/irrï¿½sistible/g, 'irrésistible')
      .replace(/gï¿½teau/g, 'gâteau')
      .replace(/Prï¿½parez/g, 'Préparez')
      .replace(/Commencez/g, 'Commencez')
      .replace(/Rï¿½publique/g, 'République')
      .replace(/170ï¿½C/g, '170°C')
      .replace(/Cuisson :ï¿½/g, 'Cuisson :');
    
    fs.writeFileSync(file, fixed, 'utf8');
    console.log('✓ Fixed: ' + file);
  } catch (e) {
    console.log('✗ Error with ' + file + ': ' + e.message);
  }
});
