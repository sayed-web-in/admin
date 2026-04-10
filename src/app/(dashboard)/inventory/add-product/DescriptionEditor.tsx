"use client";

import { useRef, useEffect } from "react";
import "quill/dist/quill.snow.css";
import "./DescriptionEditor.css";

const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, false] }],
  ["bold", "italic", "underline", "strike"],
  [{ list: "ordered" }, { list: "bullet" }],
  [{ indent: "-1" }, { indent: "+1" }],
  ["link"],
  [{ color: [] }, { background: [] }],
  [{ align: [] }],
  ["clean"],
];

export interface DescriptionEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
}

export default function DescriptionEditor({
  value,
  onChange,
  placeholder = "Enter detailed product description...",
  minHeight = "180px",
  className = "",
}: DescriptionEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<{ root: HTMLElement; off?: (e: string) => void } | null>(
    null
  );
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";
    let cancelled = false;
    let quillInstance: {
      root: HTMLElement;
      on: (e: string, fn: () => void) => void;
      off: (e: string) => void;
    } | null = null;

    void import("quill").then((m) => {
      if (cancelled || !containerRef.current) return;
      containerRef.current.innerHTML = "";
      const Quill = m.default;
      const q = new Quill(containerRef.current, {
        theme: "snow",
        placeholder,
        modules: { toolbar: TOOLBAR_OPTIONS },
      });
      quillInstance = q as typeof quillInstance;
      quillRef.current = q;

      q.root.innerHTML = valueRef.current || "";
      if (minHeight && q.root.parentElement) {
        (q.root.parentElement as HTMLElement).style.minHeight = minHeight;
      }

      q.on("text-change", () => {
        const html = q.root.innerHTML;
        if (valueRef.current !== html) onChangeRef.current(html);
      });
    });

    return () => {
      cancelled = true;
      quillRef.current = null;
      quillInstance?.off("text-change");
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [minHeight, placeholder]);

  useEffect(() => {
    const q = quillRef.current;
    if (!q) return;
    const current = q.root.innerHTML;
    const next = value ?? "";
    if (current !== next) q.root.innerHTML = next;
  }, [value]);

  return (
    <div className={`description-editor-form-style ${className}`.trim()}>
      <div ref={containerRef} style={{ minHeight }} />
    </div>
  );
}
