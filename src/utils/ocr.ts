import { createWorker, PSM } from 'tesseract.js';
import { parseReceiptText } from './parser';
import type { Receipt } from '../types';

export interface OCRProgress {
  status: string;
  progress: number; // 0-1
}

export async function runOCR(
  imageFile: File | string,
  onProgress?: (p: OCRProgress) => void
): Promise<Partial<Receipt>> {
  const worker = await createWorker('ind+eng', 1, {
    logger: (m) => {
      if (onProgress && m.status === 'recognizing text') {
        onProgress({ status: 'Membaca teks...', progress: m.progress });
      } else if (onProgress && m.status === 'loading tesseract core') {
        onProgress({ status: 'Memuat OCR engine...', progress: m.progress * 0.3 });
      } else if (onProgress && m.status === 'initializing tesseract') {
        onProgress({ status: 'Inisialisasi OCR...', progress: 0.3 + m.progress * 0.2 });
      } else if (onProgress && m.status === 'loading language traineddata') {
        onProgress({ status: 'Memuat data bahasa...', progress: 0.5 + m.progress * 0.2 });
      } else if (onProgress && m.status === 'initializing api') {
        onProgress({ status: 'Menyiapkan API...', progress: 0.7 + m.progress * 0.1 });
      }
    },
  });

  try {
    // Single-column PSM is ideal for receipts (one column of variable-size text)
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN });
    onProgress?.({ status: 'Memproses gambar...', progress: 0.8 });
    const { data } = await worker.recognize(imageFile);
    onProgress?.({ status: 'Parsing hasil OCR...', progress: 0.95 });
    const parsed = parseReceiptText(data.text);
    onProgress?.({ status: 'Selesai!', progress: 1 });
    return parsed;
  } finally {
    await worker.terminate();
  }
}

export async function preprocessImageForOCR(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 2500;
        const MIN_DIM = 1400; // scale up low-res receipts for better OCR
        let w = img.width;
        let h = img.height;

        // Scale down very large images
        if (w > MAX_DIM || h > MAX_DIM) {
          if (w > h) { h = Math.round((h / w) * MAX_DIM); w = MAX_DIM; }
          else { w = Math.round((w / h) * MAX_DIM); h = MAX_DIM; }
        }
        // Scale up small images so Tesseract has more pixels to work with
        if (w < MIN_DIM && h < MIN_DIM) {
          const scale = MIN_DIM / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;

        // Step 1: Grayscale + contrast boost (stronger than before for faded receipts)
        ctx.filter = 'grayscale(100%) contrast(1.7) brightness(1.05)';
        ctx.drawImage(img, 0, 0, w, h);

        // Step 2: Unsharp-mask sharpening via pixel manipulation
        const imgData = ctx.getImageData(0, 0, w, h);
        sharpenImageData(imgData, w, h);
        ctx.putImageData(imgData, 0, 0);

        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Simple 3×3 sharpen convolution kernel applied in-place. */
function sharpenImageData(imgData: ImageData, w: number, h: number): void {
  const src = new Uint8ClampedArray(imgData.data); // copy original
  const dst = imgData.data;
  // Sharpen kernel: center=5, neighbours=-1
  const k = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        let v = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            v += src[((y + ky) * w + (x + kx)) * 4 + c] * k[(ky + 1) * 3 + (kx + 1)];
          }
        }
        dst[idx + c] = Math.min(255, Math.max(0, v));
      }
    }
  }
}
