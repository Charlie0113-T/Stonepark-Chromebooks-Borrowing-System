import React, { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import {
  AlertTriangle,
  CheckCircle2,
  Laptop,
  MapPin,
  Pencil,
  QrCode,
  Server,
  Trash2,
  X,
} from "lucide-react";
import { Resource } from "../types";
import { StatusBadge } from "./StatusBadge";
import { updateResource } from "../api";

interface ResourceCardProps {
  resource: Resource;
  isAdmin?: boolean;
  onBook: (resource: Resource) => void;
  onViewBookings: (resource: Resource) => void;
  onDelete?: (resource: Resource) => void;
  onResourceUpdated?: () => void;
}

const ResourceCard: React.FC<ResourceCardProps> = ({
  resource,
  isAdmin = false,
  onBook,
  onViewBookings,
  onDelete,
  onResourceUpdated,
}) => {
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState(resource.name);

  const [editingRoom, setEditingRoom] = useState(false);
  const [editRoom, setEditRoom] = useState(resource.classRoom);

  const [editingDescription, setEditingDescription] = useState(false);
  const [editDescription, setEditDescription] = useState(resource.description);

  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDownloadQr = () => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${resource.name.replace(/\s+/g, "-")}-qr.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  /**
   * Must stay identical to QRCodeGallery's URL: a cabinet has exactly one QR
   * code, and both places offer a download under the same filename. They used
   * to differ — one pointed at a server-rendered password form, the other at
   * the stay-signed-in scan page — so which behaviour a cabinet got depended
   * on which screen the sticker was printed from.
   */
  const buildReturnUrl = () =>
    `${window.location.origin}/scan/${encodeURIComponent(resource.id)}`;

  const isAvailable = resource.status !== "full";
  const utilisationPct =
    resource.totalQuantity > 0
      ? Math.round((resource.currentBooked / resource.totalQuantity) * 100)
      : 0;

  const barFillClass =
    resource.status === "available"
      ? "bg-status-success-edge"
      : resource.status === "partial"
        ? "bg-status-warning-edge"
        : "bg-status-alert-edge";

  const refreshAfterSave = () => {
    if (onResourceUpdated) onResourceUpdated();
  };

  const handleSaveName = async () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditError("Name cannot be empty.");
      return;
    }
    if (trimmed === resource.name) {
      setEditingName(false);
      setEditError(null);
      return;
    }

    setSaving(true);
    setEditError(null);
    try {
      await updateResource(resource.id, { name: trimmed });
      setEditingName(false);
      refreshAfterSave();
    } catch (err: any) {
      setEditError(err?.response?.data?.message || "Failed to update name.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelName = () => {
    setEditName(resource.name);
    setEditingName(false);
    setEditError(null);
  };

  const handleSaveRoom = async () => {
    const trimmed = editRoom.trim();
    if (!trimmed) {
      setEditError("Address cannot be empty.");
      return;
    }
    if (trimmed === resource.classRoom) {
      setEditingRoom(false);
      setEditError(null);
      return;
    }

    setSaving(true);
    setEditError(null);
    try {
      await updateResource(resource.id, { classRoom: trimmed });
      setEditingRoom(false);
      refreshAfterSave();
    } catch (err: any) {
      setEditError(err?.response?.data?.message || "Failed to update address.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelRoom = () => {
    setEditRoom(resource.classRoom);
    setEditingRoom(false);
    setEditError(null);
  };

  const handleSaveDescription = async () => {
    const trimmed = editDescription.trim();
    if (trimmed === resource.description) {
      setEditingDescription(false);
      setEditError(null);
      return;
    }

    setSaving(true);
    setEditError(null);
    try {
      await updateResource(resource.id, { description: trimmed });
      setEditingDescription(false);
      refreshAfterSave();
    } catch (err: any) {
      setEditError(
        err?.response?.data?.message || "Failed to update description.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancelDescription = () => {
    setEditDescription(resource.description);
    setEditingDescription(false);
    setEditError(null);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSaveName();
    if (e.key === "Escape") handleCancelName();
  };

  const handleRoomKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSaveRoom();
    if (e.key === "Escape") handleCancelRoom();
  };

  const handleDescriptionKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      handleSaveDescription();
    }
    if (e.key === "Escape") handleCancelDescription();
  };

  return (
    <div className="sp-card-gold p-4 flex flex-col gap-3 hover:shadow-md hover:-translate-y-0.5 transition">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="space-y-1">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={handleNameKeyDown}
                className="sp-input font-semibold"
                autoFocus
                disabled={saving}
              />
              <div className="flex gap-1">
                <button
                  onClick={handleSaveName}
                  disabled={saving}
                  className="sp-btn-primary sp-btn-sm"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={handleCancelName}
                  disabled={saving}
                  className="sp-btn-secondary sp-btn-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="group">
              <div className="flex items-center gap-1">
                <h3 className="font-bold text-base text-purple-800">
                  {resource.name}
                </h3>
                <button
                  onClick={() => {
                    setEditName(resource.name);
                    setEditingName(true);
                    setEditError(null);
                  }}
                  className="edit-affordance text-ink-400 hover:text-purple-700 px-1"
                  title="Edit name"
                >
                  <Pencil size={14} strokeWidth={2} aria-hidden="true" />
                  <span className="sr-only">Edit name</span>
                </button>
              </div>

              <div className="mt-0.5 flex items-center gap-1">
                {editingRoom ? (
                  <div className="space-y-1 w-full">
                    <input
                      type="text"
                      value={editRoom}
                      onChange={(e) => setEditRoom(e.target.value)}
                      onKeyDown={handleRoomKeyDown}
                      className="sp-input text-xs"
                      autoFocus
                      disabled={saving}
                      placeholder="Enter address"
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={handleSaveRoom}
                        disabled={saving}
                        className="sp-btn-primary sp-btn-sm"
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={handleCancelRoom}
                        disabled={saving}
                        className="sp-btn-secondary sp-btn-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-xs font-mono text-ink-500 mt-0.5 inline-flex items-center gap-1">
                      <MapPin
                        size={14}
                        strokeWidth={2}
                        aria-hidden="true"
                        className="text-ink-400 shrink-0"
                      />
                      {resource.classRoom}
                    </p>
                    <button
                      onClick={() => {
                        setEditRoom(resource.classRoom);
                        setEditingRoom(true);
                        setEditError(null);
                      }}
                      className="edit-affordance text-ink-400 hover:text-purple-700 px-1"
                      title="Edit address"
                    >
                      <Pencil size={14} strokeWidth={2} aria-hidden="true" />
                      <span className="sr-only">Edit address</span>
                    </button>
                  </>
                )}
              </div>

              {resource.lastModifiedBy && (
                <p className="text-[10px] text-ink-400 mt-0.5 inline-flex items-center gap-1">
                  <Pencil size={14} strokeWidth={2} aria-hidden="true" />
                  Last edited by {resource.lastModifiedBy}
                </p>
              )}
            </div>
          )}
        </div>

        <StatusBadge status={resource.status} />
      </div>

      {/* Type chip */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-sm bg-purple-100 text-purple-800 font-medium">
          {resource.type === "cabinet" ? (
            <Server size={14} strokeWidth={2} aria-hidden="true" />
          ) : (
            <Laptop size={14} strokeWidth={2} aria-hidden="true" />
          )}
          {resource.type === "cabinet" ? "Cabinet" : "Single"}
        </span>
      </div>

      {/* Description */}
      <div className="space-y-1">
        {editingDescription ? (
          <div className="space-y-1">
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              onKeyDown={handleDescriptionKeyDown}
              rows={2}
              className="sp-input text-xs"
              autoFocus
              disabled={saving}
              placeholder="Add description"
            />
            <div className="flex gap-1">
              <button
                onClick={handleSaveDescription}
                disabled={saving}
                className="sp-btn-primary sp-btn-sm"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={handleCancelDescription}
                disabled={saving}
                className="sp-btn-secondary sp-btn-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="group">
            <div className="flex items-center gap-1">
              <span className="text-xs text-ink-500">
                {resource.description || "No description"}
              </span>
              <button
                onClick={() => {
                  setEditDescription(resource.description);
                  setEditingDescription(true);
                  setEditError(null);
                }}
                className="edit-affordance text-ink-400 hover:text-purple-700 px-1"
                title="Edit description"
              >
                <Pencil size={14} strokeWidth={2} aria-hidden="true" />
                <span className="sr-only">Edit description</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {editError && !editingName && !editingRoom && !editingDescription && (
        <div className="text-xs text-status-alert-fg">{editError}</div>
      )}

      {/* Overdue indicator */}
      {resource.overdueBookings > 0 && (
        <div className="sp-pill-alert inline-flex items-center gap-1 self-start">
          <AlertTriangle size={14} strokeWidth={2} aria-hidden="true" />
          <span className="font-mono">{resource.overdueBookings}</span> overdue
        </div>
      )}

      {/* Utilisation bar */}
      {resource.type === "cabinet" && (
        <div>
          <div className="flex justify-between text-xs text-ink-500 mb-1">
            <span>
              <span className="font-mono">
                {resource.currentBooked}/{resource.totalQuantity}
              </span>{" "}
              in use
            </span>
            <span className="font-mono">{utilisationPct}%</span>
          </div>
          <div className="w-full bg-ink-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${barFillClass}`}
              style={{ width: `${utilisationPct}%` }}
            />
          </div>
        </div>
      )}

      {resource.type === "single" && (
        <p className="text-sm text-ink-800 inline-flex items-center gap-1.5">
          {resource.status === "available" ? (
            <>
              <CheckCircle2
                size={16}
                strokeWidth={2}
                aria-hidden="true"
                className="text-status-success-edge shrink-0"
              />
              Free to borrow
            </>
          ) : (
            <>
              <X
                size={16}
                strokeWidth={2}
                aria-hidden="true"
                className="text-status-alert-edge shrink-0"
              />
              Currently borrowed
            </>
          )}
        </p>
      )}

      {/* Hidden QR canvas for cabinet download */}
      {resource.type === "cabinet" && (
        <QRCodeCanvas
          value={buildReturnUrl()}
          size={180}
          bgColor="#ffffff"
          fgColor="#140A38"
          level="H"
          includeMargin
          ref={(el) => {
            qrCanvasRef.current = el;
          }}
          style={{ display: "none" }}
        />
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-1">
        <button
          onClick={() => onBook(resource)}
          disabled={!isAvailable}
          className="sp-btn-primary flex-1"
        >
          Book
        </button>
        <button
          onClick={() => onViewBookings(resource)}
          className="sp-btn-secondary flex-1"
        >
          History
        </button>
        {resource.type === "cabinet" && (
          <button
            onClick={handleDownloadQr}
            className="sp-btn-secondary"
            title="Download QR code for this cabinet"
          >
            <QrCode size={20} strokeWidth={2} aria-hidden="true" />
            <span className="sr-only">Download QR Code</span>
          </button>
        )}
        {isAdmin && onDelete && (
          <button
            onClick={() => setConfirmDelete(true)}
            className="sp-btn-danger"
            title="Delete resource"
          >
            <Trash2 size={20} strokeWidth={2} aria-hidden="true" />
            <span className="sr-only">Delete Resource</span>
          </button>
        )}
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 bg-ink-900/60"
          onClick={() => setConfirmDelete(false)}
        >
          <div
            className="sp-card shadow-lg p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-base font-bold text-purple-800 mb-2">
              Delete resource?
            </div>
            <p className="text-sm text-ink-800 mb-4">
              Permanently delete <strong>{resource.name}</strong>? This cannot
              be undone. Resources with active bookings cannot be deleted.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setConfirmDelete(false);
                  onDelete?.(resource);
                }}
                className="sp-btn-danger flex-1"
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="sp-btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResourceCard;
