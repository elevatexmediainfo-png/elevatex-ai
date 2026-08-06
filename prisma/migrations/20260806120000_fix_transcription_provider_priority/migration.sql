-- Production fix (2026-08-06, FIX 1) — AssemblyAI must become the primary
-- TRANSCRIPTION provider, with Whisper kept enabled as a real fallback
-- (only ever reached once AssemblyAI's own retries are exhausted — see
-- lib/generation/engine.ts's runGeneration(), which already fails over to
-- the next-priority provider in the chain unmodified) and gpt4o_transcribe
-- disabled (it has no real adapter — lib/generation/transcription.ts's
-- IMPLEMENTED_TRANSCRIPTION_IDS already filters it out even if left
-- enabled, but disabling it here keeps the Admin AI Providers panel
-- honest about what's actually in effect).
--
-- Reported production state before this fix:
--   openai_whisper    enabled=true
--   gpt4o_transcribe  enabled=true
--   assemblyai        enabled=false
--
-- Desired state after this fix:
--   assemblyai        enabled=true,  priority=0   (primary)
--   openai_whisper    enabled=true,  priority=3   (fallback)
--   gpt4o_transcribe  enabled=false                (no real adapter)
--
-- ON CONFLICT DO UPDATE only ever touches `enabled`/`priority`/`updatedAt`
-- — it deliberately never overwrites apiKeyEncrypted/apiSecretEncrypted/
-- extraConfig/etc. on an existing row, so a provider's already-configured
-- credentials are preserved untouched. If a row doesn't exist yet for one
-- of these ids (never configured in this environment), the INSERT branch
-- creates a bare row with no credentials — Whisper never removed (still
-- enabled either way), matching the "never remove Whisper" requirement.
INSERT INTO "provider_configs" ("id", "category", "providerId", "enabled", "priority", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'TRANSCRIPTION', 'assemblyai', true, 0, now(), now())
ON CONFLICT ("category", "providerId")
DO UPDATE SET "enabled" = true, "priority" = 0, "updatedAt" = now();

INSERT INTO "provider_configs" ("id", "category", "providerId", "enabled", "priority", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'TRANSCRIPTION', 'openai_whisper', true, 3, now(), now())
ON CONFLICT ("category", "providerId")
DO UPDATE SET "enabled" = true, "priority" = 3, "updatedAt" = now();

INSERT INTO "provider_configs" ("id", "category", "providerId", "enabled", "priority", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'TRANSCRIPTION', 'gpt4o_transcribe', false, 0, now(), now())
ON CONFLICT ("category", "providerId")
DO UPDATE SET "enabled" = false, "updatedAt" = now();
