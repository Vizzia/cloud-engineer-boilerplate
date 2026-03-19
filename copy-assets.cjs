// Copy non-TypeScript assets (e.g., Python code) to dist/ after build
// Usage: node copy-assets.cjs

const fs = require('fs');
const path = require('path');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(child => {
      copyRecursiveSync(path.join(src, child), path.join(dest, child));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

const assets = [
  'lib/processing-stack/functions/process-data/code',
];

assets.forEach(asset => {
  const src = path.resolve(__dirname, asset);
  const dest = path.resolve(__dirname, 'dist', asset);
  if (fs.existsSync(src)) {
    copyRecursiveSync(src, dest);
    console.log(`Copied ${src} -> ${dest}`);
  }
});
