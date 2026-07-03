import { describe, expect, it, vi } from "vitest";
import { RandomClickDetector } from "@/lib/randomClickDetector";

describe("RandomClickDetector", () => {
  it("emits after 3 fast wrong answers", () => {
    vi.useFakeTimers();
    const d = new RandomClickDetector();
    const t0 = Date.now();
    vi.setSystemTime(t0);
    expect(d.record(0, false)).toBe(false);
    vi.setSystemTime(t0 + 1000);
    expect(d.record(1, false)).toBe(false);
    vi.setSystemTime(t0 + 2000);
    expect(d.record(2, false)).toBe(true);
    vi.useRealTimers();
  });

  it("does not emit when answers are slow", () => {
    vi.useFakeTimers();
    const d = new RandomClickDetector();
    const t0 = Date.now();
    vi.setSystemTime(t0);
    d.record(0, false);
    vi.setSystemTime(t0 + 4000);
    d.record(1, false);
    vi.setSystemTime(t0 + 8000);
    expect(d.record(2, false)).toBe(false);
    vi.useRealTimers();
  });

  it("does not emit twice", () => {
    vi.useFakeTimers();
    const d = new RandomClickDetector();
    const t0 = Date.now();
    vi.setSystemTime(t0);
    d.record(0, false);
    vi.setSystemTime(t0 + 500);
    d.record(1, false);
    vi.setSystemTime(t0 + 1000);
    expect(d.record(2, false)).toBe(true);
    vi.setSystemTime(t0 + 1500);
    expect(d.record(3, false)).toBe(false);
    vi.useRealTimers();
  });
});
