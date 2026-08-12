import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { FileMedia, Project, SubtitleItem } from '../types/database';
import { getLanguageOption } from '../types/project';
import { subtitleService } from '../services/subtitleService';
import { VideoPlayer } from '../components/editor/VideoPlayer';
import { ExportModal } from '../components/editor/ExportModal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { CueVisibilityMenu } from '../components/editor/CueVisibilityMenu';
import { CueCard } from '../components/editor/CueCard';
import type { SubtitleExportFormat, SubtitleExportTrack } from '../utils/exporter';
import { downloadSubtitleFile } from '../utils/exporter';
import { formatDisplayTime } from '../utils/time';
import { findActiveCueId, getSourceTextById, insertCueAfter, removeCue } from '../utils/subtitleEditor';
import {
  DEFAULT_CUE_VISIBILITY,
  applyGlobalCueVisibilityChange,
  resolveCueVisibility,
  toggleCueVisibilityOverride,
  type CueVisibilityKey,
  type CueVisibilityOverrides,
} from '../utils/cueVisibility';
import { getGoogleAccessToken } from '../lib/supabase';
import { getEditorCueDensity } from '../utils/editorDensity';

interface EditorPageProps {
  file: FileMedia;
  project: Project;
  routeLoading?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onBack: () => void;
}

interface TimingDraft { start: string; end: string; }

export const EditorPage: React.FC<EditorPageProps> = ({ file, project, routeLoading = false, onDirtyChange, onBack }) => {
  const [cueActionsVisible, setCueActionsVisible] = useState(true);
  const { t } = useTranslation();
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([]);
  const [sourceSubtitles, setSourceSubtitles] = useState<SubtitleItem[]>([]);
  const [sourceLanguage, setSourceLanguage] = useState<string | null>(file.detected_source_lang);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [editingTimingCueId, setEditingTimingCueId] = useState<number | null>(null);
  const [timingDraft, setTimingDraft] = useState<TimingDraft | null>(null);
  const [editingTextCueId, setEditingTextCueId] = useState<number | null>(null);
  const [textDraft, setTextDraft] = useState<string | null>(null);
  const [sourceDraft, setSourceDraft] = useState<string | null>(null);
  const [globalCueVisibility, setGlobalCueVisibility] = useState(DEFAULT_CUE_VISIBILITY);
  const [cueVisibilityOverrides, setCueVisibilityOverrides] = useState<CueVisibilityOverrides>({});
  const [cuePendingDelete, setCuePendingDelete] = useState<number | null>(null);
  const [showUnsavedExitDialog, setShowUnsavedExitDialog] = useState(false);
  const cueRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const cueViewportRef = useRef<HTMLDivElement>(null);

  const getNativeLanguageName = (code: string | null | undefined): string => {
    if (!code) return 'English';
    const opt = getLanguageOption(code.toLowerCase());
    if (opt) return opt.nativeName;
    return code;
  };

  const activeCueId = findActiveCueId(subtitles, currentTime);
  const sourceLanguageLabel = getNativeLanguageName(sourceLanguage || file.detected_source_lang);
  const targetLanguageLabel = getNativeLanguageName(project.target_language);
  const editingTextCue = editingTextCueId === null ? null : subtitles.find((subtitle) => subtitle.id === editingTextCueId) ?? null;
  const hasPendingTextChange = Boolean(
    (editingTextCue && textDraft !== null && editingTextCue.text !== textDraft) ||
    (editingTextCueId !== null && sourceDraft !== null && getSourceTextById(sourceSubtitles, editingTextCueId) !== sourceDraft)
  );
  const hasUnsavedChanges = isDirty || hasPendingTextChange;
  const cueDensity = getEditorCueDensity(
    globalCueVisibility.metadata,
    globalCueVisibility.source,
    cueActionsVisible,
  );

  const loadSubtitles = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const pair = await subtitleService.getSubtitlePair(file.id, file.detected_source_lang, project.target_language);
      setSourceSubtitles(pair.source?.content || []);
      setSourceLanguage(pair.source?.language || file.detected_source_lang);
      setSubtitles(pair.target?.content || []);
      setIsDirty(false);
      setSaveError(null);
    } catch (error) {
      console.error('Error loading subtitles:', error);
      setLoadError(t('editor.loadError'));
    } finally { setLoading(false); }
  }, [file.id, file.detected_source_lang, project.target_language, t]);

  const loadVideoBlob = React.useCallback(async () => {
    if (routeLoading) return;
    if (!file.drive_file_id) { setVideoUrl(''); setVideoError(t('editor.video.sessionExpired')); return; }
    setVideoLoading(true); setVideoError(null);
    try {
      const accessToken = await getGoogleAccessToken();
      if (!accessToken) throw new Error(t('editor.video.sessionExpired'));
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.drive_file_id)}?alt=media`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) throw new Error(t('editor.video.sessionExpired'));
      const blob = await response.blob();
      if (blob.size === 0) throw new Error(t('editor.video.emptyFile'));
      setVideoUrl(URL.createObjectURL(blob));
    } catch (error) {
      console.error('Could not fetch authenticated video blob:', error);
      setVideoUrl('');
      setVideoError(error instanceof Error ? error.message : t('editor.video.sessionExpired'));
    } finally { setVideoLoading(false); }
  }, [file.drive_file_id, routeLoading, t]);

  const handleSaveChanges = React.useCallback(async () => {
    if (!hasUnsavedChanges || saving) return;
    const subtitlesToSave = hasPendingTextChange && editingTextCueId !== null && textDraft !== null
      ? subtitles.map((subtitle) => subtitle.id === editingTextCueId ? { ...subtitle, text: textDraft } : subtitle)
      : subtitles;
    setSaving(true); setSaveError(null);
    try {
      await subtitleService.saveSubtitles(file.id, project.target_language, subtitlesToSave);
      setSubtitles(subtitlesToSave);
      setEditingTextCueId(null); setTextDraft(null); setSourceDraft(null); setEditingTimingCueId(null); setTimingDraft(null);
      setIsDirty(false); setSaveSuccess(true);
      window.setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Error saving subtitles:', error);
      setSaveError(t('editor.saveError'));
    } finally { setSaving(false); }
  }, [editingTextCueId, file.id, hasPendingTextChange, hasUnsavedChanges, project.target_language, saving, subtitles, t, textDraft]);

  useEffect(() => { void loadSubtitles(); void loadVideoBlob(); }, [loadSubtitles, loadVideoBlob]);

  useEffect(() => {
    if (activeCueId === null) return;
    const container = cueViewportRef.current;
    const cue = cueRefs.current.get(activeCueId);
    if (!container || !cue) return;
    const top = cue.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    container.scrollTo({ top, behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [activeCueId]);

  useEffect(() => onDirtyChange?.(hasUnsavedChanges), [hasUnsavedChanges, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => { if (!hasUnsavedChanges) return; event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const handleKeyboardSave = (event: KeyboardEvent) => {
      const isSaveShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's';
      if (!isSaveShortcut) return;
      event.preventDefault();
      if (hasUnsavedChanges && !saving) void handleSaveChanges();
    };
    window.addEventListener('keydown', handleKeyboardSave);
    return () => window.removeEventListener('keydown', handleKeyboardSave);
  }, [handleSaveChanges, hasUnsavedChanges, saving]);

  useEffect(() => () => { if (videoUrl.startsWith('blob:')) URL.revokeObjectURL(videoUrl); }, [videoUrl]);

  const handleBack = () => { if (hasUnsavedChanges) { setShowUnsavedExitDialog(true); return; } onBack(); };
  const handleSelectSubtitleCard = (item: SubtitleItem) => setCurrentTime(item.start);
  const handleStartTextEdit = (item: SubtitleItem) => {
    setEditingTextCueId(item.id);
    setTextDraft(item.text);
    setSourceDraft(getSourceTextById(sourceSubtitles, item.id));
    setEditingTimingCueId(item.id);
    setTimingDraft({ start: String(item.start), end: String(item.end) });
    setSaveError(null);
  };
  const handleCancelTextEdit = () => {
    setEditingTextCueId(null);
    setTextDraft(null);
    setSourceDraft(null);
    setEditingTimingCueId(null);
    setTimingDraft(null);
  };
  const handleConfirmTextEdit = (id: number) => {
    if (editingTextCueId !== id && editingTimingCueId !== id) return;
    const subtitlesToSave = subtitles.map((subtitle) => {
      if (subtitle.id !== id) return subtitle;
      let nextStart = subtitle.start;
      let nextEnd = subtitle.end;
      if (timingDraft) {
        const s = Number(timingDraft.start);
        const e = Number(timingDraft.end);
        if (Number.isFinite(s) && Number.isFinite(e) && s >= 0 && e > s) {
          nextStart = s;
          nextEnd = e;
        }
      }
      const nextText = textDraft !== null ? textDraft : subtitle.text;
      return { ...subtitle, start: nextStart, end: nextEnd, text: nextText };
    });
    setSubtitles(subtitlesToSave);

    let sourceSubtitlesToSave = sourceSubtitles;
    if (sourceDraft !== null && sourceSubtitles.length > 0) {
      sourceSubtitlesToSave = sourceSubtitles.map((s) => (s.id === id ? { ...s, text: sourceDraft } : s));
      setSourceSubtitles(sourceSubtitlesToSave);
    }

    setIsDirty(true);
    setSaveError(null);
    setEditingTextCueId(null);
    setTextDraft(null);
    setSourceDraft(null);
    setEditingTimingCueId(null);
    setTimingDraft(null);

    const srcLang = sourceLanguage || file.detected_source_lang;
    const saves = [subtitleService.saveSubtitles(file.id, project.target_language, subtitlesToSave)];
    if (srcLang && sourceSubtitlesToSave.length > 0) {
      saves.push(subtitleService.saveSubtitles(file.id, srcLang, sourceSubtitlesToSave));
    }

    Promise.all(saves)
      .then(() => { setIsDirty(false); setSaveSuccess(true); window.setTimeout(() => setSaveSuccess(false), 2000); })
      .catch((err) => { console.error('Auto-save failed:', err); setSaveError(t('editor.saveError')); });
  };

  const handleGlobalVisibilityChange = (key: CueVisibilityKey, value: boolean) => {
    const next = applyGlobalCueVisibilityChange(globalCueVisibility, cueVisibilityOverrides, key, value);
    setGlobalCueVisibility(next.globalVisibility);
    setCueVisibilityOverrides(next.overrides);
    if (key === 'metadata' && !value) handleCancelTextEdit();
  };
  const handleCueVisibilityToggle = (cueId: number, key: CueVisibilityKey, currentResolvedValue: boolean) => {
    setCueVisibilityOverrides((current) => toggleCueVisibilityOverride(current, cueId, key, currentResolvedValue));
    if (key === 'metadata' && currentResolvedValue && editingTimingCueId === cueId) handleCancelTextEdit();
  };
  const handleToggleCueActions = () => {
    const nextVisible = !cueActionsVisible;
    if (!nextVisible) handleCancelTextEdit();
    setCueActionsVisible(nextVisible);
  };
  const handleAddCue = (afterId?: number) => {
    const targetAfterId = afterId ?? activeCueId ?? (subtitles.length > 0 ? subtitles[subtitles.length - 1].id : undefined);

    setSubtitles((current) => {
      const updated = current.length === 0
        ? [{ id: 1, start: Math.max(0, currentTime), end: Math.max(0, currentTime) + 2, text: '' }]
        : insertCueAfter(current, targetAfterId ?? current[current.length - 1].id);
      subtitleService.saveSubtitles(file.id, project.target_language, updated)
        .then(() => { setIsDirty(false); setSaveSuccess(true); window.setTimeout(() => setSaveSuccess(false), 2000); })
        .catch((err) => { console.error('Auto-save failed:', err); setSaveError(t('editor.saveError')); });
      return updated;
    });

    setSourceSubtitles((currentSource) => {
      if (currentSource.length === 0) return currentSource;
      const refId = targetAfterId ?? currentSource[currentSource.length - 1].id;
      const updatedSource = insertCueAfter(currentSource, refId);
      const srcLang = sourceLanguage || file.detected_source_lang;
      if (srcLang) {
        subtitleService.saveSubtitles(file.id, srcLang, updatedSource).catch(console.error);
      }
      return updatedSource;
    });

    setIsDirty(true);
    setSaveError(null);
  };
  const confirmDeleteCue = () => {
    if (cuePendingDelete === null) return;
    const targetId = cuePendingDelete;
    setSubtitles((current) => {
      const updated = removeCue(current, targetId);
      subtitleService.saveSubtitles(file.id, project.target_language, updated)
        .then(() => { setIsDirty(false); setSaveSuccess(true); window.setTimeout(() => setSaveSuccess(false), 2000); })
        .catch((err) => { console.error('Auto-save failed:', err); setSaveError(t('editor.saveError')); });
      return updated;
    });

    setSourceSubtitles((currentSource) => {
      if (currentSource.length === 0) return currentSource;
      const updatedSource = removeCue(currentSource, targetId);
      const srcLang = sourceLanguage || file.detected_source_lang;
      if (srcLang) {
        subtitleService.saveSubtitles(file.id, srcLang, updatedSource).catch(console.error);
      }
      return updatedSource;
    });

    if (editingTimingCueId === cuePendingDelete || editingTextCueId === cuePendingDelete) handleCancelTextEdit();
    setCueVisibilityOverrides((current) => { const next = { ...current }; delete next[targetId]; return next; });
    setIsDirty(true);
    setSaveError(null);
    setCuePendingDelete(null);
  };
  const handleConfirmExport = (format: SubtitleExportFormat, track: SubtitleExportTrack = 'target') => {
    downloadSubtitleFile(subtitles, sourceSubtitles, file.file_name, format, track);
  };
  const pendingDeleteIndex = cuePendingDelete === null ? -1 : subtitles.findIndex((cue) => cue.id === cuePendingDelete);
  const pendingDeleteCue = cuePendingDelete === null ? null : subtitles.find((cue) => cue.id === cuePendingDelete);
  const pendingDeleteTiming = pendingDeleteCue ? `${formatDisplayTime(pendingDeleteCue.start)} → ${formatDisplayTime(pendingDeleteCue.end)}` : '';

  return (
    <div className="editor-workspace" data-cue-density={cueDensity}>
      <header className="editor-local-toolbar">
        <div className="editor-toolbar-inner">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button onClick={handleBack} className="ui-icon-button shrink-0" title={t('editor.backToProject')} aria-label={t('editor.backToProject')}><ArrowLeft className="size-4" /></button>
            <div className="min-w-0">
              {routeLoading || !file.file_name ? (
                <div className="ui-skeleton h-5 w-44 rounded-md my-0.5" />
              ) : (
                <>
                  <h1 className="text-sm sm:text-base font-extrabold truncate">{file.file_name}</h1>
                  <p className="text-[11px] ui-muted truncate mt-0.5">{sourceLanguageLabel} → {targetLanguageLabel}</p>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <CueVisibilityMenu
              metadataVisible={globalCueVisibility.metadata}
              sourceVisible={globalCueVisibility.source}
              actionsVisible={cueActionsVisible}
              onToggleMetadata={() => handleGlobalVisibilityChange('metadata', !globalCueVisibility.metadata)}
              onToggleSource={() => handleGlobalVisibilityChange('source', !globalCueVisibility.source)}
              onToggleActions={handleToggleCueActions}
              label={t('editor.details')}
            />
            <span className="sr-only" role="status" aria-live="polite">{saveSuccess ? t('editor.saved') : saving ? t('common.saving') : ''}</span>
            <button onClick={() => setIsExportOpen(true)} className="ui-button ui-button-primary"><Download className="size-4" /><span>{t('editor.export')}</span></button>
          </div>
        </div>
      </header>

      <main className="editor-main">
        <section className="editor-video-shell"><VideoPlayer videoUrl={videoUrl} loading={routeLoading || videoLoading} error={videoError} currentTime={currentTime} onTimeUpdate={setCurrentTime} /></section>
        <section className="editor-cue-section">
          {saveError && <div role="alert" className="ui-status-error px-3 py-2 text-xs mb-2">{saveError}</div>}
          {loading ? (
            <div className="space-y-3 p-4" role="status" aria-label={t('accessibility.loadingSubtitles')}>
              <div className="ui-skeleton h-20 w-full rounded-2xl" />
              <div className="ui-skeleton h-20 w-full rounded-2xl" />
            </div>
          ) : loadError ? (
            <div className="h-full ui-card-flat flex flex-col items-center justify-center gap-3 text-center p-6" role="alert"><p className="text-sm font-semibold">{loadError}</p><button onClick={() => void loadSubtitles()} className="ui-button ui-button-secondary">{t('editor.retryLoad')}</button></div>
          ) : subtitles.length === 0 ? (
            <div className="h-full ui-card-flat flex flex-col items-center justify-center gap-3 text-center p-6"><p className="text-sm font-semibold">{t('editor.noTargetSubtitle')}</p><button onClick={() => handleAddCue()} className="ui-button ui-button-primary"><Plus className="size-4" />{t('editor.createFirstCue')}</button></div>
          ) : (
            <div ref={cueViewportRef} className="editor-cue-viewport" aria-label={t('editor.subtitleList')}>
              <div className="editor-cue-stack">
                {subtitles.map((item, index) => {
                  const isActive = activeCueId === item.id;
                  const sourceText = getSourceTextById(sourceSubtitles, item.id);
                  const visibility = resolveCueVisibility(globalCueVisibility, cueVisibilityOverrides[item.id]);

                  return (
                    <CueCard
                      key={item.id}
                      item={item}
                      index={index}
                      isActive={isActive}
                      sourceText={sourceText}
                      metadataVisible={visibility.metadata}
                      sourceVisible={visibility.source}
                      cueActionsVisible={cueActionsVisible}
                      editingTimingCueId={editingTimingCueId}
                      editingTextCueId={editingTextCueId}
                      timingDraft={timingDraft}
                      textDraft={textDraft}
                      sourceDraft={sourceDraft}
                      cardRef={(node) => { if (node) cueRefs.current.set(item.id, node); else cueRefs.current.delete(item.id); }}
                      onSelectCard={handleSelectSubtitleCard}
                      onCueVisibilityToggle={handleCueVisibilityToggle}
                      onAddCue={handleAddCue}
                      onStartTextEdit={handleStartTextEdit}
                      onCancelTextEdit={handleCancelTextEdit}
                      onConfirmTextEdit={handleConfirmTextEdit}
                      onSetCuePendingDelete={setCuePendingDelete}
                      setTimingDraft={setTimingDraft}
                      setTextDraft={setTextDraft}
                      setSourceDraft={setSourceDraft}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </main>

      <ExportModal isOpen={isExportOpen} title={file.file_name} onClose={() => setIsExportOpen(false)} onConfirmExport={handleConfirmExport} />
      <ConfirmDialog isOpen={cuePendingDelete !== null} onClose={() => setCuePendingDelete(null)} onConfirm={confirmDeleteCue} title={t('editor.deleteCueDialog.title')} message={t('editor.deleteCueDialog.message', { index: pendingDeleteIndex + 1, timing: pendingDeleteTiming })} confirmText={t('editor.deleteCueDialog.confirm')} type="danger" />
      <ConfirmDialog isOpen={showUnsavedExitDialog} onClose={() => setShowUnsavedExitDialog(false)} onConfirm={() => { setIsDirty(false); onDirtyChange?.(false); onBack(); }} title={t('editor.unsavedDialog.title')} message={t('editor.unsavedDialog.message')} confirmText={t('editor.unsavedDialog.confirm')} type="warning" />
    </div>
  );
};
