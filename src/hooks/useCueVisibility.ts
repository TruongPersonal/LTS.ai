import { useCallback, useState } from 'react';
import {
  DEFAULT_CUE_VISIBILITY,
  applyGlobalCueVisibilityChange,
  resolveCueVisibility,
  toggleCueVisibilityOverride,
  type CueVisibility,
  type CueVisibilityKey,
  type CueVisibilityOverrides,
} from '../utils/cueVisibility';

export const useCueVisibility = () => {
  const [globalVisibility, setGlobalVisibility] = useState<CueVisibility>(DEFAULT_CUE_VISIBILITY);
  const [cueVisibilityOverrides, setCueVisibilityOverrides] = useState<CueVisibilityOverrides>({});
  const [cueActionsVisible, setCueActionsVisible] = useState(true);

  const toggleGlobal = useCallback((key: CueVisibilityKey) => {
    setGlobalVisibility((prevGlobal) => {
      const nextValue = !prevGlobal[key];
      const result = applyGlobalCueVisibilityChange(prevGlobal, cueVisibilityOverrides, key, nextValue);
      setCueVisibilityOverrides(result.overrides);
      return result.globalVisibility;
    });
  }, [cueVisibilityOverrides]);

  const toggleCueOverride = useCallback(
    (cueId: number, key: CueVisibilityKey, currentResolvedValue: boolean) => {
      setCueVisibilityOverrides((prev) =>
        toggleCueVisibilityOverride(prev, cueId, key, currentResolvedValue)
      );
    },
    []
  );

  const getResolvedVisibility = useCallback(
    (cueId: number): CueVisibility => {
      return resolveCueVisibility(globalVisibility, cueVisibilityOverrides[cueId]);
    },
    [globalVisibility, cueVisibilityOverrides]
  );

  return {
    globalVisibility,
    cueVisibilityOverrides,
    cueActionsVisible,
    setCueActionsVisible,
    toggleGlobal,
    toggleCueOverride,
    getResolvedVisibility,
  };
};
