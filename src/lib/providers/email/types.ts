// Milestone 12 — transactional email. Deliberately NOT a GenerationProvider
// (doesn't join GenerationCategory): email is fire-and-forget notification,
// not a generation call with the same failover/retry/cost-tracking shape,
// and a missed email should never retry-storm or fail a render. Mirrors the
// Payment provider's "no failover concept, single active driver" shape
// instead — see lib/providers/payment/types.ts.

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  sent: boolean;
  // Present when sent is false — never thrown, since a notification
  // dispatch failure must never block or fail the render/action it's
  // attached to (see lib/notifications/email.ts).
  error?: string;
}

export interface EmailProvider {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}
