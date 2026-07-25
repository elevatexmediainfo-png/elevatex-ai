import type { ProviderRuntimeConfig } from "../credentials";
import type { EmailProvider, SendEmailInput, SendEmailResult } from "./types";

// REST integration against Resend's documented API — no SDK dependency,
// matching the rest-call pattern most of this codebase's real adapters
// already use (OpenAI/Gemini/ElevenLabs/etc.) rather than installing yet
// another vendor SDK for one HTTP call.
export class ResendEmailProvider implements EmailProvider {
  constructor(private config: ProviderRuntimeConfig) {}

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    if (!this.config.apiKey) return { sent: false, error: "No Resend API key configured." };

    const fromAddress = this.config.extraConfig?.fromAddress;
    if (!fromAddress) return { sent: false, error: "No 'From' address configured." };

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return { sent: false, error: `Resend API error (${res.status}): ${body.slice(0, 200)}` };
      }
      return { sent: true };
    } catch (err) {
      return { sent: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
