"use client";

import { useMutation } from "convex/react";
import { useCallback } from "react";
import { api } from "@/convex/_generated/api";

/**
 * Uploads a photo to Convex storage and resolves to its id. The server checks
 * type, size and ownership again when the id is attached to a listing.
 */
export function useUploadImage() {
  const generateUploadUrl = useMutation(api.tools.generateUploadUrl);
  return useCallback(
    async (file: File) => {
      const url = await generateUploadUrl();
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const { storageId } = (await res.json()) as { storageId: string };
      return storageId;
    },
    [generateUploadUrl],
  );
}
