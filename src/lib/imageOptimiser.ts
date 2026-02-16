/**
 * Client-side image optimisation — converts to WebP and resizes large images.
 * Falls back to the original file if the browser doesn't support WebP or canvas.
 */

const MAX_DIMENSION = 1200;
const WEBP_QUALITY = 0.82;

/**
 * Returns true if the file is an image type that we can optimise (not PDF).
 */
export function isOptimisableImage(file: File): boolean {
  return ["image/jpeg", "image/png", "image/webp"].includes(file.type);
}

/**
 * Converts an image File to WebP, optionally resizing if either dimension
 * exceeds MAX_DIMENSION. Returns a new File with .webp extension.
 *
 * If the browser doesn't support WebP encoding, returns the original file.
 */
export async function optimiseImage(
  file: File,
  options: { maxDimension?: number; quality?: number } = {}
): Promise<File> {
  // Skip non-image files (e.g. PDF)
  if (!isOptimisableImage(file)) return file;

  const maxDim = options.maxDimension ?? MAX_DIMENSION;
  const quality = options.quality ?? WEBP_QUALITY;

  return new Promise<File>((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Resize if needed
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file); // canvas not available
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            // WebP not supported or didn't reduce size — keep original
            resolve(file);
            return;
          }

          // Build new filename with .webp extension
          const baseName = file.name.replace(/\.[^.]+$/, "");
          const newFile = new File([blob], `${baseName}.webp`, {
            type: "image/webp",
            lastModified: Date.now(),
          });
          resolve(newFile);
        },
        "image/webp",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // can't decode — return original
    };

    img.src = url;
  });
}
