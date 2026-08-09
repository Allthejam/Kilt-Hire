import QRCode from 'qrcode';

/**
 * Generates an ISO/IEC 18004 compliant 2D boolean QR matrix using the standard `qrcode` library.
 * Compatible with all mobile camera scanners (iOS Safari Camera, Google Lens, ZXing, Android Camera).
 */
export function generateQrMatrix(text: string): boolean[][] {
  try {
    const cleanText = text && text.trim() ? text.trim() : 'KILT-0001';
    const qr = QRCode.create(cleanText, { errorCorrectionLevel: 'M' });
    const size = qr.modules.size;
    const data = qr.modules.data;
    const matrix: boolean[][] = [];

    for (let r = 0; r < size; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < size; c++) {
        row.push(data[r * size + c] === 1);
      }
      matrix.push(row);
    }
    return matrix;
  } catch (err) {
    console.error('Failed to generate ISO QR matrix:', err);
    return Array.from({ length: 21 }, () => Array(21).fill(false));
  }
}

/**
 * Renders an SVG path string from a QR matrix with an optional Quiet Zone margin (default 4 modules).
 */
export function renderQrSvgPath(matrix: boolean[][], margin: number = 4): string {
  const size = matrix.length;
  let path = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) {
        path += `M${c + margin},${r + margin}h1v1h-1z `;
      }
    }
  }
  return path;
}

/**
 * Returns the full SVG viewBox size including the Quiet Zone margin (size + margin * 2).
 */
export function getQrViewBoxSize(matrix: boolean[][], margin: number = 4): number {
  return matrix.length + margin * 2;
}
