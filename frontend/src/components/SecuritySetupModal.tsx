import React, { useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { setupSecurityQuestions } from "../api";

interface Props {
  onComplete: () => void;
  /** Dismiss without answering. The reminder banner stays until they do. */
  onSkip: () => void;
}

/**
 * Asks a teacher to set password-recovery answers.
 *
 * This used to be an unskippable wall on first sign-in, which is a hostile
 * way to greet staff whose account an admin just created for them. It is now
 * dismissible — but because security answers are the *only* self-service way
 * back into an account (there is no email reset), skipping raises a standing
 * reminder in the header rather than silently going away.
 */
export default function SecuritySetupModal({ onComplete, onSkip }: Props) {
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
      style={{ backgroundColor: "rgba(20,10,56,.60)" }}
    >
      <div className="bg-white rounded-md shadow-xl border border-ink-200 w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header carries the 4px gold rule, the house masthead accent */}
        <div className="px-5 py-4 sp-rule-gold">
          <h2 className="flex items-center gap-2 text-lg font-bold text-purple-800">
            <ShieldCheck
              size={20}
              strokeWidth={2}
              aria-hidden="true"
              className="flex-shrink-0"
            />
            Set Up Security Questions
          </h2>
          <p className="text-sm text-ink-500 mt-1">
            These answers let you reset your password without email. They are{" "}
            <strong>encrypted</strong> and never stored in plain text. Please
            remember them exactly.
          </p>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {error && (
            <div className="sp-banner-alert flex items-start gap-2">
              <AlertTriangle
                size={16}
                strokeWidth={2}
                aria-hidden="true"
                className="mt-0.5 flex-shrink-0"
              />
              <span>{error}</span>
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
              <label className="sp-label">{label}</label>
              <input
                type="text"
                value={value}
                onChange={(e) => setter(e.target.value)}
                placeholder="Your answer"
                className="sp-input"
                required
              />
              <p className="flex items-center gap-1 text-xs text-ink-500 mt-1">
                <ShieldCheck size={14} strokeWidth={2} aria-hidden="true" />
                Encrypted — only used to verify your identity if you forget
                your password
              </p>
            </div>
          ))}

          <div className="sp-banner-warning flex items-start gap-2 text-xs">
            <AlertTriangle
              size={16}
              strokeWidth={2}
              aria-hidden="true"
              className="mt-0.5 flex-shrink-0"
            />
            <span>
              Remember your answers carefully. Spelling and spacing matter,
              but capitalisation does not (e.g. "blue" = "Blue" = "BLUE").
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="sp-btn-primary w-full"
          >
            {loading ? "Saving…" : "Save Security Questions"}
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="w-full text-xs text-purple-700 underline hover:text-purple-500"
          >
            Not now — remind me later
          </button>
        </form>
      </div>
    </div>
  );
}
