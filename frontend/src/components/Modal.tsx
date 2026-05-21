import React, { useEffect, useRef } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ title, onClose, children }) => {
  const titleId = `modal-title-${title.replace(/\s+/g, "-").toLowerCase()}`;
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Dialog — full-width slide-up on mobile, centered card on sm+ */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-lg shadow-xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto focus:outline-none"
        style={{ border: "2px solid #333333", paddingBottom: "env(safe-area-inset-bottom)" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {/* Drag handle (mobile only) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-300" aria-hidden="true" />
        </div>
        <div
          className="flex items-center justify-between px-5 py-3 sm:py-4"
          style={{ borderBottom: "1px solid #333333" }}
        >
          <h2 id={titleId} className="text-base sm:text-lg font-semibold text-gray-900">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none p-1 -mr-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
