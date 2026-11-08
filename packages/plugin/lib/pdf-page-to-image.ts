const MAX_PDF_RENDER_EDGE = 2048;

type PdfRenderTask = { promise: Promise<void> };
type PdfViewport = { width: number; height: number };
type PdfPageRender = {
  getViewport: (opts: { scale: number }) => PdfViewport;
  render: (opts: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfViewport;
  }) => PdfRenderTask;
};

function resolveRenderScale(page: PdfPageRender, preferredScale: number): number {
  const atUnitScale = page.getViewport({ scale: 1 });
  const maxDim = Math.max(atUnitScale.width, atUnitScale.height);
  if (!Number.isFinite(maxDim) || maxDim <= 0) {
    return Math.min(preferredScale, 1);
  }
  const scaleForEdgeCap = MAX_PDF_RENDER_EDGE / maxDim;
  return Math.min(preferredScale, scaleForEdgeCap, 2);
}

export async function renderPdfPageToPng(
  page: PdfPageRender,
  preferredScale = 2
): Promise<ArrayBuffer | null> {
  if (typeof activeDocument === "undefined") {
    return null;
  }

  const scale = resolveRenderScale(page, preferredScale);
  const viewport = page.getViewport({ scale });
  const canvas = activeDocument.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  try {
    await page.render({ canvasContext: ctx, viewport }).promise;
  } catch {
    return null;
  }

  const blob = await new Promise<Blob | null>(resolve => {
    canvas.toBlob(resolve, "image/png");
  });
  if (!blob) {
    return null;
  }
  return blob.arrayBuffer();
}
