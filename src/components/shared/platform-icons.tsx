import * as React from "react";

// PRD Section 12.2.2 / 12.12 — simplified custom platform glyphs (not the
// official brand logo files), coloured via the platform-* design tokens.
// Swap for licensed brand assets before production launch.

type IconProps = React.SVGProps<SVGSVGElement>;

export function InstagramIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function FacebookIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M13.8 8.2h1.4V6h-1.7c-1.7 0-2.8 1.1-2.8 2.9V10H9.3v2.1h1.4V18h2.2v-5.9h1.5l.3-2.1h-1.8V9c0-.5.3-.8.9-.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function YoutubeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" stroke="currentColor" strokeWidth="2" />
      <path d="M10.5 9.5v5l4.5-2.5-4.5-2.5Z" fill="currentColor" />
    </svg>
  );
}

export function WhatsappIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.7-1.2A9 9 0 1 0 12 3Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M8.5 9.3c.2-.6.6-.6.9-.6h.5c.2 0 .4 0 .5.4.2.5.6 1.3.6 1.4s.1.3-.1.5l-.4.4c-.1.2-.3.3-.1.6.3.5 1.5 2 3.2 2.6.2.1.4.1.5-.1l.5-.6c.2-.2.4-.2.6-.1l1.3.6c.2.1.4.2.4.4 0 .9-.4 1.5-1.4 1.8-1 .3-2.1.1-3.7-.7-1.9-1-3.2-2.7-3.4-3-.2-.3-1.1-1.5-1.1-2.7 0-.4.1-.7.2-1Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function GoogleBusinessIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M20.5 12.2c0-.6-.05-1.1-.16-1.7H12v3.2h4.8c-.2 1.2-1.5 3.4-4.8 3.4-2.9 0-5.2-2.4-5.2-5.3s2.3-5.3 5.2-5.3c1.6 0 2.7.7 3.3 1.3l2.3-2.2C16.3 4.1 14.4 3.2 12 3.2 7.2 3.2 3.3 7.1 3.3 11.8s3.9 8.6 8.7 8.6c5 0 8.4-3.5 8.4-8.5 0-.3 0-.5-.1-.7Z"
        fill="currentColor"
      />
    </svg>
  );
}
