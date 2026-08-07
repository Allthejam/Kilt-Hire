const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const artifactPath = `C:\\Users\\Allan\\.gemini\\antigravity\\brain\\8ca03ecf-bfb8-4704-aab9-d0de08a9b187`;
const publicDir = path.join(__dirname, '..', 'public');
const iconsDir = path.join(publicDir, 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const files = fs.readdirSync(artifactPath);

const logoFile = files.find(f => f.startsWith('kilt_hire_logo_') && f.endsWith('.jpg'));
const pwaIconFile = files.find(f => f.startsWith('pwa_app_icon_') && f.endsWith('.jpg'));
const appleIconFile = files.find(f => f.startsWith('apple_app_icon_') && f.endsWith('.jpg'));

async function processIcons() {
  if (logoFile) {
    const src = path.join(artifactPath, logoFile);
    await sharp(src).resize(512, 512).png().toFile(path.join(publicDir, 'logo.png'));
    console.log('Processed logo.png from', logoFile);
  }

  if (pwaIconFile) {
    const src = path.join(artifactPath, pwaIconFile);
    await sharp(src).resize(192, 192).png().toFile(path.join(iconsDir, 'icon-192.png'));
    await sharp(src).resize(512, 512).png().toFile(path.join(iconsDir, 'icon-512.png'));
    await sharp(src).resize(32, 32).toFile(path.join(publicDir, 'favicon.ico'));
    await sharp(src).resize(32, 32).png().toFile(path.join(publicDir, 'favicon.png'));
    console.log('Processed PWA icons & favicon from', pwaIconFile);
  }

  if (appleIconFile) {
    const src = path.join(artifactPath, appleIconFile);
    await sharp(src).resize(180, 180).png().toFile(path.join(iconsDir, 'apple-touch-icon.png'));
    console.log('Processed apple-touch-icon.png from', appleIconFile);
  }
}

processIcons().catch(console.error);
