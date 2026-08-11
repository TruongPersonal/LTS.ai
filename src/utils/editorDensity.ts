export type EditorCueDensity = 'full' | 'compact' | 'focus';

export const getEditorCueDensity = (
  metadataVisible: boolean,
  sourceVisible: boolean,
  actionsVisible: boolean,
): EditorCueDensity => {
  if (!metadataVisible && !sourceVisible && !actionsVisible) return 'focus';
  if (!metadataVisible || !sourceVisible || !actionsVisible) return 'compact';
  return 'full';
};
