import React, { useState } from "react";
import { Resource } from "../types";
import { StatusBadge } from "./StatusBadge";
import { updateResource } from "../api";

interface ResourceCardProps {
  resource: Resource;
  onBook: (resource: Resource) => void;
  onViewBookings: (resource: Resource) => void;
  onResourceUpdated?: () => void;
}

const ResourceCard: React.FC<ResourceCardProps> = ({
  resource,
  onBook,
  onViewBookings,
  onResourceUpdated,
}) => {
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState(resource.name);

  const [editingRoom, setEditingRoom] = useState(false);
  const [editRoom, setEditRoom] = useState(resource.classRoom);

  const [editingDescription, setEditingDescription] = useState(false);
  const [editDescription, setEditDescription] = useState(resource.description);

  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const isAvailable = resource.status !== "full";
  const utilisationPct =
    resource.totalQuantity > 0
      ? Math.round((resource.currentBooked / resource.totalQuantity) * 100)
      : 0;

  const barColor =
    resource.status === "available"
      ? "#28a745"
      : resource.status === "partial"
        ? "#ffc107"
        : "#dc3545";

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
    <div
      className="bg-white rounded-lg border p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow"
      style={{ borderColor: "#333333" }}
    >
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
                className="w-full border rounded px-2 py-1 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-gray-400"
                style={{ borderColor: "#ccc" }}
                autoFocus
                disabled={saving}
              />
              <div className="flex gap-1">
                <button
                  onClick={handleSaveName}
                  disabled={saving}
                  className="px-2 py-0.5 rounded text-xs font-medium"
                  style={{
                    backgroundColor: "#333",
                    color: "#fff",
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={handleCancelName}
                  disabled={saving}
                  className="px-2 py-0.5 rounded border text-xs"
                  style={{ borderColor: "#ccc", color: "#555" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="group">
              <div className="flex items-center gap-1">
                <h3 className="font-semibold text-base text-gray-900">
                  {resource.name}
                </h3>
                <button
                  onClick={() => {
                    setEditName(resource.name);
                    setEditingName(true);
                    setEditError(null);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 text-sm"
                  title="Edit name"
                >
                  ✏️
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
                      className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-gray-400"
                      style={{ borderColor: "#ccc" }}
                      autoFocus
                      disabled={saving}
                      placeholder="Enter address"
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={handleSaveRoom}
                        disabled={saving}
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          backgroundColor: "#333",
                          color: "#fff",
                          opacity: saving ? 0.7 : 1,
                        }}
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={handleCancelRoom}
                        disabled={saving}
                        className="px-2 py-0.5 rounded border text-xs"
                        style={{ borderColor: "#ccc", color: "#555" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {resource.classRoom}
                    </p>
                    <button
                      onClick={() => {
                        setEditRoom(resource.classRoom);
                        setEditingRoom(true);
                        setEditError(null);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 text-sm"
                      title="Edit address"
                    >
                      ✏️
                    </button>
                  </>
                )}
              </div>

              {resource.lastModifiedBy && (
                <p className="text-[10px] text-gray-400 mt-0.5">
                  ✏️ Last edited by {resource.lastModifiedBy}
                </p>
              )}
            </div>
          )}
        </div>

        <StatusBadge status={resource.status} />
      </div>

      {/* Type pill */}
      <div className="flex items-center gap-2">
        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium capitalize">
          {resource.type === "cabinet" ? "⚡ Cabinet" : "💻 Single"}
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
              className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-gray-400"
              style={{ borderColor: "#ccc" }}
              autoFocus
              disabled={saving}
              placeholder="Add description"
            />
            <div className="flex gap-1">
              <button
                onClick={handleSaveDescription}
                disabled={saving}
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{
                  backgroundColor: "#333",
                  color: "#fff",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={handleCancelDescription}
                disabled={saving}
                className="px-2 py-0.5 rounded border text-xs"
                style={{ borderColor: "#ccc", color: "#555" }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="group">
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">
                {resource.description || "No description"}
              </span>
              <button
                onClick={() => {
                  setEditDescription(resource.description);
                  setEditingDescription(true);
                  setEditError(null);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 text-sm"
                title="Edit description"
              >
                ✏️
              </button>
            </div>
          </div>
        )}
      </div>

      {editError && !editingName && !editingRoom && !editingDescription && (
        <div className="text-xs text-red-500">{editError}</div>
      )}

      {/* Overdue indicator */}
      {resource.overdueBookings > 0 && (
        <div
          className="text-xs font-medium px-2 py-0.5 rounded"
          style={{ backgroundColor: "#f8d7da", color: "#dc3545" }}
        >
          ⏰ {resource.overdueBookings} overdue
        </div>
      )}

      {/* Utilisation bar */}
      {resource.type === "cabinet" && (
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

      {resource.type === "single" && (
        <p className="text-sm text-gray-700">
          {resource.status === "available"
            ? "✅ Free to borrow"
            : "🚫 Currently borrowed"}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-1">
        <button
          onClick={() => onBook(resource)}
          disabled={!isAvailable}
          className="flex-1 py-1.5 text-sm font-medium rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            borderColor: "#333333",
            backgroundColor: isAvailable ? "#333333" : "transparent",
            color: isAvailable ? "#ffffff" : "#333333",
          }}
        >
          Book
        </button>
        <button
          onClick={() => onViewBookings(resource)}
          className="flex-1 py-1.5 text-sm font-medium rounded border transition-colors hover:bg-gray-100"
          style={{ borderColor: "#333333", color: "#333333" }}
        >
          History
        </button>
      </div>
    </div>
  );
};

export default ResourceCard;
