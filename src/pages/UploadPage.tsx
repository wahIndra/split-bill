import React, { useState, useRef, useCallback } from 'react';
import { useBill } from '../context/BillContext';
import { runOCR, preprocessImageForOCR } from '../utils/ocr';
import type { OCRProgress } from '../utils/ocr';
import type { Receipt } from '../types';
import { Camera, X, Loader2, CheckCircle, AlertCircle, ImageIcon } from 'lucide-react';

export default function UploadPage() {
  const { dispatch, navigate } = useBill();
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [ocrState, setOcrState] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [ocrProgress, setOcrProgress] = useState<OCRProgress>({ status: '', progress: 0 });
  const [errorMsg, setErrorMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (f: File) => {
    if (!(/image\/(jpeg|jpg|png|webp)|application\/pdf/u).exec(f.type)) {
      setErrorMsg('Format tidak didukung. Gunakan JPG, PNG, atau PDF.');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setErrorMsg('File terlalu besar. Maksimal 10MB.');
      return;
    }
    setErrorMsg('');
    setFile(f);
    // Preview
    const url = URL.createObjectURL(f);
    setPreview(url);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const startOCR = async () => {
    if (!file) return;
    setOcrState('processing');
    setOcrProgress({ status: 'Mempersiapkan gambar...', progress: 0 });
    try {
      const processedUrl = await preprocessImageForOCR(file);
      const parsed = await runOCR(processedUrl, (p) => setOcrProgress(p));
      const receipt: Receipt = {
        merchantName: parsed.merchantName ?? 'Unknown Merchant',
        transactionDate: parsed.transactionDate ?? new Date().toLocaleDateString('id-ID'),
        items: parsed.items ?? [],
        subtotal: parsed.subtotal ?? 0,
        taxAmount: parsed.taxAmount ?? 0,
        serviceAmount: parsed.serviceAmount ?? 0,
        discountAmount: parsed.discountAmount ?? 0,
        roundingAmount: parsed.roundingAmount ?? 0,
        grandTotal: parsed.grandTotal ?? 0,
        currency: 'IDR',
        imageUrl: preview ?? undefined,
      };
      dispatch({ type: 'SET_RECEIPT', payload: receipt });
      setOcrState('done');
      setTimeout(() => navigate('review'), 800);
    } catch (err) {
      console.error(err);
      setOcrState('error');
      setErrorMsg('OCR gagal. Coba foto dengan pencahayaan lebih baik atau input manual.');
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setOcrState('idle');
    setErrorMsg('');
  };

  return (
    <div className="page upload-page">
      <h2 className="page-title">Upload Resi</h2>
      <p className="page-sub">Foto atau upload gambar resi untuk diekstrak otomatis</p>

      {preview ? (
        <div className="preview-container">
          {/* Image preview */}
          <div className="preview-image-wrap">
            <img src={preview} alt="Receipt preview" className="preview-image" />
            {ocrState === 'idle' && (
              <button className="preview-remove" onClick={clearFile}>
                <X size={16} />
              </button>
            )}
          </div>

          {/* OCR States */}
          {ocrState === 'idle' && (
            <div className="preview-actions">
              <p className="preview-filename">{file?.name}</p>
              <button className="btn-primary btn-large" onClick={startOCR}>
                <Loader2 size={18} className="spin" />
                Ekstrak Data Resi
              </button>
              <button className="btn-ghost" onClick={() => {
                dispatch({ type: 'SET_RECEIPT', payload: {
                  merchantName: '', transactionDate: '', items: [],
                  subtotal: 0, taxAmount: 0, serviceAmount: 0,
                  discountAmount: 0, roundingAmount: 0, grandTotal: 0,
                  currency: 'IDR', imageUrl: preview ?? undefined,
                }});
                navigate('review');
              }}>
                Skip OCR, Input Manual
              </button>
            </div>
          )}

          {ocrState === 'processing' && (
            <div className="ocr-progress-wrap">
              <div className="ocr-spinner">
                <Loader2 size={32} className="spin" />
              </div>
              <p className="ocr-status">{ocrProgress.status}</p>
              <div className="ocr-bar-track">
                <div className="ocr-bar-fill" style={{ width: `${ocrProgress.progress * 100}%` }} />
              </div>
              <p className="ocr-pct">{Math.round(ocrProgress.progress * 100)}%</p>
            </div>
          )}

          {ocrState === 'done' && (
            <div className="ocr-done">
              <CheckCircle size={40} className="done-icon" />
              <p>Berhasil! Menuju halaman review...</p>
            </div>
          )}

          {ocrState === 'error' && (
            <div className="ocr-error">
              <AlertCircle size={28} />
              <p>{errorMsg}</p>
              <button className="btn-secondary" onClick={clearFile}>Coba Lagi</button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Drop zone */}
          <button
            type="button"
            className={`dropzone ${dragOver ? 'dropzone--active' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <ImageIcon size={48} className="dropzone-icon" />
            <p className="dropzone-text">Drag &amp; drop gambar resi di sini</p>
            <p className="dropzone-hint">atau klik untuk memilih file</p>
            <span className="dropzone-formats">JPG · PNG · PDF · maks 10MB</span>
          </button>

          <div className="upload-divider"><span>atau</span></div>

          {/* Camera button */}
          <button className="btn-camera" onClick={() => cameraRef.current?.click()}>
            <Camera size={20} />
            Ambil Foto dari Kamera
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            style={{ display: 'none' }}
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </>
      )}

      {errorMsg && ocrState === 'idle' && (
        <div className="error-banner">
          <AlertCircle size={16} />
          {errorMsg}
        </div>
      )}

      <button className="btn-ghost mt-4" onClick={() => navigate('home')}>
        ← Kembali
      </button>
    </div>
  );
}
