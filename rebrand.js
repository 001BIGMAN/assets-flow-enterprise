const fs = require('fs');
const path = require('path');

const dir = __dirname;
const htmlFiles = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
const jsFiles = ['main.js', 'dashboard.js'].filter(f => fs.existsSync(path.join(dir, f)));

const allFiles = [...htmlFiles, ...jsFiles];

const replacements = [
  ['ASSETSFLOW CRYPTO EDUCATION SYSTEM', 'QUANTARA ALPHA ENTERPRISE'],
  ['ASSETSFLOW ENTERPRISE', 'QUANTARA ALPHA ENTERPRISE'],
  ['AssetsFlow Enterprise', 'Quantara Alpha Enterprise'],
  ['Assetsflow enterprise', 'Quantara Alpha Enterprise'],
  ['AssetsFlow', 'Quantara Alpha'],
  ['ASSETSFLOW', 'QUANTARA ALPHA'],
  ['assetsflowenterprise', 'quantaraalphaenterprise'],
];

let totalChanges = 0;

allFiles.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let fileChanges = 0;

  replacements.forEach(([from, to]) => {
    const regex = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = content.match(regex);
    if (matches) {
      fileChanges += matches.length;
      content = content.replace(regex, to);
    }
  });

  if (fileChanges > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ${file}: ${fileChanges} replacements`);
    totalChanges += fileChanges;
  }
});

console.log(`\nDone! ${totalChanges} total replacements across ${allFiles.length} files.`);
