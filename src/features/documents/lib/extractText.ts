export const ACCEPTED_EXTENSIONS = ".txt,.md,.csv,.pdf";
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ACCEPTED_MIMES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/pdf",
]);

const TEXT_EXTENSIONS = new Set(["txt", "md", "csv"]);

function getExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function isAcceptedType(file: File): boolean {
  if (ACCEPTED_MIMES.has(file.type)) return true;
  // Browser mime detection is unreliable for .md/.csv — fall back to extension
  return TEXT_EXTENSIONS.has(getExtension(file.name)) || getExtension(file.name) === "pdf";
}

export async function extractText(file: File): Promise<string> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File exceeds ${MAX_FILE_SIZE / 1024 / 1024} MB limit`);
  }

  const ext = getExtension(file.name);

  // Plain text family: .txt, .md, .csv
  if (TEXT_EXTENSIONS.has(ext) || file.type.startsWith("text/")) {
    return file.text();
  }

  // PDF: use pdfjs-dist (lazy-loaded)
  if (ext === "pdf" || file.type === "application/pdf") {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .filter((item) => "str" in item && typeof (item as { str?: unknown }).str === "string")
        .map((item) => (item as { str: string }).str)
        .join(" ");
      pages.push(pageText);
    }
    return pages.join("\n\n");
  }

  throw new Error(`Unsupported file type: ${ext}`);
}
