import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { uuid } from "./uuid";

describe("uuid()", () => {
  let originalRandomUUID: (() => string) | undefined;

  beforeEach(() => {
    originalRandomUUID = (globalThis as any).crypto?.randomUUID;
  });

  afterEach(() => {
    if (originalRandomUUID === undefined) {
      delete (globalThis as any).crypto.randomUUID;
    } else {
      (globalThis as any).crypto.randomUUID = originalRandomUUID;
    }
  });

  it("uses crypto.randomUUID when available", () => {
    const fake = "123e4567-e89b-42d3-a456-426614174000";
    vi.stubGlobal("crypto", {
      randomUUID: () => fake,
      getRandomValues: vi.fn(),
    } as unknown as Crypto);
    expect(uuid()).toBe(fake);
  });

  it("falls back to getRandomValues when randomUUID is undefined", () => {
    const getRandomValues = vi.fn((b: Uint8Array) => {
      // fill with known bytes: version 4, variant 1
      const known = [
        0x12, 0x3e, 0x45, 0x67, 0xe8, 0x9b, 0x42, 0xd3,
        0xa4, 0x56, 0x42, 0x66, 0x14, 0x17, 0x40, 0x00,
      ];
      b.set(known);
    });
    vi.stubGlobal("crypto", {
      randomUUID: undefined,
      getRandomValues,
    } as unknown as Crypto);

    const result = uuid();
    expect(getRandomValues).toHaveBeenCalled();
    expect(result).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });
});
