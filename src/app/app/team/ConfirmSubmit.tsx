"use client";

import type { ReactNode } from "react";

/** A submit button that asks before a destructive action. */
export function ConfirmSubmit({ message, children }: { message: string; children: ReactNode }) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      className="min-h-11 rounded-xl px-3 text-sm font-semibold text-danger-ink hover:bg-danger-bg"
    >
      {children}
    </button>
  );
}
