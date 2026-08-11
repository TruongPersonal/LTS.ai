import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Download, Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { FileMedia, Project, SubtitleItem } from '../types/database';
import { getLanguageOption } from '../types/project';
import { subtitleService } from '../services/subtitleService';
import { VideoPlayer } from '../components/editor/VideoPlayer';
import { ExportModal } from '../components/editor/ExportModal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { CueVisibilityMenu } from '../components/editor/CueVisibilityMenu';
import type { SubtitleExportFormat } from '../utils/exporter';
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
  onBack: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

interface TimingDraft { start: string; end: string; }

export const EditorPage: React.FC<EditorPageProps> = ({ file, project, onBack, onDirtyChange }) => {
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
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [editingTimingCueId, setEditingTimingCueId] = useState<number | null>(null);
  const [timingDraft, setTimingDraft] = useState<TimingDraft | null>(null);
  const [editingTextCueId, setEditingTextCueId] = useState<number | null>(null);
  const [textDraft, setTextDraft] = useState<string | null>(null);
  const [globalCueVisibility, setGlobalCueVisibility] = useState(DEFAULT_CUE_VISIBILITY);
  const [cueVisibilityOverrides, setCueVisibilityOverrides] = useState<CueVisibilityOverrides>({});
  const [cuePendingDelete, setCuePendingDelete] = useState<number | null>(null);
  const [showUnsavedExitDialog, setShowUnsavedExitDialog] = useState(false);
  const cueRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const cueViewportRef = useRef<HTMLDivElement>(null);

  const activeCueId = findActiveCueId(subtitles, currentTime);
  const sourceLangOpt = sourceLanguage ? getLanguageOption(sourceLanguage) : null;
  const targetLangOpt = getLanguageOption(project.target_language);
  const targetLanguageLabel = targetLangOpt?.nativeName || project.target_language.toUpperCase();
  const editingTextCue = editingTextCueId === null ? null : subtitles.find((subtitle) => subtitle.id === editingTextCueId) ?? null;
  const hasPendingTextChange = Boolean(editingTextCue && textDraft !== null && editingTextCue.text !== textDraft);
  const hasUnsavedChanges = isDirty || hasPendingTextChange;
  const cueDensity = getEditorCueDensity(
    globalCueVisibility.metadata,
    globalCueVisibility.source,
    cueActionsVisible,
  );

  const loadSubtitles = async () => {
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
  };

  const loadVideoBlob = async () => {
    if (!file.drive_file_id) { setVideoUrl(''); setVideoError(t('editor.video.missingDriveId')); return; }
    setVideoLoading(true); setVideoError(null);
    try {
      const accessToken = await getGoogleAccessToken();
      if (!accessToken) throw new Error(t('editor.video.sessionExpired'));
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.drive_file_id)}?alt=media`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) throw new Error(t('editor.video.downloadFailed'));
      const blob = await response.blob();
      if (blob.size === 0) throw new Error(t('editor.video.emptyFile'));
      setVideoUrl(URL.createObjectURL(blob));
    } catch (error) {
      console.error('Could not fetch authenticated video blob:', error);
      setVideoUrl('');
      setVideoError(error instanceof Error ? error.message : t('editor.video.downloadFailed'));
    } finally { setVideoLoading(false); }
  };

  const handleSaveChanges = async () => {
    if (!hasUnsavedChanges || saving) return;
    const subtitlesToSave = hasPendingTextChange && editingTextCueId !== null && textDraft !== null
      ? subtitles.map((subtitle) => subtitle.id === editingTextCueId ? { ...subtitle, text: textDraft } : subtitle)
      : subtitles;
    setSaving(true); setSaveError(null);
    try {
      await subtitleService.saveSubtitles(file.id, project.target_language, subtitlesToSave);
      setSubtitles(subtitlesToSave);
      setEditingTextCueId(null); setTextDraft(null);
      setIsDirty(false); setSaveSuccess(true);
      window.setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Error saving subtitles:', error);
      setSaveError(t('editor.saveError'));
    } finally { setSaving(false); }
  };

  useEffect(() => { void loadSubtitles(); void loadVideoBlob(); }, [file.id, file.drive_file_id, file.detected_source_lang, project.target_language]);

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
  }, [hasUnsavedChanges, saving, subtitles, editingTextCueId, textDraft]);

  useEffect(() => () => { if (videoUrl.startsWith('blob:')) URL.revokeObjectURL(videoUrl); }, [videoUrl]);

  const handleBack = () => { if (hasUnsavedChanges) { setShowUnsavedExitDialog(true); return; } onBack(); };
  const handleSelectSubtitleCard = (item: SubtitleItem) => setCurrentTime(item.start);
  const handleStartTextEdit = (item: SubtitleItem) => { setEditingTextCueId(item.id); setTextDraft(item.text); setSaveError(null); };
  const handleCancelTextEdit = () => { setEditingTextCueId(null); setTextDraft(null); };
  const handleConfirmTextEdit = (id: number) => {
    if (editingTextCueId !== id || textDraft === null) return;
    const currentCue = subtitles.find((subtitle) => subtitle.id === id);
    if (currentCue && currentCue.text !== textDraft) {
      setSubtitles((current) => current.map((subtitle) => subtitle.id === id ? { ...subtitle, text: textDraft } : subtitle));
      setIsDirty(true);
    }
    setSaveError(null);
    setEditingTextCueId(null);
    setTextDraft(null);
  };
  const handleStartTimingEdit = (item: SubtitleItem) => { setEditingTimingCueId(item.id); setTimingDraft({ start: String(item.start), end: String(item.end) }); setSaveError(null); };
  const handleCancelTimingEdit = () => { setEditingTimingCueId(null); setTimingDraft(null); };
  const handleGlobalVisibilityChange = (key: CueVisibilityKey, value: boolean) => {
    const next = applyGlobalCueVisibilityChange(globalCueVisibility, cueVisibilityOverrides, key, value);
    setGlobalCueVisibility(next.globalVisibility);
    setCueVisibilityOverrides(next.overrides);
    if (key === 'metadata' && !value) handleCancelTimingEdit();
  };
  const handleCueVisibilityToggle = (cueId: number, key: CueVisibilityKey, currentResolvedValue: boolean) => {
    setCueVisibilityOverrides((current) => toggleCueVisibilityOverride(current, cueId, key, currentResolvedValue));
    if (key === 'metadata' && currentResolvedValue && editingTimingCueId === cueId) handleCancelTimingEdit();
  };
  const handleToggleCueActions = () => {
    const nextVisible = !cueActionsVisible;
    if (!nextVisible) {
      handleCancelTimingEdit();
      handleCancelTextEdit();
    }
    setCueActionsVisible(nextVisible);
  };
  const handleConfirmTimingEdit = (id: number) => {
    if (editingTimingCueId !== id || !timingDraft) return;
    const start = Number(timingDraft.start); const end = Number(timingDraft.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) { setSaveError(t('editor.invalidTiming')); return; }
    const currentCue = subtitles.find((subtitle) => subtitle.id === id);
    if (currentCue && (currentCue.start !== start || currentCue.end !== end)) { setSubtitles((current) => current.map((subtitle) => subtitle.id === id ? { ...subtitle, start, end } : subtitle)); setIsDirty(true); }
    setSaveError(null); setEditingTimingCueId(null); setTimingDraft(null);
  };
  const handleAddCue = (afterId?: number) => { setSubtitles((current) => { if (current.length === 0) { const start = Math.max(0, currentTime); return [{ id: 1, start, end: start + 2, text: '' }]; } const targetId = afterId ?? activeCueId ?? current[current.length - 1].id; return insertCueAfter(current, targetId); }); setIsDirty(true); setSaveError(null); };
  const confirmDeleteCue = () => { if (cuePendingDelete === null) return; setSubtitles((current) => removeCue(current, cuePendingDelete)); if (editingTimingCueId === cuePendingDelete) handleCancelTimingEdit(); if (editingTextCueId === cuePendingDelete) handleCancelTextEdit(); setCueVisibilityOverrides((current) => { const next = { ...current }; delete next[cuePendingDelete]; return next; }); setIsDirty(true); setSaveError(null); setCuePendingDelete(null); };
  const handleConfirmExport = (format: SubtitleExportFormat) => downloadSubtitleFile(subtitles, file.file_name, format);
  const pendingDeleteIndex = cuePendingDelete === null ? -1 : subtitles.findIndex((cue) => cue.id === cuePendingDelete);

  return (
    <div className="editor-workspace" data-cue-density={cueDensity}>
      <header className="editor-local-toolbar">
        <div className="editor-toolbar-inner">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button onClick={handleBack} className="ui-icon-button shrink-0" title={t('common.back')} aria-label={t('common.back')}><ArrowLeft className="size-4" /></button>
            <div className="min-w-0"><h1 className="text-sm sm:text-base font-extrabold truncate">{file.file_name}</h1><p className="text-[11px] ui-muted truncate mt-0.5">{sourceLangOpt?.nativeName || t('editor.source')} → {targetLanguageLabel}{hasUnsavedChanges ? ` · ${t('editor.unsaved')}` : saveSuccess ? ` · ${t('editor.saved')}` : ''}</p></div>
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
            {saveSuccess && <span className="hidden sm:inline-flex ui-badge ui-badge-success"><Check className="size-3" />{t('editor.saved')}</span>}
            <button onClick={() => void handleSaveChanges()} disabled={!hasUnsavedChanges || saving} className="ui-button ui-button-secondary">{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}<span>{t('editor.save')}</span></button>
            <button onClick={() => setIsExportOpen(true)} className="ui-button ui-button-primary"><Download className="size-4" /><span>{t('editor.export')}</span></button>
          </div>
        </div>
      </header>

      <main className="editor-main">
        <section className="editor-video-shell"><VideoPlayer videoUrl={videoUrl} loading={videoLoading} error={videoError} currentTime={currentTime} onTimeUpdate={setCurrentTime} /></section>
        <section className="editor-cue-section">
          {saveError && <div role="alert" className="ui-status-error px-3 py-2 text-xs mb-2">{saveError}</div>}
          {loading ? (
            <div className="h-full ui-card-flat flex items-center justify-center" role="status" aria-label={t('accessibility.loadingSubtitles')}><Loader2 className="size-6 animate-spin text-[var(--ui-accent)]" /></div>
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
                  const metadataVisible = visibility.metadata;
                  const sourceVisible = visibility.source;
                  const showEyeInHeader = cueActionsVisible && metadataVisible;
                  const showEyeInSource = cueActionsVisible && !metadataVisible && sourceVisible;
                  const showEyeInTranslation = cueActionsVisible && !metadataVisible && !sourceVisible;
                  const visibilityMenu = (
                    <CueVisibilityMenu
                      compact
                      metadataVisible={metadataVisible}
                      sourceVisible={sourceVisible}
                      onToggleMetadata={() => handleCueVisibilityToggle(item.id, 'metadata', metadataVisible)}
                      onToggleSource={() => handleCueVisibilityToggle(item.id, 'source', sourceVisible)}
                    />
                  );

                  return (
                    <div
                      key={item.id}
                      ref={(node) => { if (node) cueRefs.current.set(item.id, node); else cueRefs.current.delete(item.id); }}
                      onClick={() => handleSelectSubtitleCard(item)}
                      data-metadata-visible={String(metadataVisible)}
                      data-source-visible={String(sourceVisible)}
                      data-actions-visible={String(cueActionsVisible)}
                      className={`editor-cue-card ${isActive ? 'editor-cue-card-active' : ''}`}
                    >
                      <div className="editor-cue-content">
                        {metadataVisible && (
                          <div className="editor-cue-metadata-row">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-extrabold text-[var(--ui-accent)]">#{index + 1}</span>
                              {isActive && <span className="ui-badge ui-badge-accent ui-badge-compact">{t('editor.playing')}</span>}
                            </div>
                            <div className="editor-cue-header-actions" onClick={(event) => event.stopPropagation()}>
                              {editingTimingCueId === item.id ? (
                                <div className="editor-timing-edit">
                                  <label><span className="sr-only">{t('editor.timing.start')}</span><input data-autofocus type="number" min="0" step="0.1" value={timingDraft?.start ?? ''} onChange={(event) => setTimingDraft((draft) => draft ? { ...draft, start: event.target.value } : draft)} onKeyDown={(event) => { if (event.key === 'Enter') handleConfirmTimingEdit(item.id); if (event.key === 'Escape') handleCancelTimingEdit(); }} className="ui-input" /></label>
                                  <span className="text-[10px] ui-soft">→</span>
                                  <label><span className="sr-only">{t('editor.timing.end')}</span><input type="number" min="0" step="0.1" value={timingDraft?.end ?? ''} onChange={(event) => setTimingDraft((draft) => draft ? { ...draft, end: event.target.value } : draft)} onKeyDown={(event) => { if (event.key === 'Enter') handleConfirmTimingEdit(item.id); if (event.key === 'Escape') handleCancelTimingEdit(); }} className="ui-input" /></label>
                                  <button onClick={() => handleConfirmTimingEdit(item.id)} className="ui-icon-button ui-icon-button-sm" title={t('editor.timing.confirm')} aria-label={t('editor.timing.confirm')}><Check className="size-3.5" /></button>
                                  <button onClick={handleCancelTimingEdit} className="ui-icon-button ui-icon-button-sm" title={t('editor.timing.cancel')} aria-label={t('editor.timing.cancel')}><X className="size-3.5" /></button>
                                </div>
                              ) : (
                                <div className="editor-timing-static"><span className="text-[11px] font-mono ui-muted shrink-0">{formatDisplayTime(item.start)} → {formatDisplayTime(item.end)}</span></div>
                              )}
                              {showEyeInHeader && visibilityMenu}
                              {cueActionsVisible && editingTimingCueId !== item.id && <button onClick={() => handleStartTimingEdit(item)} className="ui-icon-button ui-icon-button-sm" title={t('editor.timing.edit')} aria-label={t('editor.cue.editTimingAria', { index: index + 1 })}><Pencil className="size-3.5" /></button>}
                              {cueActionsVisible && <button onClick={() => handleAddCue(item.id)} className="ui-icon-button ui-icon-button-sm" title={t('editor.cue.addAfter')} aria-label={t('editor.cue.addAfterAria', { index: index + 1 })}><Plus className="size-3.5" /></button>}
                              {cueActionsVisible && <button onClick={() => setCuePendingDelete(item.id)} className="ui-icon-button ui-icon-button-sm ui-danger-text" title={t('editor.cue.delete')} aria-label={t('editor.cue.deleteAria', { index: index + 1 })}><Trash2 className="size-3.5" /></button>}
                            </div>
                          </div>
                        )}

                        {sourceVisible && (
                          <div className="editor-cue-source-row">
                            <p className="editor-cue-source whitespace-pre-wrap">{sourceText || '—'}</p>
                            {showEyeInSource && <div className="editor-inline-actions" onClick={(event) => event.stopPropagation()}>{visibilityMenu}</div>}
                          </div>
                        )}

                        <div className="editor-translation-row">
                          {editingTextCueId === item.id ? (
                            <div className="editor-translation-edit" onClick={(event) => event.stopPropagation()}>
                              <textarea
                                autoFocus
                                value={textDraft ?? ''}
                                onChange={(event) => setTextDraft(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Escape') handleCancelTextEdit();
                                  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) handleConfirmTextEdit(item.id);
                                }}
                                className="ui-input editor-target-input"
                              />
                              <div className="editor-inline-actions">
                                {showEyeInTranslation && visibilityMenu}
                                <button onClick={() => handleConfirmTextEdit(item.id)} className="ui-icon-button ui-icon-button-sm" title={t('editor.cue.confirmTranslation')} aria-label={t('editor.cue.confirmTranslation')}><Check className="size-3.5" /></button>
                                <button onClick={handleCancelTextEdit} className="ui-icon-button ui-icon-button-sm" title={t('editor.cue.cancelTranslation')} aria-label={t('editor.cue.cancelTranslation')}><X className="size-3.5" /></button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="editor-translation-static whitespace-pre-wrap">{item.text || '—'}</p>
                              <div className="editor-inline-actions" onClick={(event) => event.stopPropagation()}>
                                {showEyeInTranslation && visibilityMenu}
                                {cueActionsVisible && <button onClick={() => handleStartTextEdit(item)} className="ui-icon-button ui-icon-button-sm" title={t('editor.cue.editTranslation')} aria-label={t('editor.cue.editTranslationAria', { index: index + 1 })}><Pencil className="size-3.5" /></button>}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </main>

      <ExportModal isOpen={isExportOpen} title={file.file_name} onClose={() => setIsExportOpen(false)} onConfirmExport={handleConfirmExport} />
      <ConfirmDialog isOpen={cuePendingDelete !== null} onClose={() => setCuePendingDelete(null)} onConfirm={confirmDeleteCue} title={t('editor.deleteCueDialog.title')} message={t('editor.deleteCueDialog.message', { index: pendingDeleteIndex + 1 })} confirmText={t('editor.deleteCueDialog.confirm')} type="danger" />
      <ConfirmDialog isOpen={showUnsavedExitDialog} onClose={() => setShowUnsavedExitDialog(false)} onConfirm={() => { setIsDirty(false); onDirtyChange?.(false); onBack(); }} title={t('editor.unsavedDialog.title')} message={t('editor.unsavedDialog.message')} confirmText={t('editor.unsavedDialog.confirm')} type="warning" />
    </div>
  );
};
