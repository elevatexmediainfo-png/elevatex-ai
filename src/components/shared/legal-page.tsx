import { Container } from "@/components/shared/container";

// Shared structure for /privacy, /terms, /cookies — this codebase has no
// Tailwind typography ("prose") plugin installed, so long-form legal copy
// is styled with the same heading/body utility classes every other page
// uses, not a plugin dependency added just for three pages.
export function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <Container className="max-w-2xl py-16 lg:py-24">
      <h1 className="text-heading-1 text-neutral-900">{title}</h1>
      <p className="mt-1 text-body-sm text-neutral-500">Last updated: {lastUpdated}</p>
      <div className="mt-8 flex flex-col gap-8 text-body-md text-neutral-700 [&_a]:text-brand-navy [&_a]:underline [&_h2]:text-heading-2 [&_h2]:text-neutral-900 [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2">
        {children}
      </div>
    </Container>
  );
}
