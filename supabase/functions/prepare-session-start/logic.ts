export type BlockType = "retrospective" | "diagnostic" | "core";

export function determineBlocksToLaunch(
  generationAutomatiqueActivee: boolean,
  requestedBlock: string | null
): { blocks: BlockType[]; automatic: boolean } {
  if (!generationAutomatiqueActivee && !requestedBlock) {
    return { blocks: [], automatic: false };
  }

  const allowedBlocks: BlockType[] = ["retrospective", "diagnostic", "core"];
  if (requestedBlock) {
    if (allowedBlocks.includes(requestedBlock as BlockType)) {
      return { blocks: [requestedBlock as BlockType], automatic: false };
    }
    return { blocks: [], automatic: false };
  }

  return { blocks: allowedBlocks, automatic: true };
}

export interface RetrospectiveCalibration {
  count: number;
  durationMinutes: number;
  estimatedMinutes: number;
  warning: string | null;
}

export function calibrateRetrospective(
  configuredCount: unknown,
  configuredDuration: unknown
): RetrospectiveCalibration {
  const parsedCount = Number(configuredCount);
  const parsedDuration = Number(configuredDuration);
  const count = Number.isFinite(parsedCount)
    ? Math.min(30, Math.max(1, Math.round(parsedCount)))
    : 3;
  const durationMinutes = Number.isFinite(parsedDuration)
    ? Math.min(60, Math.max(1, Math.round(parsedDuration)))
    : 10;
  const estimatedMinutes = count * 3;
  const warning = estimatedMinutes > durationMinutes
    ? `${count} exercices sont demandes pour ${durationMinutes} min. Prevoir environ ${estimatedMinutes} min ou reduire le volume. Le nombre choisi a ete conserve.`
    : null;

  return { count, durationMinutes, estimatedMinutes, warning };
}
