# OCR pipeline review (2026-09-28)

OCR is two live stacks plus unused dead code. Do not add a fourth path.

## Live paths
- **Plugin inbox:** `generateImageAnnotation` → compress to 1000px PNG → `POST /api/vision` (`generateText` + `imageInstructions`).
- **Mobile / sync:** R2 upload → `/api/process-file` or cron `/api/process-pending-uploads` → copied `processImageWithGPT4one` (`generateObject` + public `blobUrl`).

## Highest-leverage facts
- Default `settings.imageInstructions` asks for a **description**; `/api/vision` asks for **text-only OCR**. Both strings are concatenated.
- `getModel(name)` ignores `name`. `process-file` thinks it uses gpt-4o; the cron worker hardcodes `openai('gpt-4o')`; plugin uses `MODEL_NAME` (gpt-4.1-mini).
- Scanned PDFs are not OCR'd (`pdf.js` text layer only; mobile PDF is a stub).
- `aiService.extractTextFromImage` and `vercelTokens.visionModelName` are unused.

## When changing OCR
Use `@/lib/ocr-extract` + `@/lib/upload-file-processing`. Vision model: `VISION_MODEL` / `getVisionModel()`. Do not copy `processImageWithGPT4one` again.

## Implemented 2026-09-28
- Shared `ocr-extract`, `upload-file-processing`, R2 private download for OCR
- Plugin OCR defaults, PDF vision fallback, 2048px compress
- Cron: stale processing lease, token check before OCR
