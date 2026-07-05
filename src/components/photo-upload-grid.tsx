"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CloudOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { processPhoto } from "@/lib/photos";
import { enqueue, flush, pendingCount, type QueuedUpload } from "@/lib/offline-queue";
import { useT } from "@/lib/i18n/provider";
import type { PhotoType } from "@/lib/types";

export interface DisplayPhoto {
  id: string;
  url: string;
  type: PhotoType;
}

async function uploadQueued(item: QueuedUpload) {
  const supabase = createClient();
  const path = `${item.companyId}/${item.jobId}/${item.fileName}`;
  const { error: upErr } = await supabase.storage
    .from("job-photos")
    .upload(path, item.blob, { contentType: "image/jpeg" });
  if (upErr) throw upErr;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error: dbErr } = await supabase.from("job_photos").insert({
    company_id: item.companyId,
    job_id: item.jobId,
    type: item.photoType,
    storage_path: path,
    taken_at: item.takenAt,
    gps_lat: item.gpsLat,
    gps_lng: item.gpsLng,
    uploaded_by: user!.id,
  });
  if (dbErr) throw dbErr;
}

/**
 * Before/after photo grid with camera capture, client-side compression +
 * EXIF handling (spec §5) and an IndexedDB offline queue (spec §13):
 * uploads that fail while offline are queued and flushed on reconnect.
 */
export function PhotoUploadGrid({
  label,
  photos,
  jobId,
  companyId,
  photoType,
  allowUpload,
  required,
}: {
  label: string;
  photos: DisplayPhoto[];
  jobId: string;
  companyId: string;
  photoType: PhotoType;
  allowUpload: boolean;
  required?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [queued, setQueued] = useState(0);

  useEffect(() => {
    pendingCount().then(setQueued).catch(() => {});
    const onOnline = () => {
      flush(uploadQueued).then(({ remaining }) => {
        setQueued(remaining);
        router.refresh();
      });
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [router]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      const processed = await processPhoto(file);
      const item: QueuedUpload = {
        kind: "job-photo",
        jobId,
        companyId,
        photoType,
        fileName: processed.fileName,
        blob: processed.blob,
        takenAt: processed.takenAt,
        gpsLat: processed.gpsLat,
        gpsLng: processed.gpsLng,
        queuedAt: new Date().toISOString(),
      };
      try {
        await uploadQueued(item);
      } catch {
        // Poor signal: keep the capture, retry when back online.
        await enqueue(item);
        setQueued((q) => q + 1);
      }
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-xs text-slate-400">{label}</span>
        {required && (
          <span className="text-[10px] text-rose-500 font-semibold bg-rose-50 border border-rose-200 rounded px-1.5">
            {t("必填", "Required")}
          </span>
        )}
        {photos.length > 0 && (
          <span className="text-[10px] text-slate-300">
            （{photos.length} {t("張", "photos")}）
          </span>
        )}
        {queued > 0 && (
          <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
            <CloudOff size={10} />
            {t(`${queued} 張待上傳（離線）`, `${queued} queued (offline)`)}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p) => (
          <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="w-full h-full object-cover" />
          </a>
        ))}
        {allowUpload && (
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="h-20 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:border-amber-400 hover:text-amber-500 gap-1 disabled:opacity-50"
          >
            <Camera size={18} />
            <span className="text-[10px]">{busy ? t("處理中…", "Processing…") : t("拍照或選擇", "Take/choose photo")}</span>
          </button>
        )}
      </div>
      {allowUpload && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      )}
      {photos.length === 0 && !allowUpload && (
        <p className="text-[11px] text-slate-300 mt-1">{t("尚未上傳", "Not uploaded yet")}</p>
      )}
    </div>
  );
}
