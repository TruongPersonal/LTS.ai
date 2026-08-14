import { useCallback, useState } from 'react';
import type { SubtitleItem } from '../types/database';

export interface TimingDraft {
  start: string;
  end: string;
}

export const useEditorDraft = () => {
  const [editingTimingCueId, setEditingTimingCueId] = useState<number | null>(null);
  const [timingDraft, setTimingDraft] = useState<TimingDraft | null>(null);

  const [editingTextCueId, setEditingTextCueId] = useState<number | null>(null);
  const [textDraft, setTextDraft] = useState<string | null>(null);
  const [sourceDraft, setSourceDraft] = useState<string | null>(null);

  const startEditingTiming = useCallback((cue: SubtitleItem) => {
    setEditingTimingCueId(cue.id);
    setTimingDraft({
      start: String(cue.start),
      end: String(cue.end),
    });
  }, []);

  const cancelEditingTiming = useCallback(() => {
    setEditingTimingCueId(null);
    setTimingDraft(null);
  }, []);

  const startEditingText = useCallback((cue: SubtitleItem, currentSourceText: string) => {
    setEditingTextCueId(cue.id);
    setTextDraft(cue.text);
    setSourceDraft(currentSourceText);
  }, []);

  const cancelEditingText = useCallback(() => {
    setEditingTextCueId(null);
    setTextDraft(null);
    setSourceDraft(null);
  }, []);

  const clearAllDrafts = useCallback(() => {
    setEditingTimingCueId(null);
    setTimingDraft(null);
    setEditingTextCueId(null);
    setTextDraft(null);
    setSourceDraft(null);
  }, []);

  return {
    editingTimingCueId,
    timingDraft,
    setTimingDraft,
    startEditingTiming,
    cancelEditingTiming,

    editingTextCueId,
    textDraft,
    setTextDraft,
    sourceDraft,
    setSourceDraft,
    startEditingText,
    cancelEditingText,

    clearAllDrafts,
  };
};
