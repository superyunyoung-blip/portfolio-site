"use client";

import { useEffect } from "react";

export function TrackPageView({ path }: { path: string }) {
  useEffect(() => {
    void fetch("/api/page-views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
  }, [path]);

  return null;
}
