import React, { useState } from "react";
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

  const inputClass =
    "w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-[#f8f9fa]";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type */}
      <div>
        <label className={labelClass} htmlFor="resourceType">
          Type *
        </label>
        <select
          id="resourceType"
          value={type}
          onChange={(e) => setType(e.target.value as ResourceType)}
          className={inputClass}
          style={{ borderColor: "#333333" }}
        >
          <option value="cabinet">⚡ Cabinet</option>
          <option value="single">💻 Single Chromebook</option>
        </select>
      </div>

      {/* Name */}
      <div>
        <label className={labelClass} htmlFor="resourceName">
          Name *
        </label>
        <input
          id="resourceName"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Cabinet A1"
          className={inputClass}
          style={{ borderColor: "#333333" }}
        />
      </div>

      {/* Room / Location */}
      <div>
        <label className={labelClass} htmlFor="resourceRoom">
          Room / Location *
        </label>
        <input
          id="resourceRoom"
          type="text"
          required
          value={classRoom}
          onChange={(e) => setClassRoom(e.target.value)}
          placeholder="e.g. Room 12"
          className={inputClass}
          style={{ borderColor: "#333333" }}
        />
      </div>

      {/* Total Quantity (cabinet only) */}
      {type === "cabinet" && (
        <div>
          <label className={labelClass} htmlFor="resourceQuantity">
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
            className={inputClass}
            style={{ borderColor: "#333333" }}
          />
        </div>
      )}

      {/* Description */}
      <div>
        <label className={labelClass} htmlFor="resourceDescription">
          Description
        </label>
        <textarea
          id="resourceDescription"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Optional description"
          className={inputClass}
          style={{ borderColor: "#333333" }}
        />
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded p-3 text-sm font-medium"
          style={{
            backgroundColor: "#f8d7da",
            color: "#dc3545",
            border: "1px solid #dc3545",
          }}
        >
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 text-sm font-medium rounded border transition-colors hover:bg-gray-100"
          style={{ borderColor: "#333333", color: "#333333" }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-2 text-sm font-medium rounded transition-colors disabled:opacity-50"
          style={{ backgroundColor: "#333333", color: "#ffffff" }}
        >
          {loading ? "Adding…" : "Add Resource"}
        </button>
      </div>
    </form>
  );
};

export default AddResourceForm;
