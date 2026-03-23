import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { API_BASE_URL } from '../api';
import { Booking } from '../types';

interface Props {
  booking: Booking;
  resourceName: string;
  onClose: () => void;
}

export default function QRCodeModal({ booking, resourceName, onClose }: Props) {
  const qrValue = `${API_BASE_URL}/api/bookings/${booking.id}/return-via-qr`;

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <p className="text-sm text-gray-600 text-center">
        Scan this QR code to return <strong>{resourceName}</strong>
        <br />
        Admin credentials are required to confirm.
      </p>

      <div className="border p-4 rounded bg-white" style={{ borderColor: '#e0e0e0' }}>
        <QRCodeSVG
          value={qrValue}
          size={220}
          bgColor="#ffffff"
          fgColor="#333333"
          level="H"
          includeMargin
        />
      </div>

      <div className="w-full text-xs text-gray-500 space-y-1 border rounded p-3" style={{ borderColor: '#e0e0e0' }}>
        <div className="flex gap-2"><span className="font-medium w-24 shrink-0">Booking ID:</span><span className="font-mono break-all">{booking.id}</span></div>
        <div className="flex gap-2"><span className="font-medium w-24 shrink-0">Borrower:</span><span>{booking.borrower} ({booking.borrowerClass})</span></div>
        <div className="flex gap-2"><span className="font-medium w-24 shrink-0">Resource:</span><span>{resourceName}</span></div>
        <div className="flex gap-2"><span className="font-medium w-24 shrink-0">Status:</span><span className="capitalize">{booking.status}</span></div>
      </div>

      <button
        onClick={onClose}
        className="w-full py-2 rounded text-sm font-medium"
        style={{ backgroundColor: '#333333', color: '#fff' }}
      >
        Close
      </button>
    </div>
  );
}
