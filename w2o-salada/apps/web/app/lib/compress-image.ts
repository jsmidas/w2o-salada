"use client";

const MAX_DIMENSION = 1920;
const TARGET_BYTES = 3.5 * 1024 * 1024;
const MIN_QUALITY = 0.5;
export const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024;

export class FileTooLargeError extends Error {
  constructor(public readonly size: number, public readonly fileName: string) {
    super(`파일 용량이 너무 큽니다 (${(size / 1024 / 1024).toFixed(1)}MB)`);
    this.name = "FileTooLargeError";
  }
}

export async function prepareUpload(file: File): Promise<File> {
  const compressed = await compressImage(file);
  if (compressed.size > MAX_UPLOAD_BYTES) {
    throw new FileTooLargeError(compressed.size, file.name);
  }
  return compressed;
}

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;
  if (file.size <= TARGET_BYTES) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement("canvas"), { width, height });
  const ctx = (canvas as HTMLCanvasElement | OffscreenCanvas).getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!ctx) {
    bitmap.close?.();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  let quality = 0.85;
  let blob = await canvasToBlob(canvas, quality);
  while (blob && blob.size > TARGET_BYTES && quality > MIN_QUALITY) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, quality);
  }
  if (!blob || blob.size >= file.size) return file;

  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}.webp`, { type: "image/webp" });
}

function canvasToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  quality: number
): Promise<Blob | null> {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type: "image/webp", quality });
  }
  return new Promise((resolve) =>
    (canvas as HTMLCanvasElement).toBlob(
      (b) => resolve(b),
      "image/webp",
      quality
    )
  );
}
