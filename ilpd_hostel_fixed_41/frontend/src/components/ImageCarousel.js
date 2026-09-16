// src/components/ImageCarousel.jsx
// NOTE: Not used by Home.jsx anymore (Home renders photos directly).
// Kept here in case other pages still import it.

import React from "react";

// Shows all images side by side in a grid.
// No cycling, no fade, no transition.
export function ImageCarousel({ images = [], roomName = "" }) {
  const list = Array.isArray(images) ? images.filter(Boolean) : [];

  if (!list.length) {
    return (
      <div style={{
        width: "100%",
        aspectRatio: "16/9",
        background: "#f0f0f0",
        borderRadius: "8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "14px",
        color: "#999"
      }}>
        No images available
      </div>
    );
  }

  const columns = list.length === 1 ? 1 : list.length === 2 ? 2 : 3;

  return (
    <div style={{
      width: "100%",
      aspectRatio: "16/9",
      borderRadius: "12px",
      overflow: "hidden",
      background: "#f5f5f5",
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      display: "grid",
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gap: "4px"
    }}>
      {list.map((src, i) => (
        <img
          key={i}
          src={src}
          alt={`${roomName} — photo ${i + 1}`}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block"
          }}
        />
      ))}
    </div>
  );
}

// Thumbnail strip — kept for compatibility. Only renders if 2+ images.
export function ImageThumbnailStrip({ images = [], currentIndex = 0, onSelectImage }) {
  if (!images || images.length <= 1) return null;

  return (
    <div style={{
      display: "flex",
      gap: "8px",
      overflowX: "auto",
      padding: "12px 0",
      scrollBehavior: "smooth"
    }}>
      {images.map((image, index) => (
        <img
          key={index}
          src={image}
          alt={`Thumbnail ${index + 1}`}
          onClick={() => onSelectImage && onSelectImage(index)}
          style={{
            width: "80px",
            height: "60px",
            objectFit: "cover",
            borderRadius: "6px",
            cursor: "pointer",
            border: index === currentIndex ? "3px solid #b8860b" : "2px solid #ddd",
            flexShrink: 0
          }}
          title={`View photo ${index + 1}`}
        />
      ))}
    </div>
  );
}