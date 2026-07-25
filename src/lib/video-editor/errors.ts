// Shared by every Cloud Video Editor service function (Milestone 24) for
// both "not found/not owned" and "business rule violated" failures — routes
// decide the HTTP status (404 vs 409) per call site, same convention
// lib/timeline/engine.ts's InvalidStateError already established.
export class InvalidStateError extends Error {}

// Fix (2026-07-13) — a distinct type from InvalidStateError so confirm-
// upload's route can tell "asset not found" (404) apart from "the file
// that arrived doesn't match what was declared" (409) without parsing
// error messages. Thrown by confirmEditorAssetUpload() when the object's
// actual stored byte size (StorageProvider.getObjectSize()) doesn't match
// EditorAsset.fileSizeBytes — the real fix for the upload-truncation class
// of bug (a body-size cap silently cutting a PUT off mid-transfer used to
// leave a corrupt file marked READY with no error anywhere).
export class UploadIntegrityError extends Error {}
