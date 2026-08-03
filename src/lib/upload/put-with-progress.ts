// Shared by every direct-to-storage presigned upload flow (Talking Head
// video upload, and Milestone 15's reference-image/brand-logo upload) — a
// browser-side XHR PUT with progress events, since fetch() can't report
// upload progress.
export function putWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (HTTP ${xhr.status})`)));
    // Real root cause found live (2026-08-03) — a cross-origin PUT blocked
    // by the storage bucket's own CORS policy (missing AllowedOrigins entry
    // for the real deployed origin) fires onerror with xhr.status === 0 and
    // no readable response at all — a genuine browser security restriction,
    // not something more detail could be extracted from client-side. Still
    // surface the status so this reads as "HTTP 0" (a real, actionable
    // signature of a network/CORS-level failure) instead of a bare, opaque
    // "Upload failed." with zero diagnostic value.
    xhr.onerror = () => reject(new Error(`Upload failed (HTTP ${xhr.status}) — network or CORS error.`));
    xhr.send(file);
  });
}
