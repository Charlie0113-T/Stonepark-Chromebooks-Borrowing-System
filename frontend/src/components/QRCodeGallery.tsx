import React, { useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download, Info, MapPin } from "lucide-react";
import { Resource } from "../types";

interface Props {
  resources: Resource[];
}

/** Build the absolute scan URL for a resource. */
function buildReturnUrl(resourceId: string): string {
  const base = window.location.origin;
  return `${base}/scan/${encodeURIComponent(resourceId)}`;
}

export default function QRCodeGallery({ resources }: Props) {
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const [downloading, setDownloading] = useState(false);

  const cabinets = useMemo(() => {
    return resources
      .filter((r) => r.type === "cabinet")
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [resources]);

  const triggerDownload = (canvas: HTMLCanvasElement, fileName: string) => {
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleDownloadSingle = (cabinet: Resource) => {
    const canvas = canvasRefs.current[cabinet.id];
    if (!canvas) return;
    triggerDownload(canvas, `${cabinet.name.replace(/\s+/g, "-")}-qr.png`);
  };

  const handleDownloadAll = () => {
    if (downloading) return;
    setDownloading(true);

    cabinets.forEach((cabinet, index) => {
      setTimeout(() => {
        const canvas = canvasRefs.current[cabinet.id];
        if (canvas) {
          triggerDownload(
            canvas,
            `${cabinet.name.replace(/\s+/g, "-")}-qr.png`,
          );
        }

        // Clear downloading state after the last one fires
        if (index === cabinets.length - 1) {
          setTimeout(() => setDownloading(false), 500);
        }
      }, index * 300);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-purple-800 sp-rule-gold inline-block pb-1">
            Cabinet QR Codes
          </h2>
          <p className="text-sm text-ink-500 mt-1">
            Scan to return borrowed Chromebooks. Uses the internal ID — renaming
            won't break the QR code.
          </p>
        </div>
        <span className="text-xs font-mono text-ink-500">
          {cabinets.length} cabinets
        </span>
      </div>

      {cabinets.length === 0 ? (
        <p className="text-sm text-ink-500">No cabinet resources found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cabinets.map((cabinet) => (
            <div
              key={cabinet.id}
              className="sp-card p-4 flex flex-col items-center gap-3 hover:shadow-md hover:-translate-y-0.5 transition"
            >
              <div className="text-center">
                <div className="text-sm font-bold text-purple-800">
                  {cabinet.name}
                </div>
                <div className="text-xs font-mono text-ink-500 inline-flex items-center gap-1">
                  <MapPin
                    size={14}
                    strokeWidth={2}
                    aria-hidden="true"
                    className="text-ink-400 shrink-0"
                  />
                  {cabinet.classRoom}
                </div>
              </div>
              <QRCodeCanvas
                value={buildReturnUrl(cabinet.id)}
                size={180}
                bgColor="#ffffff"
                fgColor="#140A38"
                level="H"
                includeMargin
                ref={(el) => {
                  canvasRefs.current[cabinet.id] = el;
                }}
              />
              <p
                className="text-[10px] font-mono text-ink-400 text-center break-all leading-tight px-1"
                style={{ maxWidth: 180 }}
              >
                {buildReturnUrl(cabinet.id)}
              </p>
              <button
                onClick={() => handleDownloadSingle(cabinet)}
                className="sp-btn-secondary sp-btn-sm inline-flex items-center gap-1.5"
              >
                <Download size={14} strokeWidth={2} aria-hidden="true" />
                Download QR
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-ink-500 inline-flex items-start gap-1.5">
        <Info
          size={14}
          strokeWidth={2}
          aria-hidden="true"
          className="shrink-0 mt-0.5 text-ink-400"
        />
        QR codes link to the mobile-friendly return page. Staff sign in once
        and stay signed in for 30 days.
      </p>

      <div className="flex justify-end">
        <button
          onClick={handleDownloadAll}
          disabled={downloading}
          className="sp-btn-primary inline-flex items-center gap-2"
        >
          {downloading ? (
            <svg
              className="animate-spin h-4 w-4 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <Download size={20} strokeWidth={2} aria-hidden="true" />
          )}
          {downloading ? "Downloading…" : "Download All QR Codes"}
        </button>
      </div>
    </div>
  );
}
