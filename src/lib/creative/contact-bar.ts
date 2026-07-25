// Canvas-compositor Problem 4 fix — formats real BrandKit contact details
// into a single footer-ready line, replacing the generic "{industry}
// professional services" tagline. Plain text labels (Ph:/WhatsApp:/Add:/
// Web:), not emoji icons — measured directly against the actual sharp/SVG
// rendering pipeline: emoji rendered as thin monochrome fallback glyphs on
// this dev machine (font-coverage dependent, not guaranteed on a
// production Linux container, which risks tofu boxes) versus text labels,
// which use the exact same font/rendering path as every other line on the
// poster — zero cross-platform risk. Same "•" separator convention already
// used for social proof (svg-text-layer.ts).
export interface ContactBarInput {
  contactPhone: string | null;
  contactWhatsapp: string | null;
  addressLine: string | null;
  websiteOrSocial: string | null;
}

// Returns null when there's nothing to show — the caller falls back to the
// existing generic footer tagline in that case, never a blank footer.
export function buildContactBarText(input: ContactBarInput): string | null {
  const phone = input.contactPhone?.trim() || null;
  const whatsapp = input.contactWhatsapp?.trim() || null;
  const address = input.addressLine?.trim() || null;
  const website = input.websiteOrSocial?.trim() || null;

  const parts: string[] = [];
  if (phone) parts.push(`Ph: ${phone}`);
  // Same number for both fields is the common case — showing it twice
  // would be redundant, so WhatsApp only gets its own segment when it
  // actually differs from the phone number.
  if (whatsapp && whatsapp !== phone) parts.push(`WhatsApp: ${whatsapp}`);
  if (address) parts.push(`Add: ${address}`);
  if (website) parts.push(`Web: ${website}`);

  return parts.length ? parts.join("   •   ") : null;
}
