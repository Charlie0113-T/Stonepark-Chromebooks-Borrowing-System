import React, { useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Resource } from "../types";
import { API_BASE_URL } from "../api";

interface Props {
  resources: Resource[];
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
          <h2 className="text-lg font-semibold text-gray-900">
            Cabinet QR Codes
          </h2>
          <p className="text-sm text-gray-500">
            Scan to return borrowed Chromebooks. Uses the internal ID — renaming
            won't break the QR code.
          </p>
        </div>
        <span className="text-xs text-gray-500">
          {cabinets.length} cabinets
        </span>
      </div>

      {cabinets.length === 0 ? (
        <p className="text-sm text-gray-500">No cabinet resources found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cabinets.map((cabinet) => (
            <div
              key={cabinet.id}
              className="rounded border bg-white p-4 flex flex-col items-center gap-3"
              style={{ borderColor: "#333333" }}
            >
              <div className="text-center">
                <div className="text-sm font-semibold text-gray-900">
                  {cabinet.name}
                </div>
                <div className="text-xs text-gray-500">{cabinet.classRoom}</div>
              </div>
              <QRCodeCanvas
                value={`${API_BASE_URL}/api/resources/${cabinet.id}/return-via-qr`}
                size={180}
                bgColor="#ffffff"
                fgColor="#333333"
                level="H"
                includeMargin
                ref={(el) => {
                  canvasRefs.current[cabinet.id] = el;
                }}
              />
              <button
                onClick={() => handleDownloadSingle(cabinet)}
                className="px-3 py-1 rounded text-xs font-medium border transition-colors hover:bg-gray-100"
                style={{ borderColor: "#333333", color: "#333333" }}
              >
                Download QR
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500">
        ℹ️ QR codes link to the return page. Admin credentials are required to
        confirm a return.
      </p>

      <div className="flex justify-end">
        <button
          onClick={handleDownloadAll}
          disabled={downloading}
          className="px-4 py-2 rounded text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: "#333333", color: "#fff" }}
        >
          {downloading && (
            <svg
              className="animate-spin h-4 w-4 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
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
          )}
          {downloading ? "Downloading…" : "Download All QR Codes"}
        </button>
      </div>
    </div>
  );
}
