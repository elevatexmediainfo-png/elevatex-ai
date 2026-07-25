import type { EmailProvider, SendEmailInput, SendEmailResult } from "./types";

// Dev default — logs instead of sending, same role Mock plays for every
// other provider category.
export class MockEmailProvider implements EmailProvider {
  async send(input: SendEmailInput): Promise<SendEmailResult> {
    console.log(`[MockEmailProvider] would send to ${input.to}: "${input.subject}"`);
    return { sent: true };
  }
}
