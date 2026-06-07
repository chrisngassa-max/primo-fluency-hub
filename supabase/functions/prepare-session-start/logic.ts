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
