import { Container } from "@/components/shared/container";
import { BrandKitClient } from "./brand-kit-client";

export default function BrandKitPage() {
  return (
    <Container className="flex max-w-3xl flex-col gap-10 py-10">
      <div>
        <h1 className="text-heading-1 text-dash-ink">Brand Kit</h1>
        <p className="mt-1 text-body-md text-dash-ink/55">
          Your logo, colors, and guidelines — generate them with AI or set them manually. Applied
          automatically across your videos and creatives.
        </p>
      </div>
      <BrandKitClient />
    </Container>
  );
}
