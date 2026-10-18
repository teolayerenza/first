"use client";

// Fotos sin fricción (docs/PLAN.md §9.3): el vecino sube CUALQUIER foto y acá se achica sola.
// Al re-codificar en un canvas desaparece todo el EXIF (GPS, fecha, modelo del teléfono).

const MAX_SIDE = 1280;
const TARGET_BYTES = 300_000;

async function decode(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (e) {
    // HEIC/HEIF en navegadores que no lo decodifican (Safari en iOS sí lo hace): se convierte primero.
    const isHeic = /heic|heif/i.test(file.type) || (file instanceof File && /\.(heic|heif)$/i.test(file.name));
    if (!isHeic) throw e;
    const { default: heic2any } = await import("heic2any");
    const jpeg = (await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 })) as Blob;
    return await createImageBitmap(jpeg, { imageOrientation: "from-image" });
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export interface CompressedPhoto {
  blob: Blob;
  type: "image/webp" | "image/jpeg";
  width: number;
  height: number;
}

export async function compressPhoto(file: Blob): Promise<CompressedPhoto> {
  const bmp = await decode(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const width = Math.round(bmp.width * scale);
  const height = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen");
  ctx.drawImage(bmp, 0, 0, width, height);
  bmp.close();

  // WebP si el navegador lo soporta (si no, toBlob devuelve PNG y caemos a JPEG).
  let type: CompressedPhoto["type"] = "image/webp";
  let quality = 0.75;
  let blob = await toBlob(canvas, type, quality);
  if (!blob || blob.type !== "image/webp") {
    type = "image/jpeg";
    blob = await toBlob(canvas, type, quality);
  }
  while (blob && blob.size > TARGET_BYTES && quality > 0.4) {
    quality -= 0.1;
    blob = await toBlob(canvas, type, quality);
  }
  if (!blob) throw new Error("No se pudo comprimir la imagen");
  return { blob, type, width, height };
}
