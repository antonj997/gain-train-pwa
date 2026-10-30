import { FEEDBACK_LIMITS, fitWithin } from "./feedback";

/** The picked file is not an image this browser can open. */
export class ImageDecodeError extends Error {}

function load(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageDecodeError("decode"));
    };
    img.src = url;
  });
}

/**
 * Redraws a picked photo as a JPEG with its long edge at most 1600 px, so an
 * iPhone photo of several MB uploads as a few hundred KB. Browsers apply the
 * photo's orientation when drawing it. Throws ImageDecodeError when the file
 * cannot be opened.
 */
export async function compressImage(
  file: Blob,
  maxEdge: number = FEEDBACK_LIMITS.imageEdge,
  quality: number = FEEDBACK_LIMITS.imageQuality,
): Promise<Blob> {
  const img = await load(file);
  const { width, height } = fitWithin(
    img.naturalWidth,
    img.naturalHeight,
    maxEdge,
  );
  if (!width || !height) throw new ImageDecodeError("empty");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new ImageDecodeError("canvas");
  // A transparent PNG would turn black as a JPEG.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(img, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  // Release the bitmap memory at once; iOS keeps a tight canvas budget.
  canvas.width = canvas.height = 0;
  if (!blob) throw new ImageDecodeError("encode");
  return blob;
}
