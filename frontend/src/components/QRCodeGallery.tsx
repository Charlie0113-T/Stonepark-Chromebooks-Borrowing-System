import React, { useMemo, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Resource } from '../types';

interface Props {
  resources: Resource[];
}

export default function QRCodeGallery({ resources }: Props) {
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

  const cabinets = useMemo(() => {
    return resources
      .filter((r) => r.type === 'cabinet')
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [resources]);

  const handleDownloadAll = () => {
    cabinets.forEach((cabinet) => {
      const canvas = canvasRefs.current[cabinet.id];
      if (!canvas) return;
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${cabinet.name.replace(/\s+/g, '-')}-qr.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Cabinet QR Codes</h2>
          <p className="text-sm text-gray-500">Each cabinet has a stable QR code for printing.</p>
        </div>
        <span className="text-xs text-gray-500">{cabinets.length} cabinets</span>
      </div>

      {cabinets.length === 0 ? (
        <p className="text-sm text-gray-500">No cabinet resources found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cabinets.map((cabinet) => (
            <div
              key={cabinet.id}
              className="rounded border bg-white p-4 flex flex-col items-center gap-3"
              style={{ borderColor: '#333333' }}
            >
              <div className="text-center">
                <div className="text-sm font-semibold text-gray-900">{cabinet.name}</div>
                <div className="text-xs text-gray-500">{cabinet.classRoom}</div>
              </div>
              <QRCodeCanvas
                value={`resource:${cabinet.id}`}
                size={180}
                bgColor="#ffffff"
                fgColor="#333333"
                level="H"
                includeMargin
                ref={(el) => {
                  canvasRefs.current[cabinet.id] = el;
                }}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleDownloadAll}
          className="px-4 py-2 rounded text-sm font-medium"
          style={{ backgroundColor: '#333333', color: '#fff' }}
        >
          Print
        </button>
      </div>
    </div>
  );
}
