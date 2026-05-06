import { createWorker, PSM } from 'tesseract.js';
import { parseReceiptText } from './parser';
import type { Receipt } from '../types';

export interface OCRProgress {
  status: string;
  progress: number; // 0-1
}

// True when a Gemini API key is configured via env
export const isGeminiConfigured =
  !!import.meta.env.VITE_GEMINI_API_KEY &&
  !import.meta.env.VITE_GEMINI_API_KEY.startsWith('your_');

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

// ─── Gemini OCR ───────────────────────────────────────────────────
/**
 * Send the receipt image to Gemini 2.0 Flash with a structured prompt
 * and parse the JSON it returns directly into a Partial<Receipt>.
 */
export async function runGeminiOCR(
  file: File,
  onProgress?: (p: OCRProgress) => void
): Promise<Partial<Receipt>> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string;
  if (!apiKey || apiKey.startsWith('your_')) {
    throw new Error('Gemini API key not configured.');
  }

  onProgress?.({ status: 'Mengompresi gambar...', progress: 0.1 });

  // Convert file to base64 (JPEG, compressed for bandwidth)
  const base64 = await fileToBase64Jpeg(file, 1600);

  onProgress?.({ status: 'Mengirim ke Gemini AI...', progress: 0.3 });

  const prompt = `You are a receipt parser. Extract ALL data from this restaurant/cafe receipt image and return ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "merchantName": "string",
  "transactionDate": "string (DD-MM-YYYY or as shown)",
  "items": [
    { "name": "string", "qty": number, "unitPrice": number, "totalPrice": number }
  ],
  "subtotal": number,
  "taxAmount": number,
  "serviceAmount": number,
  "discountAmount": number,
  "grandTotal": number,
  "currency": "IDR"
}
Rules:
- All prices in plain integers (no separators), e.g. 35000 not 35,000
- If a field is not present use 0 or ""
- qty must be a positive integer, unitPrice = totalPrice / qty
- Include every line item on the receipt`;

  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: 'image/jpeg', data: base64 } },
      ],
    }],
    generationConfig: { temperature: 0, maxOutputTokens: 2048 },
  };

  onProgress?.({ status: 'Menunggu respons Gemini...', progress: 0.55 });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );

  onProgress?.({ status: 'Memproses respons Gemini...', progress: 0.8 });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = (err as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Gemini API error: ${detail}`);
  }

  const json = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!raw) throw new Error('Gemini returned an empty response. Check your API key quota.');
  // Strip possible markdown fences
  const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  onProgress?.({ status: 'Parsing hasil Gemini...', progress: 0.95 });

  let parsed: Partial<Receipt>;
  try {
    const obj = JSON.parse(clean) as {
      merchantName?: string;
      transactionDate?: string;
      items?: Array<{ name?: string; qty?: number; unitPrice?: number; totalPrice?: number }>;
      subtotal?: number;
      taxAmount?: number;
      serviceAmount?: number;
      discountAmount?: number;
      grandTotal?: number;
      currency?: string;
    };
    parsed = {
      merchantName: obj.merchantName ?? '',
      transactionDate: obj.transactionDate ?? '',
      items: (obj.items ?? []).map((it, idx) => ({
        id: `item_gemini_${Date.now()}_${idx}`,
        name: it.name ?? '',
        qty: it.qty ?? 1,
        unitPrice: it.unitPrice ?? (it.totalPrice ?? 0),
        totalPrice: it.totalPrice ?? 0,
      })),
      subtotal: obj.subtotal ?? 0,
      taxAmount: obj.taxAmount ?? 0,
      serviceAmount: obj.serviceAmount ?? 0,
      discountAmount: obj.discountAmount ?? 0,
      roundingAmount: 0,
      grandTotal: obj.grandTotal ?? 0,
      currency: obj.currency ?? 'IDR',
    };
  } catch {
    throw new Error('Gemini returned invalid JSON. Try again or use Tesseract.');
  }

  onProgress?.({ status: 'Selesai!', progress: 1 });
  return parsed;
}

/** Resize + compress image to JPEG base64 for Gemini upload. */
function fileToBase64Jpeg(file: File, maxDim: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round((h / w) * maxDim); w = maxDim; }
          else { w = Math.round((w / h) * maxDim); h = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        // Remove the data:image/jpeg;base64, prefix
        resolve(canvas.toDataURL('image/jpeg', 0.92).split(',')[1]);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
