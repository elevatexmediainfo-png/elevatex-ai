-- Data migration: remove the deprecated "imagen" provider from every
-- existing Marketing Template. Mirrors the runtime auto-remap added to
-- generateFromMarketingTemplate() (src/lib/marketing-templates/
-- generate.ts) so existing rows reflect the same corrected state, not
-- just in-memory behavior at generation time.

-- If a template had BOTH primary and fallback set to "imagen", they would
-- become identical ("gemini_images") after the remaps below — null out
-- the fallback in that specific case first, since a fallback equal to the
-- primary provides no failover value (and the admin API now rejects
-- saving that combination going forward anyway).
UPDATE "marketing_templates"
SET "fallbackProviderId" = NULL
WHERE "primaryProviderId" = 'imagen' AND "fallbackProviderId" = 'imagen';

UPDATE "marketing_templates"
SET "primaryProviderId" = 'gemini_images'
WHERE "primaryProviderId" = 'imagen';

UPDATE "marketing_templates"
SET "fallbackProviderId" = 'gemini_images'
WHERE "fallbackProviderId" = 'imagen';
