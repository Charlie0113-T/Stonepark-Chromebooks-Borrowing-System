import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Resource } from '../types';
import { StatusBadge } from './StatusBadge';

interface ResourceCardProps {
  resource: Resource;
  onBook: (resource: Resource) => void;
  onViewBookings: (resource: Resource) => void;
}

const ResourceCard: React.FC<ResourceCardProps> = ({ resource, onBook, onViewBookings }) => {
  const isAvailable = resource.status !== 'full';
  const utilisationPct =
    resource.totalQuantity > 0
      ? Math.round((resource.currentBooked / resource.totalQuantity) * 100)
      : 0;

  const gradeMatch = resource.name.match(/^G([7-9])\b/i);
  const isGradeCabinet = resource.type === 'cabinet' && !!gradeMatch;
  const qrValue = isGradeCabinet
    ? JSON.stringify({
        resourceId: resource.id,
        resourceName: resource.name,
        classRoom: resource.classRoom,
        type: resource.type,
      })
    : '';

  const barColor =
    resource.status === 'available'
      ? '#28a745'
      : resource.status === 'partial'
      ? '#ffc107'
      : '#dc3545';

  return (
    <div
      className="bg-white rounded-lg border p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow"
      style={{ borderColor: '#333333' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-base text-gray-900">{resource.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{resource.classRoom}</p>
        </div>
        <StatusBadge status={resource.status} />
      </div>

      {/* Type pill */}
      <div className="flex items-center gap-2">
        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium capitalize">
          {resource.type === 'cabinet' ? '⚡ Cabinet' : '💻 Single'}
        </span>
        {resource.description && (
          <span className="text-xs text-gray-500 truncate">{resource.description}</span>
        )}
      </div>

      {isGradeCabinet && (
        <div className="flex items-center gap-3 rounded border p-2" style={{ borderColor: '#e0e0e0' }}>
          <div className="shrink-0">
            <QRCodeSVG
              value={qrValue}
              size={88}
              bgColor="#ffffff"
              fgColor="#333333"
              level="H"
              includeMargin
            />
          </div>
          <div className="text-xs text-gray-600">
            <div className="font-medium text-gray-900">G{gradeMatch?.[1]} Cabinet QR</div>
            <div>Scan to open this charging bay.</div>
          </div>
        </div>
      )}

      {/* Overdue indicator */}
      {resource.overdueBookings > 0 && (
        <div className="text-xs font-medium px-2 py-0.5 rounded" style={{ backgroundColor: '#f8d7da', color: '#dc3545' }}>
          ⏰ {resource.overdueBookings} overdue
        </div>
      )}

      {/* Utilisation bar */}
      {resource.type === 'cabinet' && (
        <div>
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>
              {resource.currentBooked}/{resource.totalQuantity} in use
            </span>
            <span>{utilisationPct}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all"
              style={{ width: `${utilisationPct}%`, backgroundColor: barColor }}
            />
          </div>
        </div>
      )}

      {resource.type === 'single' && (
        <p className="text-sm text-gray-700">
          {resource.status === 'available' ? '✅ Free to borrow' : '🚫 Currently borrowed'}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-1">
        <button
          onClick={() => onBook(resource)}
          disabled={!isAvailable}
          className="flex-1 py-1.5 text-sm font-medium rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            borderColor: '#333333',
            backgroundColor: isAvailable ? '#333333' : 'transparent',
            color: isAvailable ? '#ffffff' : '#333333',
          }}
        >
          Book
        </button>
        <button
          onClick={() => onViewBookings(resource)}
          className="flex-1 py-1.5 text-sm font-medium rounded border transition-colors hover:bg-gray-100"
          style={{ borderColor: '#333333', color: '#333333' }}
        >
          History
        </button>
      </div>
    </div>
  );
};

export default ResourceCard;
