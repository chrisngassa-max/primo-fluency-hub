import coLevelContractsData from "../referential/co_level_contracts_v1.json" with { type: "json" };
import type { CoLevelContract, SliceLevel } from "./types.ts";
import { SLICE_LEVELS } from "./types.ts";

/** Version référentielle embarquée par les nouvelles familles multi-niveaux. */
export const CURRENT_CO_REFERENTIAL_VERSION = "1.1";
/** Version historique du Vertical Slice A2-only. */
export const LEGACY_CO_A2_REFERENTIAL_VERSION = "1.0";
/** Contrat de schéma slice inchangé (élargissement rétrocompatible documenté). */
export const SLICE_SCHEMA_VERSION = "slice-1.0" as const;

interface CoLevelContractsFile {
  version: string;
  status: string;
  competence: "CO";
  levels: Record<SliceLevel, CoLevelContract>;
  changelog?: Record<string, string>;
}

const data = coLevelContractsData as CoLevelContractsFile;

export function getCoLevelContractsFile(): CoLevelContractsFile {
  return data;
}

export function getCoLevelContract(level: SliceLevel): {
  version: string;
  status: string;
  contract: CoLevelContract;
} {
  const contract = data.levels[level];
  if (!contract) {
    throw new Error(`CO_LEVEL_CONTRACT_UNKNOWN:${level}`);
  }
  return {
    version: data.version,
    status: data.status,
    contract,
  };
}

/** @deprecated Prefer getCoLevelContract("A2"). */
export function getCoA2LevelContract(): {
  version: string;
  status: string;
  contract: CoLevelContract;
} {
  return getCoLevelContract("A2");
}

export function listCoLevelContracts(): SliceLevel[] {
  return SLICE_LEVELS.filter((level) => Boolean(data.levels[level]));
}

export function isKnownCoLevel(level: string): level is SliceLevel {
  return (SLICE_LEVELS as readonly string[]).includes(level) && Boolean(data.levels[level as SliceLevel]);
}
