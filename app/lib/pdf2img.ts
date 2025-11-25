/**
 * PDF → Image Conversion (Vite + TS + pdfjs-dist)
 * Fully compatible with: React, Vite, TypeScript
 */

export interface PdfConversionResult {
  imageUrl: string;
  file: File | null;
  error?: string;
}

// ----------- PDF.js Loader -----------
let pdfjsLib: any = null;
let loadPromise: Promise<any> | null = null;

/**
 * Load and initialize pdfjs library with correct worker
 */
async function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  if (loadPromise) return loadPromise;

  loadPromise = import("pdfjs-dist/build/pdf").then(async (lib: any) => {
    // Correct worker loader (Vite-friendly)
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");

    lib.GlobalWorkerOptions.workerSrc = worker.default;

    pdfjsLib = lib;
    return lib;
  });

  return loadPromise;
}

// ----------- Main Conversion Function -----------

/**
 * Convert a PDF File into an Image File (PNG)
 */
export async function convertPdfToImage(
  file: File
): Promise<PdfConversionResult> {
  try {
    const lib = await loadPdfJs();

    // Load PDF as raw bytes
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await lib.getDocument({ data: arrayBuffer }).promise;

    // Get first page
    const page = await pdf.getPage(1);

    // Render settings
    const viewport = page.getViewport({ scale: 3 }); // Good balance of quality + speed
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    if (!ctx) {
      return {
        imageUrl: "",
        file: null,
        error: "Could not get canvas context",
      };
    }

    // Render PDF page → Canvas
    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise;

    // Convert canvas → Blob
    return await new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve({
              imageUrl: "",
              file: null,
              error: "Failed to convert canvas to blob",
            });
            return;
          }

          // Make PNG File
          const imgName = file.name.replace(/\.pdf$/i, "") + ".png";
          const imgFile = new File([blob], imgName, { type: "image/png" });

          resolve({
            imageUrl: URL.createObjectURL(blob),
            file: imgFile,
          });
        },
        "image/png",
        1.0
      );
    });
  } catch (err: any) {
    return {
      imageUrl: "",
      file: null,
      error: `Failed to convert PDF: ${err.message || err}`,
    };
  }
}
