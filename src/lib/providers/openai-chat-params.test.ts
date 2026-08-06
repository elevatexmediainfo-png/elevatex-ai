import { describe, expect, it } from "vitest";

import { chatTemperatureParam, isOpenAIReasoningModel, supportsCustomTemperature } from "./openai-chat-params";

// Fix (2026-08-06) — real production incident: OpenAI's reasoning-tier
// models (o-series, gpt-5 family) reject any non-default `temperature`
// value via the Chat Completions API. Detection is by model-NAME
// convention, not a fixed exact-id list — these tests cover both known
// reasoning-tier prefixes and future/unseen variants of the same prefix.

describe("isOpenAIReasoningModel", () => {
  it("recognizes every GPT-5 family variant, not just the bare 'gpt-5' id", () => {
    expect(isOpenAIReasoningModel("gpt-5")).toBe(true);
    expect(isOpenAIReasoningModel("gpt-5-mini")).toBe(true);
    expect(isOpenAIReasoningModel("gpt-5-nano")).toBe(true);
    expect(isOpenAIReasoningModel("gpt-5.1")).toBe(true);
    expect(isOpenAIReasoningModel("gpt-5.1-mini")).toBe(true);
  });

  it("recognizes the o-series reasoning models", () => {
    expect(isOpenAIReasoningModel("o1")).toBe(true);
    expect(isOpenAIReasoningModel("o1-mini")).toBe(true);
    expect(isOpenAIReasoningModel("o1-pro")).toBe(true);
    expect(isOpenAIReasoningModel("o3")).toBe(true);
    expect(isOpenAIReasoningModel("o3-mini")).toBe(true);
    expect(isOpenAIReasoningModel("o4-mini")).toBe(true);
  });

  it("is case-insensitive (an admin-typed model id might not be lowercase)", () => {
    expect(isOpenAIReasoningModel("GPT-5")).toBe(true);
    expect(isOpenAIReasoningModel("O1-Mini")).toBe(true);
  });

  it("does NOT flag a non-reasoning chat model", () => {
    expect(isOpenAIReasoningModel("gpt-4o")).toBe(false);
    expect(isOpenAIReasoningModel("gpt-4o-mini")).toBe(false);
    expect(isOpenAIReasoningModel("gpt-4.1")).toBe(false);
    expect(isOpenAIReasoningModel("gpt-3.5-turbo")).toBe(false);
  });

  it("does not false-positive on an unrelated model name that merely contains 'o' followed by a digit mid-string", () => {
    // Only a LEADING o<digit> or gpt-5 prefix counts — a model name that
    // happens to contain a similar substring elsewhere must not match.
    expect(isOpenAIReasoningModel("photo1-vision")).toBe(false);
  });

  it("tolerates surrounding whitespace from a sloppily-configured model id", () => {
    expect(isOpenAIReasoningModel("  gpt-5  ")).toBe(true);
  });
});

describe("supportsCustomTemperature", () => {
  it("is the exact inverse of isOpenAIReasoningModel", () => {
    expect(supportsCustomTemperature("gpt-5")).toBe(false);
    expect(supportsCustomTemperature("gpt-4o-mini")).toBe(true);
  });
});

describe("chatTemperatureParam", () => {
  it("omits temperature entirely for a reasoning-tier model", () => {
    expect(chatTemperatureParam("gpt-5", 0.4)).toEqual({});
    expect(chatTemperatureParam("o1-mini", 0.7)).toEqual({});
  });

  it("includes the given temperature for a model that supports it", () => {
    expect(chatTemperatureParam("gpt-4o-mini", 0.4)).toEqual({ temperature: 0.4 });
  });

  it("produces a request body with no temperature key at all when spread (never an explicit undefined)", () => {
    const body = { model: "gpt-5", ...chatTemperatureParam("gpt-5", 0.4) };
    expect("temperature" in body).toBe(false);
    expect(JSON.stringify(body)).not.toContain("temperature");
  });
});
