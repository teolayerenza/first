import exifr from "exifr";

export interface PreparedPhoto {
  blob: Blob;
  preview: string;
  lng: number | null;
  lat: number | null;
  taken_at: string | null;
}

/** Achica la foto (lado mayor 1800 px, JPEG) y lee del archivo original el GPS y la fecha, si los tiene. */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  let lng: number | null = null, lat: number | null = null, taken_at: string | null = null;
  try {
    const meta = await exifr.parse(file, { gps: true, pick: ["DateTimeOriginal", "latitude", "longitude"] });
    if (meta?.latitude && meta?.longitude) { lat = meta.latitude; lng = meta.longitude; }
    if (meta?.DateTimeOriginal instanceof Date) taken_at = meta.DateTimeOriginal.toISOString();
  } catch {
    // Sin datos EXIF: la foto se guarda igual.
  }
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const blob: Blob = await new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("foto"))), "image/jpeg", 0.85));
  return { blob, preview: URL.createObjectURL(blob), lng, lat, taken_at };
}
