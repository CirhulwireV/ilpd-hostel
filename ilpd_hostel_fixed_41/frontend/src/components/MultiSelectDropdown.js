import React, { useEffect, useRef, useState } from "react";

/**
 * Compact multi-select dropdown with checkboxes.
 * Usage:
 *   <MultiSelectDropdown
 *     options={[{ value: "id1", label: "Room 101 — Akagera", group: "Akagera" }]}
 *     value={["id1", "id2"]}
 *     onChange={(newIds) => setSelected(newIds)}
 *     placeholder="Select rooms"
 *   />
 */
export default function MultiSelectDropdown({
  options = [],
  value = [],
  onChange,
  placeholder = "Select...",
  emptyText = "No options",
  width = "340px",
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggle = (id) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const clearAll = () => onChange([]);

  // Group options by `group` key
  const grouped = {};
  options.forEach((o) => {
    const key = o.group || "Other";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(o);
  });

  const summary =
    value.length === 0
      ? placeholder
      : `${value.length} selected`;

  return (
    <div ref={wrapperRef} style={{ position: "relative", width }}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "8px 12px",
          background: "#fff",
          border: "1px solid #ddd",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "13px",
          color: value.length ? "#333" : "#888",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {summary}
        </span>
        <span style={{ marginLeft: "8px", fontSize: "11px", color: "#666" }}>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {/* Popup */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 1000,
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: "6px",
            boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
            maxHeight: "260px",
            overflowY: "auto",
            padding: "6px 0",
            fontSize: "13px",
          }}
        >
          {options.length === 0 && (
            <div style={{ padding: "8px 12px", color: "#888" }}>{emptyText}</div>
          )}

          {Object.entries(grouped).map(([groupName, list]) => (
            <div key={groupName}>
              <div
                style={{
                  padding: "6px 12px 4px",
                  fontSize: "11px",
                  fontWeight: "700",
                  color: "#666",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  borderTop: "1px solid #f0f0f0",
                  marginTop: "4px",
                }}
              >
                {groupName} ({list.length})
              </div>
              {list.map((o) => (
                <label
                  key={o.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "5px 12px",
                    cursor: "pointer",
                    background: value.includes(o.value) ? "#fffaf0" : "transparent",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = value.includes(o.value) ? "#fffaf0" : "#f8f9fa")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = value.includes(o.value) ? "#fffaf0" : "transparent")}
                >
                  <input
                    type="checkbox"
                    checked={value.includes(o.value)}
                    onChange={() => toggle(o.value)}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          ))}

          {/* Footer actions */}
          {options.length > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "8px",
                padding: "8px 12px 4px",
                borderTop: "1px solid #eee",
                marginTop: "6px",
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "4px 10px", fontSize: "12px" }}
                onClick={clearAll}
              >
                Clear all
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: "4px 10px", fontSize: "12px" }}
                onClick={() => setOpen(false)}
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}