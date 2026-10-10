// Extract the user-supplied visual assets without changing their appearance.
const sharp = require('sharp');
const fs = require('node:fs');
const path = require('node:path');
const source = process.argv[2];
if (!source) throw new Error('Pass the supplied dashboard reference image.');
const out = path.join(__dirname, '../public/assets/dashboard');
fs.mkdirSync(out, { recursive: true });
const crops = {
  'training': [219, 210, 305, 324],
  'workout-1': [241, 661, 126, 66],
  'workout-2': [241, 738, 126, 66],
  'workout-3': [241, 814, 126, 68],
  'meal-1': [866, 661, 116, 66],
  'meal-2': [866, 738, 116, 66],
  'meal-3': [866, 814, 116, 68]
};
Promise.all(Object.entries(crops).map(([name, [left, top, width, height]]) =>
  sharp(source).extract({left, top, width, height}).webp({quality: 95}).toFile(path.join(out, name + '.webp'))
)).then(() => console.log('Extracted seven reference images.'));
