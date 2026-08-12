export type CueVisibilityKey = 'metadata' | 'source';

export interface CueVisibility {
  metadata: boolean;
  source: boolean;
}

export type CueVisibilityOverride = Partial<CueVisibility>;
export type CueVisibilityOverrides = Record<number, CueVisibilityOverride>;

export const DEFAULT_CUE_VISIBILITY: CueVisibility = {
  metadata: true,
  source: true,
};

export const resolveCueVisibility = (
  globalVisibility: CueVisibility,
  override?: CueVisibilityOverride,
): CueVisibility => ({
  metadata: override?.metadata ?? globalVisibility.metadata,
  source: override?.source ?? globalVisibility.source,
});

export const toggleCueVisibilityOverride = (
  overrides: CueVisibilityOverrides,
  cueId: number,
  key: CueVisibilityKey,
  currentResolvedValue: boolean,
): CueVisibilityOverrides => ({
  ...overrides,
  [cueId]: {
    ...(overrides[cueId] ?? {}),
    [key]: !currentResolvedValue,
  },
});

export const applyGlobalCueVisibilityChange = (
  globalVisibility: CueVisibility,
  overrides: CueVisibilityOverrides,
  key: CueVisibilityKey,
  value: boolean,
): { globalVisibility: CueVisibility; overrides: CueVisibilityOverrides } => {
  const nextOverrides: CueVisibilityOverrides = {};

  for (const [cueId, override] of Object.entries(overrides)) {
    const { [key]: _removed, ...remaining } = override;
    if (Object.keys(remaining).length > 0) nextOverrides[Number(cueId)] = remaining;
  }

  return {
    globalVisibility: { ...globalVisibility, [key]: value },
    overrides: nextOverrides,
  };
};
