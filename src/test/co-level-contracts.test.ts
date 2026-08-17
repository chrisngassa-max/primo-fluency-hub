import { describe, expect, it } from "vitest";
import {
  getCoA2LevelContract,
  getCoLevelContract,
  isKnownCoLevel,
  listCoLevelContracts,
} from "../../supabase/functions/_shared/differentiation/co-level-contract-loader.ts";

describe("co_level_contracts_v1 referential", () => {
  it("loads A1/A2/B1/B2 contracts", () => {
    expect(listCoLevelContracts()).toEqual(["A1", "A2", "B1", "B2"]);
    expect(getCoLevelContract("A1").version).toBe("1.2");
    expect(getCoLevelContract("A1").contract.volume_items_min).toBe(3);
    expect(getCoLevelContract("A1").contract.volume_items_max).toBe(4);
    expect(getCoLevelContract("A1").contract.qcm_max_choices).toBe(3);
    expect(getCoLevelContract("A1").contract.implicit_allowed).toBe(false);

    const a2 = getCoA2LevelContract().contract;
    expect(getCoA2LevelContract().version).toBe("1.2");
    expect(a2.target_level).toBe("A2");
    expect(a2.volume_items_min).toBe(4);
    expect(a2.volume_items_max).toBe(6);
    expect(a2.implicit_allowed).toBe(false);

    expect(getCoLevelContract("B1").contract.volume_items_min).toBe(5);
    expect(getCoLevelContract("B1").contract.allowed_formats).toContain("ordre_chronologique");
    expect(getCoLevelContract("B1").contract.implicit_allowed).toBe("verifiable_only");

    expect(getCoLevelContract("B2").contract.volume_items_max).toBe(8);
    expect(getCoLevelContract("B2").contract.implicit_allowed).toBe("supported_multi_fact");
  });

  it("refuses unknown contracts", () => {
    expect(isKnownCoLevel("C1")).toBe(false);
    expect(() => getCoLevelContract("C1" as any)).toThrow(/CO_LEVEL_CONTRACT_UNKNOWN/);
  });
});
