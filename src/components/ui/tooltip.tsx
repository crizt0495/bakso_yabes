"use client";

import * as React from "react";

export function Tooltip({
  text,
  children,
}: {
  text?: string;
  children: React.ReactNode;
}) {
  if (!text) return <>{children}</>;
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute -bottom-9 left-1/2 z-50 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2 py-1 text-xs text-white group-hover/tt:block"
      >
        {text}
      </span>
    </span>
  );
}
