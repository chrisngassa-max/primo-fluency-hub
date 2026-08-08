import coLevelContractsData from "../referential/co_level_contracts_v1.json" with { type: "json" };
import type { CoA2LevelContract } from "./types.ts";

interface CoLevelContractsFile {
  version: string;
  status: string;
  competence: "CO";
  levels: { A2: CoA2LevelContract };
}

const data = coLevelContractsData as CoLevelContractsFile;

export function getCoA2LevelContract(): {
  version: string;
  status: string;
  contract: CoA2LevelContract;
} {
  return {
    version: data.version,
    status: data.status,
    contract: data.levels.A2,
  };
}
