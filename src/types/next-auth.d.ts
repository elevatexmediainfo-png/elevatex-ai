import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      phone?: string | null;
      onboardingCompleted: boolean;
      role: "USER" | "ADMIN";
    } & DefaultSession["user"];
  }

  interface User {
    phone?: string | null;
    onboardingCompleted?: boolean;
    role?: "USER" | "ADMIN";
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    onboardingCompleted: boolean;
    role: "USER" | "ADMIN";
  }
}
