import React, { useEffect, useRef } from "react";
import type { ImageItem } from "../types";

export const ImageUploader: React.FC<{
  items: ImageItem[];
  onUpload: (file: File) => void;
  onDelete: (imageId: string) => void;
  canAdd: boolean; // keep prop for compatibility, but we also compute from items.length
}> = ({ items, onUpload, onDelete, canAdd }) => {
  const ref = useRef<HTMLInputElement>(null);
  const maxReached = items.length >= 4;

  // Optional: revoke any blob: URLs when component unmounts
  useEffect(() => {
    return () => {
      items.forEach((i) => {
        if (i.url.startsWith("blob:")) URL.revokeObjectURL(i.url);
      });
    };
    // we intentionally don't depend on items to avoid revoking in-flight previews
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <button
        className="btn-pill"
        type="button"
        onClick={() => ref.current?.click()}
        disabled={maxReached || !canAdd}
        style={{ marginBottom: 8 }}
        aria-disabled={maxReached || !canAdd}
        title={maxReached ? "Maximum 4 images reached" : "Add image"}
      >
        + Add image
      </button>

      <input
        ref={ref}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.currentTarget.value = "";
        }}
      />

      <div className="image-grid">
        {items.map((img) => (
          <div key={img.id} style={{ position: "relative" }}>
            <img src={img.url} alt="Uploaded preview" />
            <button
              type="button"
              className="btn-pill"
              style={{ position: "absolute", top: 4, right: 4 }}
              onClick={() => onDelete(img.id)}
              aria-label="Delete image"
              title="Delete image"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="small" style={{ marginTop: 6 }}>
        {items.length}/4 images
      </div>
    </div>
  );
};
