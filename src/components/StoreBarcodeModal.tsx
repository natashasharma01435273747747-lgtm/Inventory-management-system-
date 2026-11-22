import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  AlertCircle,
  Check,
  ClipboardPaste,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Printer,
  RotateCcw,
  Store,
  X,
} from 'lucide-react';
import { PUBLIC_STORE_URL_KEY } from '../api/client.ts';

interface StoreBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPreviewCustomerPage: () => void;
}

const STORE_CODE_LABEL = 'SMARTSTOCK-STORE-01';

function isLocalhostUrl(urlStr: string): boolean {
  try {
    const host = new URL(urlStr).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
  } catch {
    return false;
  }
}

function getDefaultCustomerUrl(): string {
  if (typeof window === 'undefined') return 'https://example.com/?view=customer';
  try {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('view', 'customer');
    return url.toString();
  } catch {
    return `${window.location.origin}/?view=customer`;
  }
}

/**
 * Resolves any custom public URL pasted by the admin into a valid scannable URL.
 * When `autoAppendCustomerView` is true, automatically appends `?view=customer` so
 * scanning opens the public Customer Product Availability page directly without login.
 */
function resolveQrTargetUrl(
  rawInput: string,
  autoAppendCustomerView: boolean
): {
  url: string;
  valid: boolean;
  isLocalhost: boolean;
} {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { url: '', valid: false, isLocalhost: false };
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { url: trimmed, valid: false, isLocalhost: false };
    }
    if (
      autoAppendCustomerView &&
      (parsed.searchParams.get('view') || '').toLowerCase() !== 'customer'
    ) {
      parsed.searchParams.set('view', 'customer');
    }
    const finalUrl = parsed.toString();
    return {
      url: finalUrl,
      valid: true,
      isLocalhost: isLocalhostUrl(finalUrl),
    };
  } catch {
    return { url: trimmed, valid: false, isLocalhost: false };
  }
}

// Deterministic linear barcode bar-width pattern (unified store counter barcode graphic)
function buildBarcodePattern(code: string): number[] {
  const widths: number[] = [2, 1, 1, 2, 1, 4]; // Start pattern
  for (let i = 0; i < code.length; i++) {
    const ch = code.charCodeAt(i);
    widths.push(
      ((ch >> 0) & 1) ? 2 : 1,
      ((ch >> 1) & 1) ? 2 : 1,
      ((ch >> 2) & 1) ? 3 : 1,
      ((ch >> 3) & 1) ? 2 : 1,
      ((ch >> 4) & 1) ? 1 : 2,
      ((ch >> 5) & 1) ? 2 : 1
    );
  }
  widths.push(2, 3, 1, 1, 1, 2, 2); // Stop pattern
  return widths;
}

export const StoreBarcodeModal: React.FC<StoreBarcodeModalProps> = ({
  isOpen,
  onClose,
  onPreviewCustomerPage,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const defaultUrl = useMemo(() => getDefaultCustomerUrl(), []);
  const [urlInput, setUrlInput] = useState<string>(() => {
    if (typeof window === 'undefined') return defaultUrl;
    try {
      const saved = localStorage.getItem(PUBLIC_STORE_URL_KEY);
      if (saved && saved.trim()) {
        // Ignore stale localhost URL if app is now running on a public domain
        if (isLocalhostUrl(saved.trim()) && !isLocalhostUrl(defaultUrl)) {
          return defaultUrl;
        }
        return saved.trim();
      }
    } catch {
      // Ignore storage access errors
    }
    return defaultUrl;
  });
  const [autoAppendView, setAutoAppendView] = useState<boolean>(true);

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrError, setQrError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const resolved = useMemo(
    () => resolveQrTargetUrl(urlInput, autoAppendView),
    [urlInput, autoAppendView]
  );
  const encodedUrl = resolved.valid ? resolved.url : '';

  const barWidths = useMemo(() => buildBarcodePattern(STORE_CODE_LABEL), []);
  const totalBarUnits = useMemo(
    () => barWidths.reduce((sum, w) => sum + w, 0),
    [barWidths]
  );

  // Persist custom Store Public URL cleanly
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const trimmed = urlInput.trim();
      if (trimmed && trimmed !== defaultUrl) {
        localStorage.setItem(PUBLIC_STORE_URL_KEY, trimmed);
      } else if (trimmed === defaultUrl) {
        localStorage.removeItem(PUBLIC_STORE_URL_KEY);
      }
    } catch {
      // Ignore storage access errors
    }
  }, [urlInput, defaultUrl]);

  // Generate crisp, high-contrast QR Code (level="H", pure #000000 on #FFFFFF, 4-module quiet zone)
  useEffect(() => {
    if (!isOpen) return;
    if (!encodedUrl) {
      setQrDataUrl('');
      setQrError('Paste or enter any valid public URL above to generate a scannable QR code.');
      return;
    }

    let active = true;
    setQrError(null);

    QRCode.toDataURL(encodedUrl, {
      width: 640,
      margin: 4, // ISO-standard 4-module pure white quiet zone
      errorCorrectionLevel: 'H',
      type: 'image/png',
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })
      .then((dataUrl) => {
        if (active) {
          setQrDataUrl(dataUrl);
          setQrError(null);
        }
      })
      .catch(() => {
        if (active) {
          setQrDataUrl('');
          setQrError('Could not generate QR code for this URL. Check the link format.');
        }
      });

    return () => {
      active = false;
    };
  }, [isOpen, encodedUrl]);

  if (!isOpen) return null;

  const handlePasteClick = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setUrlInput(text.trim());
        return;
      }
    } catch {
      // Clipboard permission may be restricted inside iframe; focus input so user can paste directly
    }
    inputRef.current?.focus();
    inputRef.current?.select();
  };

  const handleResetUrl = () => {
    setUrlInput(defaultUrl);
    setAutoAppendView(true);
    try {
      localStorage.removeItem(PUBLIC_STORE_URL_KEY);
    } catch {
      // Ignore storage errors
    }
  };

  const handleCopyLink = async () => {
    if (!encodedUrl) return;
    try {
      await navigator.clipboard.writeText(encodedUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleDownloadPng = async () => {
    if (!qrDataUrl || !encodedUrl) return;
    setDownloading(true);
    try {
      const canvas = document.createElement('canvas');
      const W = 800;
      const H = 1080;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Crisp pure white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 4;
      ctx.strokeRect(24, 24, W - 48, H - 48);

      // Top royal-blue brand accent strip
      ctx.fillStyle = '#0052FF';
      ctx.fillRect(24, 24, W - 48, 12);

      // Store name
      ctx.fillStyle = '#0052FF';
      ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SHREE GANESH GENERAL STORE · SMARTSTOCK AI', W / 2, 100);

      // Headline
      ctx.fillStyle = '#0B1736';
      ctx.font = '700 36px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Scan Once to Check', W / 2, 162);
      ctx.fillText('Available Products', W / 2, 208);

      // Subtitle
      ctx.fillStyle = '#475569';
      ctx.font = '400 18px "DM Sans", sans-serif';
      ctx.fillText(
        'Check live prices & in-stock availability on your phone — no login required',
        W / 2,
        250
      );

      // High-Contrast QR Code Frame with Pure White Quiet Zone
      const qrImg = new Image();
      await new Promise<void>((resolve, reject) => {
        qrImg.onload = () => resolve();
        qrImg.onerror = () => reject(new Error('QR load failed'));
        qrImg.src = qrDataUrl;
      });
      const qrSize = 400;
      const qrX = (W - qrSize) / 2;
      const qrY = 284;

      // Pure white backdrop behind QR for guaranteed camera contrast
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40);
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 2;
      ctx.strokeRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40);

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
      ctx.imageSmoothingEnabled = true;

      // Divider
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(96, 738);
      ctx.lineTo(W - 96, 738);
      ctx.stroke();

      // Unified Store Barcode Graphic
      ctx.fillStyle = '#64748B';
      ctx.font = '600 15px "DM Sans", sans-serif';
      ctx.fillText('UNIFIED STORE COUNTER BARCODE', W / 2, 776);

      const barcodeWidth = 480;
      const barcodeHeight = 96;
      const startX = (W - barcodeWidth) / 2;
      const startY = 796;
      const unitW = barcodeWidth / totalBarUnits;
      let cursorX = startX;
      ctx.fillStyle = '#000000';
      barWidths.forEach((w, idx) => {
        if (idx % 2 === 0) {
          ctx.fillRect(cursorX, startY, Math.max(1, w * unitW), barcodeHeight);
        }
        cursorX += w * unitW;
      });

      ctx.fillStyle = '#0B1736';
      ctx.font = '600 18px "IBM Plex Mono", monospace';
      ctx.fillText(STORE_CODE_LABEL, W / 2, 926);

      // Footer URL
      ctx.fillStyle = '#64748B';
      ctx.font = '400 14px "IBM Plex Mono", monospace';
      const displayUrl =
        encodedUrl.length > 72 ? `${encodedUrl.slice(0, 69)}...` : encodedUrl;
      ctx.fillText(displayUrl, W / 2, 996);

      const link = document.createElement('a');
      link.download = 'smartstock-store-counter-card.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  let svgX = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1736]/55 p-3 sm:p-4 print:static print:bg-white print:p-0"
      role="dialog"
      aria-modal="true"
      aria-label="Store Customer Barcode"
    >
      <div className="bg-white border border-[#DCE6FA] rounded-2xl shadow-2xl w-full max-w-lg max-h-[94vh] flex flex-col overflow-hidden print:border-0 print:shadow-none print:max-h-none print:max-w-none">
        {/* Modal Header (Hidden on print) */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3 print:hidden">
          <div>
            <h2 className="font-display text-base font-bold text-[#0B1736]">
              Store Customer Barcode &amp; QR Card
            </h2>
            <p className="text-xs text-slate-500">
              High-contrast scannable QR code linking directly to live customer product availability.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close barcode card"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 print:p-8 print:overflow-visible">
          {/* Editable Store Public URL Input (Hidden on print) */}
          <div className="rounded-2xl bg-[#F4F8FF] border border-[#D8E5FC] p-3.5 space-y-2.5 print:hidden">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="store-public-url-input"
                className="text-xs font-semibold text-[#0B1736] inline-flex items-center gap-1.5"
              >
                <Globe className="w-3.5 h-3.5 text-[#0052FF]" />
                <span>Store Public URL</span>
              </label>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handlePasteClick}
                  className="text-[11px] font-semibold text-[#0052FF] hover:text-[#003EC2] inline-flex items-center gap-1 cursor-pointer"
                >
                  <ClipboardPaste className="w-3 h-3" />
                  <span>Paste</span>
                </button>
                {urlInput.trim() !== defaultUrl && (
                  <button
                    type="button"
                    onClick={handleResetUrl}
                    className="text-[11px] font-semibold text-slate-600 hover:text-[#0B1736] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}
              </div>
            </div>

            <div className="relative">
              <input
                ref={inputRef}
                id="store-public-url-input"
                type="text"
                inputMode="url"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste any custom public URL (e.g. https://your-store.run.app)"
                className="w-full pl-3 pr-8 py-2.5 text-xs font-mono bg-white border border-[#CBD9F5] rounded-xl text-[#0B1736] placeholder:text-slate-400 focus:outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/15"
              />
              {urlInput && (
                <button
                  type="button"
                  onClick={() => {
                    setUrlInput('');
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear URL"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="inline-flex items-center gap-2 text-[11px] font-medium text-[#334155] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoAppendView}
                  onChange={(e) => setAutoAppendView(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 accent-[#0052FF] cursor-pointer"
                />
                <span>
                  Auto-append <code className="font-mono text-[#0052FF]">?view=customer</code> (no login)
                </span>
              </label>
            </div>

            {resolved.valid && resolved.isLocalhost && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  This link uses localhost. Paste your public shared link above so external phones can scan and open the catalog.
                </span>
              </p>
            )}

            {qrError && (
              <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{qrError}</span>
              </p>
            )}
          </div>

          {/* Printable Store Counter Card */}
          <div className="border border-slate-200 rounded-2xl p-5 sm:p-6 text-center bg-white">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-[#0052FF]">
              <Store className="w-4 h-4" />
              <span>Shree Ganesh General Store · SmartStock AI</span>
            </div>

            <h3 className="mt-2 font-display text-xl sm:text-2xl font-bold text-[#0B1736] leading-tight">
              Scan Once to Check Available Products
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Point your phone camera to check live prices &amp; in-stock items — no login required.
            </p>

            {/* Single 100% Scannable High-Contrast QR Code (Pure Black on Pure White + Quiet Zone) */}
            <div className="mt-5 inline-flex flex-col items-center p-4 rounded-2xl border-2 border-slate-200 bg-[#FFFFFF] shadow-xs">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Store Customer Product Availability QR Code"
                  className="w-56 h-56 sm:w-60 sm:h-60 object-contain bg-[#FFFFFF] [image-rendering:pixelated]"
                />
              ) : (
                <div className="w-56 h-56 sm:w-60 sm:h-60 flex items-center justify-center text-xs text-slate-400 bg-slate-50 rounded-xl px-4">
                  {qrError ? 'Paste a valid public URL above' : 'Generating QR code...'}
                </div>
              )}
              <span className="mt-1.5 text-[10px] font-mono font-medium text-slate-500 tracking-wide">
                ECC Level H · High-Contrast Scan Ready
              </span>
            </div>

            {/* Single Unified Store Barcode Graphic */}
            <div className="mt-5 pt-5 border-t border-slate-200">
              <p className="text-[11px] font-semibold text-slate-500 mb-2">
                Unified Store Counter Barcode
              </p>
              <div className="mx-auto max-w-xs bg-white px-2 py-1">
                <svg
                  viewBox={`0 0 ${totalBarUnits} 42`}
                  className="w-full h-14"
                  role="img"
                  aria-label={`Store Barcode ${STORE_CODE_LABEL}`}
                  preserveAspectRatio="none"
                >
                  {barWidths.map((w, idx) => {
                    const x = svgX;
                    svgX += w;
                    if (idx % 2 !== 0) return null;
                    return (
                      <rect
                        key={idx}
                        x={x}
                        y={0}
                        width={w}
                        height={42}
                        fill="#000000"
                      />
                    );
                  })}
                </svg>
                <p className="mt-1.5 font-mono tabular-nums text-xs font-semibold text-[#0B1736] tracking-wider">
                  {STORE_CODE_LABEL}
                </p>
              </div>
            </div>

            {/* Encoded Direct Link Row */}
            {encodedUrl && (
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] font-mono text-slate-500">
                <span className="truncate max-w-[280px]" title={encodedUrl}>
                  {encodedUrl}
                </span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1 text-[#0052FF] hover:text-[#003EC2] font-sans font-semibold cursor-pointer shrink-0 print:hidden"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions (Hidden on print) */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2.5 print:hidden">
          <button
            type="button"
            onClick={() => {
              onClose();
              onPreviewCustomerPage();
            }}
            className="text-xs font-semibold text-[#0052FF] hover:text-[#003EC2] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Customer Page</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={!qrDataUrl || downloading}
              className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? 'Preparing...' : 'Download PNG'}</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!qrDataUrl}
              className="px-4 py-2 rounded-xl bg-[#0052FF] hover:bg-[#0044D6] text-xs sm:text-sm font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              <span>Print Card</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
