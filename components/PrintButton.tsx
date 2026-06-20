"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print bg-compass-accent text-white text-sm px-3 py-2 rounded-lg"
    >
      Export PDF
    </button>
  );
}
