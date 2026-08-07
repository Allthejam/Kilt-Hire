const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

function getSvgContent(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="100%" height="100%" fill="#0f172a" rx="${size * 0.2}"/>
  <path d="M0 ${size * 0.3} H${size} M0 ${size * 0.7} H${size}" stroke="#1e293b" stroke-width="${size * 0.08}"/>
  <path d="M${size * 0.3} 0 V${size} M${size * 0.7} 0 V${size}" stroke="#1e293b" stroke-width="${size * 0.08}"/>
  <path d="M0 ${size * 0.5} H${size}" stroke="#dc2626" stroke-width="${size * 0.04}"/>
  <path d="M${size * 0.5} 0 V${size}" stroke="#dc2626" stroke-width="${size * 0.04}"/>
  <g transform="translate(${size * 0.2}, ${size * 0.2}) scale(${size / 500})">
    <rect x="100" y="100" width="300" height="300" rx="40" fill="#1e293b" stroke="#e2e8f0" stroke-width="16"/>
    <rect x="130" y="130" width="80" height="80" fill="#d97706"/>
    <rect x="150" y="150" width="40" height="40" fill="#0f172a"/>
    <rect x="290" y="130" width="80" height="80" fill="#d97706"/>
    <rect x="310" y="150" width="40" height="40" fill="#0f172a"/>
    <rect x="130" y="290" width="80" height="80" fill="#d97706"/>
    <rect x="150" y="310" width="40" height="40" fill="#0f172a"/>
    <path d="M250 200 L270 240 L310 245 L280 275 L287 315 L250 295 L213 315 L220 275 L190 245 L230 240 Z" fill="#fbbf24"/>
  </g>
</svg>`;
}

async function buildIcons() {
  const svg512 = Buffer.from(getSvgContent(512));
  
  await sharp(svg512).resize(192, 192).png().toFile(path.join(iconsDir, 'icon-192.png'));
  await sharp(svg512).resize(512, 512).png().toFile(path.join(iconsDir, 'icon-512.png'));
  await sharp(svg512).resize(180, 180).png().toFile(path.join(iconsDir, 'apple-touch-icon.png'));
  await sharp(svg512).resize(32, 32).toFile(path.join(__dirname, '..', 'public', 'favicon.ico'));

  console.log('PNG & ICO PWA icons rendered successfully!');
}

buildIcons().catch(console.error);
