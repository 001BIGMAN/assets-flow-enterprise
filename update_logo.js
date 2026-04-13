const fs = require('fs');
const path = require('path');

const dir = __dirname;
const htmlFiles = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

let totalChanges = 0;

htmlFiles.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let fileChanges = 0;

  const regex = /logo\.jpg/g;
  const matches = content.match(regex);
  if (matches) {
    fileChanges += matches.length;
    content = content.replace(regex, 'logo.png');
  }

  if (fileChanges > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ${file}: ${fileChanges} replacements`);
    totalChanges += fileChanges;
  }
});

console.log(`\nDone! ${totalChanges} total text replacements across ${htmlFiles.length} files.`);
