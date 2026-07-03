"use client";

import imageCompression from "browser-image-compression";
import exifr from "exifr";

/**
 * Photo pipeline (spec §5):
 * 1. Read EXIF timestamp/GPS BEFORE compression — canvas re-encoding drops
 *    EXIF, so the evidence metadata is captured here and stored as
 *    structured columns on job_photos (kept for disputes, never shared).
 * 2. Compress to ~1920px longest edge, JPEG ~80%, with EXIF auto-rotation.
 *    The uploaded binary therefore carries no location metadata at all,
 *    which also makes every shared copy metadata-free by construction.
 */

export interface ProcessedPhoto {
  blob: Blob;
  fileName: string;
  takenAt: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
}

export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  let takenAt: string | null = null;
  let gpsLat: number | null = null;
  let gpsLng: number | null = null;

  try {
    const exif = await exifr.parse(file, { gps: true, pick: ["DateTimeOriginal", "CreateDate"] });
    const taken: Date | undefined = exif?.DateTimeOriginal ?? exif?.CreateDate;
    if (taken instanceof Date && !isNaN(taken.getTime())) takenAt = taken.toISOString();
    const gps = await exifr.gps(file).catch(() => null);
    if (gps && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude)) {
      gpsLat = gps.latitude;
      gpsLng = gps.longitude;
    }
  } catch {
    // Missing/corrupt EXIF is fine — metadata is best-effort evidence.
  }

  const blob = await imageCompression(file, {
    maxWidthOrHeight: 1920,
    initialQuality: 0.8,
    fileType: "image/jpeg",
    useWebWorker: true,
  });

  const base = file.name.replace(/\.[^.]+$/, "").replace(/[^\w-]/g, "_") || "photo";
  return {
    blob,
    fileName: `${Date.now()}-${base}.jpg`,
    takenAt,
    gpsLat,
    gpsLng,
  };
}
