import { encode } from "next-auth/jwt";
async function main() {
  const token = await encode({
    token: { id: "cmqzh6y1s0000fwu7l68dj1j0", onboardingCompleted: true, role: "USER", sub: "cmqzh6y1s0000fwu7l68dj1j0" },
    secret: process.env.AUTH_SECRET!,
    salt: "authjs.session-token",
  });
  console.log(token);
}
main();
