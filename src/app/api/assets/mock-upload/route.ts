import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { verifyStorageSignature } from "@/lib/providers/storage/sign";
import { MockStorageProvider } from "@/lib/providers/storage/mock.provider";

// PUT /api/assets/mock-upload?key=...&expires=...&sig=...
// The dev/local counterpart to a real cloud provider's presigned PUT URL —
// MockStorageProvider.createSignedUploadUrl() points the browser here
// instead of at S3 directly. Same HMAC-signed-token verification
// getSignedDownloadUrl's "GET /api/files" route already relies on, just in
// reverse (write instead of read).
export async function PUT(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  const expiresParam = req.nextUrl.searchParams.get("expires");
  const sig = req.nextUrl.searchParams.get("sig");

  if (!key || !expiresParam || !sig) {
    return apiError("ERR_VALIDATION", "key, expires, and sig are required.", 400);
  }

  const expiresAtMs = Number(expiresParam);
  if (!Number.isFinite(expiresAtMs) || Date.now() > expiresAtMs) {
    return apiError("ERR_VALIDATION", "This upload URL has expired.", 400);
  }
  if (!verifyStorageSignature(key, expiresAtMs, sig)) {
    return apiError("ERR_FORBIDDEN", "Invalid upload signature.", 403);
  }

  if (!req.body) {
    return apiError("ERR_VALIDATION", "Request body is required.", 400);
  }

  const storage = new MockStorageProvider();
  try {
    // Streams straight to disk (see MockStorageProvider.uploadFromStream's
    // own comment) instead of buffering the whole file into memory first —
    // the real fix for repeat-occurring large-upload failures, not just a
    // clearer error when one happens.
    await storage.uploadFromStream(key, req.body);
  } catch (err) {
    console.error(`[mock-upload] stream write failed for ${key}:`, err);
    return apiError("ERR_INTERNAL", "Failed to store the uploaded file. Please try again.", 500);
  }

  return apiSuccess({ ok: true });
}
