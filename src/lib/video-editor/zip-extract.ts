import JSZip from "jszip";

// Milestone 26 — Admin Asset Library's zip-upload path. Admin-only surface
// (lower risk than a public upload endpoint), but still guards against a
// zip bomb (oversized uncompressed total) and path-traversal entry names
// before extracting anything, same caution every other upload path in this
// app applies to untrusted bytes.
const MAX_UNCOMPRESSED_BYTES = 500 * 1024 * 1024; // 500MB total per batch

export interface ExtractedZipEntry {
  filename: string;
  buffer: Buffer;
}

export class ZipExtractionError extends Error {}

export async function extractZipEntries(zipBuffer: Buffer): Promise<ExtractedZipEntry[]> {
  const zip = await JSZip.loadAsync(zipBuffer).catch(() => {
    throw new ZipExtractionError("Not a valid zip archive.");
  });

  const entries: ExtractedZipEntry[] = [];
  let totalBytes = 0;

  for (const [rawPath, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    // Reject path traversal and absolute paths outright — this filename is
    // only ever used to derive originalFilename/category-guess, never as a
    // real filesystem path, but rejecting it here keeps that invariant
    // impossible to violate even if a future caller starts treating it as one.
    if (rawPath.includes("..") || rawPath.startsWith("/") || rawPath.includes("\\")) {
      throw new ZipExtractionError(`Unsafe entry name in zip: "${rawPath}".`);
    }
    // Skip macOS/zip-tool metadata noise rather than failing the whole batch.
    if (rawPath.startsWith("__MACOSX/") || rawPath.split("/").pop()?.startsWith(".")) continue;

    const buffer = await entry.async("nodebuffer");
    totalBytes += buffer.byteLength;
    if (totalBytes > MAX_UNCOMPRESSED_BYTES) {
      throw new ZipExtractionError(`Zip archive's uncompressed contents exceed the ${MAX_UNCOMPRESSED_BYTES / (1024 * 1024)}MB limit.`);
    }

    entries.push({ filename: rawPath.split("/").pop() ?? rawPath, buffer });
  }

  return entries;
}
