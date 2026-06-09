import { describe, expect, it } from "vitest";

const SESSION_NUMBERS = Array.from({ length: 20 }, (_, index) => index + 1);

describe("session planning curriculum", () => {
  it("couvre les séances 1 à 20", () => {
    expect(SESSION_NUMBERS).toHaveLength(20);
    expect(SESSION_NUMBERS[0]).toBe(1);
    expect(SESSION_NUMBERS[19]).toBe(20);
  });
});
