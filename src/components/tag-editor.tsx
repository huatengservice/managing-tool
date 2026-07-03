"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

/** Structured tags for the BO's private notes (customers §6, workers §7). */
export function TagEditor({
  tags,
  onChange,
  color = "rose",
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  color?: "rose" | "sky";
}) {
  const t = useT();
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const colorClass =
    color === "rose"
      ? "bg-rose-50 text-rose-600 border-rose-200"
      : "bg-sky-50 text-sky-600 border-sky-200";

  function submit() {
    const v = value.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setValue("");
    setAdding(false);
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {tags.map((tag) => (
        <span
          key={tag}
          className={`group text-xs rounded-full pl-3 pr-1.5 py-1 border inline-flex items-center gap-1 ${colorClass}`}
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(tags.filter((x) => x !== tag))}
            className="opacity-40 hover:opacity-100"
            aria-label={t("移除標籤", "Remove tag")}
          >
            <X size={11} />
          </button>
        </span>
      ))}
      {adding ? (
        <span className="flex items-center gap-1">
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder={t("輸入標籤…", "Type a tag…")}
            className="text-xs border border-slate-300 rounded-full px-3 py-1 w-28 outline-none focus:border-amber-400"
          />
          <button type="button" onClick={submit} className="text-xs bg-slate-900 text-white rounded-full px-2 py-1">
            {t("加", "Add")}
          </button>
          <button type="button" onClick={() => setAdding(false)} className="text-slate-400">
            <X size={12} />
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-xs border border-dashed border-slate-300 text-slate-400 rounded-full px-3 py-1 flex items-center gap-1 hover:border-amber-400 hover:text-amber-500"
        >
          <Plus size={11} />
          {t("新增標籤", "Add Tag")}
        </button>
      )}
    </div>
  );
}
