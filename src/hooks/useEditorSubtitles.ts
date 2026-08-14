import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SubtitleItem } from '../types/database';
import { subtitleService } from '../services/subtitleService';
import { insertCueAfter, removeCue } from '../utils/subtitleEditor';

interface UseEditorSubtitlesParams {
  fileId: string;
  detectedSourceLang: string | null;
  targetLanguage: string;
  onDirtyChange?: (dirty: boolean) => void;
}

export const useEditorSubtitles = ({
  fileId,
  detectedSourceLang,
  targetLanguage,
  onDirtyChange,
}: UseEditorSubtitlesParams) => {
  const { t } = useTranslation();
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([]);
  const [sourceSubtitles, setSourceSubtitles] = useState<SubtitleItem[]>([]);
  const [sourceLanguage, setSourceLanguage] = useState<string | null>(detectedSourceLang);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const markDirty = useCallback(
    (dirty: boolean) => {
      setIsDirty(dirty);
      onDirtyChange?.(dirty);
    },
    [onDirtyChange]
  );

  const loadSubtitles = useCallback(async () => {
    if (!fileId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const pair = await subtitleService.getSubtitlePair(fileId, detectedSourceLang, targetLanguage);
      setSourceSubtitles(pair.source?.content || []);
      setSourceLanguage(pair.source?.language || detectedSourceLang);
      setSubtitles(pair.target?.content || []);
      markDirty(false);
      setSaveError(null);
    } catch (error) {
      console.error('Error loading subtitles:', error);
      setLoadError(t('editor.loadError'));
    } finally {
      setLoading(false);
    }
  }, [fileId, detectedSourceLang, targetLanguage, markDirty, t]);

  useEffect(() => {
    void loadSubtitles();
  }, [loadSubtitles]);

  const saveSubtitles = useCallback(async () => {
    if (!fileId || saving) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await subtitleService.saveSubtitles(fileId, targetLanguage, subtitles);
      if (sourceLanguage) {
        await subtitleService.saveSubtitles(fileId, sourceLanguage, sourceSubtitles);
      }
      markDirty(false);
      setSaveSuccess(true);
      window.setTimeout(() => setSaveSuccess(false), 2500);
    } catch (error) {
      console.error('Error saving subtitles:', error);
      setSaveError(t('editor.saveError'));
    } finally {
      setSaving(false);
    }
  }, [fileId, saving, targetLanguage, subtitles, sourceLanguage, sourceSubtitles, markDirty, t]);

  const updateCueText = useCallback(
    (cueId: number, targetText?: string, sourceText?: string) => {
      if (targetText !== undefined) {
        setSubtitles((prev) =>
          prev.map((c) => (c.id === cueId ? { ...c, text: targetText } : c))
        );
      }
      if (sourceText !== undefined) {
        setSourceSubtitles((prev) =>
          prev.map((c) => (c.id === cueId ? { ...c, text: sourceText } : c))
        );
      }
      markDirty(true);
    },
    [markDirty]
  );

  const updateCueTiming = useCallback(
    (cueId: number, start: number, end: number) => {
      setSubtitles((prev) =>
        prev.map((c) => (c.id === cueId ? { ...c, start, end } : c))
      );
      setSourceSubtitles((prev) =>
        prev.map((c) => (c.id === cueId ? { ...c, start, end } : c))
      );
      markDirty(true);
    },
    [markDirty]
  );

  const addCue = useCallback(
    (afterId?: number) => {
      const nextTarget = insertCueAfter(subtitles, afterId);
      const nextSource = insertCueAfter(sourceSubtitles, afterId);
      setSubtitles(nextTarget);
      setSourceSubtitles(nextSource);
      markDirty(true);
    },
    [subtitles, sourceSubtitles, markDirty]
  );

  const deleteCue = useCallback(
    (cueId: number) => {
      setSubtitles((prev) => removeCue(prev, cueId));
      setSourceSubtitles((prev) => removeCue(prev, cueId));
      markDirty(true);
    },
    [markDirty]
  );

  return {
    subtitles,
    sourceSubtitles,
    sourceLanguage,
    loading,
    loadError,
    saving,
    isDirty,
    saveSuccess,
    saveError,
    loadSubtitles,
    saveSubtitles,
    updateCueText,
    updateCueTiming,
    addCue,
    deleteCue,
    markDirty,
  };
};
