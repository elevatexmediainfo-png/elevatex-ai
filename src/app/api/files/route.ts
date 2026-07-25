import { NextRequest, NextResponse } from "next/server";

import { apiError } from "@/lib/api-response";
import { verifyStorageSignature } from "@/lib/providers/storage/sign";
import { MockStorageProvider } from "@/lib/providers/storage/mock.provider";

// Only meaningful when PROVIDER_STORAGE=mock — serves the local-disk-backed
// "signed URLs" MockStorageProvider issues, with the same expiry + signature
// checks a real cloud provider would enforce server-side. A real adapter
// (S3Provider) never routes through this; it returns a URL signed directly
// by the vendor.
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  const expires = req.nextUrl.searchParams.get("expires");
  const sig = req.nextUrl.searchParams.get("sig");

  if (!key || !expires || !sig) {
    return apiError("ERR_VALIDATION", "Missing key/expires/sig.", 400);
  }

  const expiresAtMs = Number(expires);
  if (!Number.isFinite(expiresAtMs)) {
    return apiError("ERR_VALIDATION", "Invalid expires.", 400);
  }
  if (!verifyStorageSignature(key, expiresAtMs, sig)) {
    return apiError("ERR_FORBIDDEN", "Invalid signature.", 403);
  }
  if (Date.now() > expiresAtMs) {
    return apiError("ERR_EXPIRED", "This download link has expired.", 410);
  }

  if (/^https?:\/\//.test(key)) {
    return NextResponse.redirect(key);
  }

  try {
    const storage = new MockStorageProvider();
    const data = await storage.readLocalFile(key);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "private, max-age=0, no-store",
      },
    });
  } catch {
    return apiError("ERR_NOT_FOUND", "File not found.", 404);
  }
}
