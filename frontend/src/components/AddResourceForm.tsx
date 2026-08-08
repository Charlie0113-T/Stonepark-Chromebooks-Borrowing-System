import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { createResource } from "../api";
import { CreateResourcePayload, ResourceType } from "../types";

interface AddResourceFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const AddResourceForm: React.FC<AddResourceFormProps> = ({
  onSuccess,
  onCancel,
}) => {
  const [type, setType] = useState<ResourceType>("cabinet");
  const [name, setName] = useState("");
  const [classRoom, setClassRoom] = useState("");
  const [totalQuantity, setTotalQuantity] = useState(1);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload: CreateResourcePayload = {
      type,
      name: name.trim(),
      classRoom: classRoom.trim(),
      totalQuantity: type === "single" ? 1 : totalQuantity,
      description: description.trim() || undefined,
    };

    try {
      setLoading(true);
      await createResource(payload);
      onSuccess();
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        "Failed to create resource. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type */}
      <div>
        <label className="sp-label" htmlFor="resourceType">
          Type *
        </label>
        <select
          id="resourceType"
          value={type}
          onChange={(e) => setType(e.target.value as ResourceType)}
          className="sp-input"
        >
          <option value="cabinet">Cabinet</option>
          <option value="single">Single Chromebook</option>
        </select>
      </div>

      {/* Name */}
      <div>
        <label className="sp-label" htmlFor="resourceName">
          Name *
        </label>
        <input
          id="resourceName"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Cabinet A1"
          className="sp-input"
        />
      </div>

      {/* Room / Location */}
      <div>
        <label className="sp-label" htmlFor="resourceRoom">
          Room / Location *
        </label>
        <input
          id="resourceRoom"
          type="text"
          required
          value={classRoom}
          onChange={(e) => setClassRoom(e.target.value)}
          placeholder="e.g. Room 12"
          className="sp-input"
        />
      </div>

      {/* Total Quantity (cabinet only) */}
      {type === "cabinet" && (
        <div>
          <label className="sp-label" htmlFor="resourceQuantity">
            Total Quantity *
          </label>
          <input
            id="resourceQuantity"
            type="number"
            required
            min={1}
            value={totalQuantity}
            onChange={(e) =>
              setTotalQuantity(parseInt(e.target.value, 10) || 1)
            }
            className="sp-input font-mono"
          />
        </div>
      )}

      {/* Description */}
      <div>
        <label className="sp-label" htmlFor="resourceDescription">
          Description
        </label>
        <textarea
          id="resourceDescription"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Optional description"
          className="sp-input"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="sp-banner-alert flex items-start gap-2">
          <AlertTriangle
            size={16}
            strokeWidth={2}
            aria-hidden="true"
            className="shrink-0 mt-0.5"
          />
          <span>{error}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="sp-btn-secondary flex-1"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="sp-btn-primary flex-1"
        >
          {loading ? "Adding…" : "Add Resource"}
        </button>
      </div>
    </form>
  );
};

export default AddResourceForm;
