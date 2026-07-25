import { listEnabledProviderConfigs, resolveProviderCredentials } from "../credentials";
import { MockEmailProvider } from "./mock.provider";
import { ResendEmailProvider } from "./resend.provider";
import type { EmailProvider } from "./types";

export * from "./types";

// EMAIL has no failover concept, same as PAYMENT/STORAGE — whichever
// provider id is first (the single active driver) is used.
export async function getEmailProvider(): Promise<EmailProvider> {
  const [selection] = await listEnabledProviderConfigs("EMAIL");
  switch (selection) {
    case "resend":
      return new ResendEmailProvider(await resolveProviderCredentials("EMAIL", "resend"));
    case "mock":
    default:
      return new MockEmailProvider();
  }
}
