import React, { useState } from "react";
import { setupSecurityQuestions } from "../api";

interface Props {
  onComplete: () => void;
}

export default function SecuritySetupModal({ onComplete }: Props) {
  const [food, setFood] = useState("");
  const [book, setBook] = useState("");
  const [color, setColor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!food.trim() || !book.trim() || !color.trim()) {
      setError("Please answer all three questions.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await setupSecurityQuestions(food.trim(), book.trim(), color.trim());
      onComplete();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          "Failed to save answers. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        style={{ border: "2px solid #333333" }}
      >
        {/* Header */}
        <div
          className="px-5 py-4"
          style={{ borderBottom: "1px solid #e5e7eb" }}
        >
          <div className="text-2xl mb-1">🔐</div>
          <h2 className="text-lg font-bold text-gray-900">
            Set Up Security Questions
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            These answers let you reset your password without email. They are{" "}
            <strong>encrypted</strong> and never stored in plain text. Please
            remember them exactly.
          </p>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {error && (
            <div
              className="px-3 py-2 rounded text-sm"
              style={{ backgroundColor: "#f8d7da", color: "#dc3545" }}
            >
              {error}
            </div>
          )}

          {[
            {
              label: "What's your favourite food?",
              value: food,
              setter: setFood,
            },
            {
              label: "What's your favourite book?",
              value: book,
              setter: setBook,
            },
            {
              label: "What's your favourite color?",
              value: color,
              setter: setColor,
            },
          ].map(({ label, value, setter }) => (
            <div key={label}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {label}
              </label>
              <input
                type="text"
                value={value}
                onChange={(e) => setter(e.target.value)}
                placeholder="Your answer"
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                style={{ borderColor: "#ccc" }}
                required
              />
              <p className="text-xs text-gray-400 mt-0.5">
                🔒 Encrypted — only used to verify your identity if you forget
                your password
              </p>
            </div>
          ))}

          <div
            className="rounded px-3 py-2 text-xs text-gray-600"
            style={{ backgroundColor: "#fff3cd", border: "1px solid #ffc107" }}
          >
            ⚠️ Remember your answers carefully. Spelling and spacing matter, but
            capitalisation does not (e.g. "blue" = "Blue" = "BLUE").
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded font-medium text-sm transition-opacity"
            style={{
              backgroundColor: "#333333",
              color: "#fff",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Saving…" : "Save Security Questions"}
          </button>
        </form>
      </div>
    </div>
  );
}
