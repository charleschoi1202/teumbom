"use client";

/**
 * On-device document reading (기기 내 처리): the photo never leaves the phone,
 * only the recognised text is sent to the server.
 */
export type OcrProgress = { stage: "load" | "read" | "done"; progress: number };

export async function ocrImage(file: Blob, onProgress?: (p: OcrProgress) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  onProgress?.({ stage: "load", progress: 0.05 });
  const worker = await createWorker("kor", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress?.({ stage: "read", progress: 0.3 + m.progress * 0.65 });
      else if (m.status.startsWith("loading")) onProgress?.({ stage: "load", progress: 0.05 + m.progress * 0.25 });
    },
  });
  try {
    const { data } = await worker.recognize(await downscale(file));
    onProgress?.({ stage: "done", progress: 1 });
    return cleanup(data.text);
  } finally {
    await worker.terminate();
  }
}

export async function pdfText(file: Blob, onProgress?: (p: OcrProgress) => void): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  type Item = { str: string; hasEOL?: boolean };
  const text = (content.items as Item[]).map((it) => it.str + (it.hasEOL ? "\n" : "")).join("");
  if (text.replace(/\s/g, "").length > 20) {
    onProgress?.({ stage: "done", progress: 1 });
    return cleanup(text);
  }
  // scanned PDF: render page 1 and OCR it
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
  const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
  return ocrImage(blob, onProgress);
}

async function downscale(file: Blob, max = 2000): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (scale === 1) return file;
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/png"));
  } catch {
    return file;
  }
}

function cleanup(text: string): string {
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/(\d)\s+(?=[,.]\d)/g, "$1")
    .replace(/([가-힣])\s(?=[가-힣]\s[가-힣]\s)/g, "$1 ")
    .split("\n").map((l) => l.trim()).join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
