type PdfRenderTask = { promise: Promise<void> };
type PdfViewport = { width: number; height: number };
type PdfPageRender = {
  getViewport: (opts: { scale: number }) => PdfViewport;
  render: (opts: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfViewport;
  }) => PdfRenderTask;
};

export async function renderPdfPageToPng(
  page: PdfPageRender,
  scale = 2
): Promise<ArrayBuffer | null> {
  if (
    typeof activeDocument === "undefined" ||
    typeof createImageBitmap !== "function"
  ) {
    return null;
  }

  const viewport = page.getViewport({ scale });
  const canvas = activeDocument.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  await page.render({ canvasContext: ctx, viewport }).promise;

  const blob = await new Promise<Blob | null>(resolve => {
    canvas.toBlob(resolve, "image/png");
  });
  if (!blob) {
    return null;
  }
  return blob.arrayBuffer();
}
