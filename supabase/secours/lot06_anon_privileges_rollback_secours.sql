-- CAPTCF Lot 0.6 — secours BORNE (hors chaîne auto)
-- NEVER restores global TRUNCATE/DELETE for anon.
-- Only re-opens a single proven public INSERT under a named policy if an
-- external marketing landing is demonstrated to need it.
--
-- Example (do NOT run blindly): re-enable authenticated-only lead insert is already
-- in Lot 0.6. For true anon lead insert after proven consumer:
--
--   GRANT INSERT ON public.leads TO anon;
--   CREATE POLICY "anon submit lead bounded"
--     ON public.leads FOR INSERT TO anon
--     WITH CHECK (
--       ((email IS NOT NULL) AND length(email::text) BETWEEN 3 AND 255)
--       OR (whatsapp_phone IS NOT NULL)
--     );
--
-- Prefer Edge Function + service_role with rate limits instead.

SELECT 'lot06_secours_placeholder_no_dangerous_restore' AS note;
