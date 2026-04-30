import { createWorker } from 'tesseract.js';
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
        const MAX_DIM = 2000;
        let w = img.width;
        let h = img.height;
        if (w > MAX_DIM || h > MAX_DIM) {
          if (w > h) { h = Math.round((h / w) * MAX_DIM); w = MAX_DIM; }
          else { w = Math.round((w / h) * MAX_DIM); h = MAX_DIM; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        // Grayscale + contrast boost
        ctx.filter = 'grayscale(100%) contrast(1.4) brightness(1.1)';
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
