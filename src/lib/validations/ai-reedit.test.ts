import { describe, expect, it } from "vitest";
import { aiReeditResponseSchema } from "./ai-reedit";

describe("aiReeditResponseSchema", () => {
  it("accepts a valid remove_effect (zoom)", () => {
    const result = aiReeditResponseSchema.safeParse({ action: "remove_effect", effect: "zoom" });
    expect(result.success).toBe(true);
  });

  it("accepts a valid remove_effect (transition_before/transition_after)", () => {
    expect(aiReeditResponseSchema.safeParse({ action: "remove_effect", effect: "transition_before" }).success).toBe(true);
    expect(aiReeditResponseSchema.safeParse({ action: "remove_effect", effect: "transition_after" }).success).toBe(true);
  });

  it("rejects remove_effect with an invented effect type", () => {
    const result = aiReeditResponseSchema.safeParse({ action: "remove_effect", effect: "blur" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid change_asset", () => {
    const result = aiReeditResponseSchema.safeParse({ action: "change_asset", searchQuery: "city skyline at night" });
    expect(result.success).toBe(true);
  });

  it("rejects change_asset with an empty searchQuery", () => {
    expect(aiReeditResponseSchema.safeParse({ action: "change_asset", searchQuery: "" }).success).toBe(false);
  });

  it("accepts adjust_transform with a numeric value for scale/rotation/opacity", () => {
    expect(aiReeditResponseSchema.safeParse({ action: "adjust_transform", property: "scale", value: 150 }).success).toBe(true);
    expect(aiReeditResponseSchema.safeParse({ action: "adjust_transform", property: "rotation", value: 45 }).success).toBe(true);
    expect(aiReeditResponseSchema.safeParse({ action: "adjust_transform", property: "opacity", value: 50 }).success).toBe(true);
  });

  it("accepts adjust_transform with an {x,y} value for position", () => {
    const result = aiReeditResponseSchema.safeParse({ action: "adjust_transform", property: "position", value: { x: 10, y: -5 } });
    expect(result.success).toBe(true);
  });

  it("rejects adjust_transform when property is position but value is a plain number (the .refine() guard)", () => {
    const result = aiReeditResponseSchema.safeParse({ action: "adjust_transform", property: "position", value: 100 });
    expect(result.success).toBe(false);
  });

  it("rejects adjust_transform when property is scale but value is an {x,y} object", () => {
    const result = aiReeditResponseSchema.safeParse({ action: "adjust_transform", property: "scale", value: { x: 1, y: 2 } });
    expect(result.success).toBe(false);
  });

  it("accepts change_caption_style with a partial reveal update", () => {
    const result = aiReeditResponseSchema.safeParse({ action: "change_caption_style", reveal: { mode: "KARAOKE" } });
    expect(result.success).toBe(true);
  });

  it("accepts change_caption_style with only color/fontSize, no reveal", () => {
    const result = aiReeditResponseSchema.safeParse({ action: "change_caption_style", color: "#FF0000", fontSize: 48 });
    expect(result.success).toBe(true);
  });

  it("accepts a bare delete_clip", () => {
    expect(aiReeditResponseSchema.safeParse({ action: "delete_clip" }).success).toBe(true);
  });

  it("accepts a valid cannot_do with a message", () => {
    const result = aiReeditResponseSchema.safeParse({ action: "cannot_do", message: "This clip has no zoom effect to remove." });
    expect(result.success).toBe(true);
  });

  it("rejects cannot_do with an empty message (the escape hatch must always explain itself)", () => {
    expect(aiReeditResponseSchema.safeParse({ action: "cannot_do", message: "" }).success).toBe(false);
  });

  it("rejects an unrecognized action entirely (no arbitrary operations)", () => {
    const result = aiReeditResponseSchema.safeParse({ action: "run_arbitrary_script", code: "rm -rf /" });
    expect(result.success).toBe(false);
  });

  it("rejects a response missing the action field", () => {
    expect(aiReeditResponseSchema.safeParse({ effect: "zoom" }).success).toBe(false);
  });
});
