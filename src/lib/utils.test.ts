import { describe, expect, it } from "vitest";
import { cn } from "./utils";

// Regression coverage for a real, silent bug found live (2026-07-15):
// tailwind-merge can't infer a custom @theme token's classGroup from its
// name alone, so an unregistered custom font-size/color/height class
// combined with ANY other class sharing the same utility prefix ("text-",
// "h-") gets treated as one conflicting group — keeping only whichever
// came last and silently dropping the other from the DOM. This doesn't
// throw or warn; it just renders at the wrong (usually default/larger)
// size with no error anywhere, which is exactly why it went unnoticed
// until a live density pass measured actual computed font sizes.
describe("cn() — custom @theme token classGroup registration", () => {
  it("keeps both an editor font-size class and an editor text-color class (the exact combo that silently dropped text-nano before this was fixed)", () => {
    const result = cn("text-nano font-medium transition-colors", "bg-editor-accent/20 text-editor-accent");
    expect(result).toContain("text-nano");
    expect(result).toContain("text-editor-accent");
  });

  it("keeps text-editor-caption alongside text-editor-accent (the sub-nav active-item pattern that dropped the caption size)", () => {
    const result = cn("rounded-md px-3 py-2 text-editor-caption", "font-semibold text-editor-accent");
    expect(result).toContain("text-editor-caption");
    expect(result).toContain("text-editor-accent");
  });

  it("lets a later explicit text color still win over an earlier one (still a real conflict, should still resolve)", () => {
    const result = cn("text-editor-accent", "text-editor-danger");
    expect(result).not.toContain("text-editor-accent");
    expect(result).toContain("text-editor-danger");
  });

  it("keeps a later h-8 override over editorPrimary's own baked-in h-editor-button-height (the Import-button bug)", () => {
    const result = cn("h-editor-button-height min-w-[120px]", "h-8 gap-1.5 rounded-md px-3");
    expect(result).not.toContain("h-editor-button-height");
    expect(result).toContain("h-8");
  });

  it("still dedupes two conflicting standard Tailwind height classes normally (sanity check the fix didn't disable real conflict resolution)", () => {
    const result = cn("h-8", "h-10");
    expect(result).not.toContain("h-8");
    expect(result).toContain("h-10");
  });
});
