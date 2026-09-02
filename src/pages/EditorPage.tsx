import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FileMedia, Project, SubtitleItem } from '../types/database';
import { getNativeLanguageName } from '../types/project';
import { VideoPlayer, type VideoPlayerHandle } from '../components/editor/VideoPlayer';
import { ExportModal } from '../components/editor/ExportModal';
import { VideoExportModal } from '../components/editor/VideoExportModal';
import { EditorToolbar } from '../components/editor/EditorToolbar';
import { EditorCueList } from '../components/editor/EditorCueList';
import { CueListSkeleton, EditorSkeleton } from '../components/common/LoadingSkeleton';
import { useEditorSubtitles } from '../hooks/useEditorSubtitles';
import { useEditorVideo } from '../hooks/useEditorVideo';
import { useEditorDraft } from '../hooks/useEditorDraft';
import { useCueVisibility } from '../hooks/useCueVisibility';
import { useSubtitleTrack } from '../hooks/useSubtitleTrack';
import { useVideoExport } from '../hooks/useVideoExport';
import { useCueViewportScroll } from '../hooks/useCueViewportScroll';
import { findActiveCueId, getSourceTextById } from '../utils/subtitleEditor';
import { getEditorCueDensity } from '../utils/editorDensity';
import { downloadSubtitleFile, type SubtitleExportFormat, type SubtitleExportTrack } from '../utils/exporter';

interface EditorPageProps {
  file: FileMedia;
  project: Project;
  routeLoading?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onBack: () => void;
}

export const EditorPage: React.FC<EditorPageProps> = ({
  file,
  project,
  routeLoading = false,
  onDirtyChange,
  onBack,
}) => {
  const { t } = useTranslation();
  const videoPlayerRef = useRef<VideoPlayerHandle>(null);

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [cuePendingDelete, setCuePendingDelete] = useState<number | null>(null);

  const {
    subtitles,
    sourceSubtitles,
    sourceLanguage,
    loading: subtitlesLoading,
    loadError: subtitlesError,
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
  } = useEditorSubtitles({
    fileId: file.id,
    detectedSourceLang: file.detected_source_lang,
    targetLanguage: project.target_language,
    onDirtyChange,
  });

  const {
    videoUrl,
    videoLoading,
    videoError,
    loadVideoBlob,
  } = useEditorVideo({
    driveFileId: file.drive_file_id,
    inputSource: file.input_source,
    fileName: file.file_name,
    mimeType: file.mime_type,
  });

  const subtitleTrackUrl = useSubtitleTrack(subtitles);

  const {
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
  } = useEditorDraft();

  const {
    globalVisibility,
    cueActionsVisible,
    setCueActionsVisible,
    toggleGlobal,
    toggleCueOverride,
    getResolvedVisibility,
  } = useCueVisibility();

  const {
    videoExportOpen,
    videoExportStatus,
    videoExportProgress,
    videoExportError,
    videoExportBusy,
    handleOpenVideoExport,
    handleConfirmVideoExport,
    handleCloseVideoExport,
  } = useVideoExport({
    fileName: file.file_name,
    loadVideoBlob,
  });

  const sourceLanguageLabel = getNativeLanguageName(sourceLanguage || file.detected_source_lang);
  const targetLanguageLabel = getNativeLanguageName(project.target_language);
  const [activeCueId, setActiveCueId] = useState<number | null>(null);

  const handlePlaybackTimeUpdate = useCallback(
    (time: number) => {
      const nextCueId = findActiveCueId(subtitles, time);
      setActiveCueId((previousCueId) =>
        previousCueId === nextCueId ? previousCueId : nextCueId,
      );
    },
    [subtitles],
  );

  useEffect(() => {
    setActiveCueId(findActiveCueId(subtitles, 0));
  }, [subtitles, videoUrl]);

  const editingTextCue =
    editingTextCueId === null
      ? null
      : subtitles.find((s) => s.id === editingTextCueId) ?? null;

  const hasInvalidTimingDraft =
    editingTimingCueId !== null &&
    (timingDraft === null ||
      timingDraft.start.trim() === '' ||
      timingDraft.end.trim() === '' ||
      !Number.isFinite(Number(timingDraft.start)) ||
      !Number.isFinite(Number(timingDraft.end)) ||
      Number(timingDraft.start) < 0 ||
      Number(timingDraft.end) <= Number(timingDraft.start));
  const validTimingDraft = useMemo(
    () =>
      !hasInvalidTimingDraft && timingDraft !== null
        ? {
            start: Number(timingDraft.start),
            end: Number(timingDraft.end),
          }
        : null,
    [hasInvalidTimingDraft, timingDraft]
  );
  const effectiveTargetSubtitles = useMemo(
    () =>
      subtitles.map((subtitle) => {
        const effectiveText =
          editingTextCueId === subtitle.id && textDraft !== null
            ? { ...subtitle, text: textDraft }
            : subtitle;
        if (editingTimingCueId !== subtitle.id || validTimingDraft === null) {
          return effectiveText;
        }
        return { ...effectiveText, ...validTimingDraft };
      }),
    [editingTextCueId, editingTimingCueId, subtitles, textDraft, validTimingDraft]
  );

  const hasPendingTextChange = Boolean(
    (editingTextCue && textDraft !== null && editingTextCue.text !== textDraft) ||
      (editingTextCueId !== null &&
        sourceDraft !== null &&
        getSourceTextById(sourceSubtitles, editingTextCueId) !== sourceDraft)
  );

  const hasUnsavedChanges = isDirty || hasPendingTextChange;
  const mediaExtension = file.file_name.split('.').pop()?.toLowerCase() ?? '';
  const isVideoSource =
    file.mime_type.toLowerCase().startsWith('video/') ||
    ['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(mediaExtension);
  const supportsVideoExport =
    file.input_source === 'media' || file.input_source === 'existing_subtitle';
  const canExportVideo = Boolean(
    !routeLoading &&
      !videoLoading &&
      !videoError &&
      !subtitlesLoading &&
      !subtitlesError &&
      !videoExportBusy &&
      isVideoSource &&
      supportsVideoExport &&
      effectiveTargetSubtitles.length > 0 &&
      !hasInvalidTimingDraft
  );

  const cueDensity = getEditorCueDensity(
    globalVisibility.metadata,
    globalVisibility.source,
    cueActionsVisible
  );

  const isEditing = editingTextCueId !== null || editingTimingCueId !== null;
  const {
    cueRefs,
    cueViewportRef,
    handleUserScrollInteraction,
  } = useCueViewportScroll({
    activeCueId,
    isEditing,
  });

  const handleConfirmTextEdit = useCallback((id: number) => {
    if (textDraft !== null || sourceDraft !== null) {
      updateCueText(id, textDraft ?? undefined, sourceDraft ?? undefined);
    }
    cancelEditingText();
  }, [cancelEditingText, sourceDraft, textDraft, updateCueText]);

  const handleConfirmTimingEdit = useCallback((id: number) => {
    if (timingDraft) {
      const s = Number(timingDraft.start);
      const e = Number(timingDraft.end);
      if (Number.isFinite(s) && Number.isFinite(e) && s >= 0 && e > s) {
        updateCueTiming(id, s, e);
      }
    }
    cancelEditingTiming();
  }, [cancelEditingTiming, timingDraft, updateCueTiming]);

  const handleSaveSubtitles = useCallback(async () => {
    if (saving) return;

    let targetToSave = subtitles;
    let sourceToSave = sourceSubtitles;

    if (editingTextCueId !== null && (textDraft !== null || sourceDraft !== null)) {
      if (textDraft !== null) {
        targetToSave = subtitles.map((c) => (c.id === editingTextCueId ? { ...c, text: textDraft } : c));
      }
      if (sourceDraft !== null) {
        sourceToSave = sourceSubtitles.map((c) => (c.id === editingTextCueId ? { ...c, text: sourceDraft } : c));
      }
      handleConfirmTextEdit(editingTextCueId);
    }

    if (editingTimingCueId !== null && validTimingDraft !== null) {
      targetToSave = targetToSave.map((c) => (c.id === editingTimingCueId ? { ...c, ...validTimingDraft } : c));
      sourceToSave = sourceToSave.map((c) => (c.id === editingTimingCueId ? { ...c, ...validTimingDraft } : c));
      handleConfirmTimingEdit(editingTimingCueId);
    }

    await saveSubtitles(targetToSave, sourceToSave);
  }, [
    editingTextCueId,
    editingTimingCueId,
    handleConfirmTextEdit,
    handleConfirmTimingEdit,
    saveSubtitles,
    saving,
    sourceDraft,
    sourceSubtitles,
    subtitles,
    textDraft,
    validTimingDraft,
  ]);

  useEffect(() => {
    const handleKeyboardSave = (event: KeyboardEvent) => {
      const isSaveShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's';
      if (!isSaveShortcut) return;
      event.preventDefault();
      if (hasUnsavedChanges && !saving) void handleSaveSubtitles();
    };
    window.addEventListener('keydown', handleKeyboardSave);
    return () => window.removeEventListener('keydown', handleKeyboardSave);
  }, [handleSaveSubtitles, hasUnsavedChanges, saving]);

  const handleBack = () => {
    onBack();
  };

  const handleSelectCue = useCallback((item: SubtitleItem) => {
    videoPlayerRef.current?.seekTo(item.start);
  }, []);

  const handleStartTextEdit = useCallback(
    (item: SubtitleItem) =>
      startEditingText(item, getSourceTextById(sourceSubtitles, item.id)),
    [sourceSubtitles, startEditingText]
  );

  const handleConfirmExport = (
    format: SubtitleExportFormat,
    track: SubtitleExportTrack = 'target'
  ) => {
    if (hasUnsavedChanges && !saving) {
      void handleSaveSubtitles();
    }
    downloadSubtitleFile(effectiveTargetSubtitles, sourceSubtitles, file.file_name, format, track);
  };

  const onOpenVideoExport = () => {
    if (!canExportVideo) return;
    handleOpenVideoExport();
  };

  const onConfirmVideoExport = async () => {
    if (!canExportVideo) return;
    if (hasUnsavedChanges && !saving) {
      void handleSaveSubtitles();
    }
    await handleConfirmVideoExport(effectiveTargetSubtitles);
  };

  if (routeLoading) {
    return <EditorSkeleton />;
  }

  return (
    <div className="editor-workspace" data-cue-density={cueDensity}>
      <EditorToolbar
        fileName={file.file_name}
        sourceLanguageLabel={sourceLanguageLabel}
        targetLanguageLabel={targetLanguageLabel}
        globalVisibility={globalVisibility}
        cueActionsVisible={cueActionsVisible}
        saving={saving}
        isDirty={hasUnsavedChanges}
        saveSuccess={saveSuccess}
        saveError={saveError}
        onBack={handleBack}
        onToggleGlobalVisibility={toggleGlobal}
        onToggleCueActionsVisible={() => setCueActionsVisible(!cueActionsVisible)}
        onSave={handleSaveSubtitles}
        onExport={() => setIsExportOpen(true)}
        showExportVideo={isVideoSource}
        onExportVideo={onOpenVideoExport}
        exportVideoDisabled={!canExportVideo || videoExportOpen}
      />

      <main className="editor-main">
        <section className="editor-video-shell">
          <VideoPlayer
            ref={videoPlayerRef}
            videoUrl={videoUrl}
            loading={routeLoading || videoLoading}
            error={videoError}
            onTimeUpdate={handlePlaybackTimeUpdate}
            subtitleTrackUrl={subtitleTrackUrl}
            subtitleLanguage={project.target_language}
          />
        </section>

        <section className="editor-cue-section">
          {saveError && (
            <div role="alert" className="ui-status-error px-3 py-2 text-xs mb-2">
              {saveError}
            </div>
          )}

          {subtitlesLoading ? (
            <CueListSkeleton count={4} />
          ) : subtitlesError ? (
            <div className="h-full ui-card-flat flex flex-col items-center justify-center gap-3 text-center p-6" role="alert">
              <p className="text-sm font-semibold">{subtitlesError}</p>
              <button
                type="button"
                onClick={() => void loadSubtitles()}
                className="ui-button ui-button-secondary"
              >
                {t('editor.retryLoad')}
              </button>
            </div>
          ) : (
            <EditorCueList
              subtitles={subtitles}
              sourceSubtitles={sourceSubtitles}
              activeCueId={activeCueId}
              cueDensity={cueDensity}
              globalVisibility={globalVisibility}
              cueActionsVisible={cueActionsVisible}
              editingTimingCueId={editingTimingCueId}
              editingTextCueId={editingTextCueId}
              timingDraft={timingDraft}
              textDraft={textDraft}
              sourceDraft={sourceDraft}
              cuePendingDelete={cuePendingDelete}
              cueViewportRef={cueViewportRef}
              cueRefs={cueRefs}
              onUserScrollInteraction={handleUserScrollInteraction}
              onSelectCue={handleSelectCue}
              onCueVisibilityToggle={toggleCueOverride}
              getResolvedVisibility={getResolvedVisibility}
              onAddCue={addCue}
              onStartTextEdit={handleStartTextEdit}
              onCancelTextEdit={cancelEditingText}
              onConfirmTextEdit={handleConfirmTextEdit}
              onStartTimingEdit={startEditingTiming}
              onCancelTimingEdit={cancelEditingTiming}
              onConfirmTimingEdit={handleConfirmTimingEdit}
              setTimingDraft={setTimingDraft}
              setTextDraft={setTextDraft}
              setSourceDraft={setSourceDraft}
              onSetCuePendingDelete={setCuePendingDelete}
              onConfirmDeleteCue={deleteCue}
            />
          )}
        </section>
      </main>

      <ExportModal
        isOpen={isExportOpen}
        title={file.file_name}
        onClose={() => setIsExportOpen(false)}
        onConfirmExport={handleConfirmExport}
      />

      <VideoExportModal
        isOpen={videoExportOpen}
        fileName={file.file_name}
        status={videoExportStatus}
        progress={videoExportProgress}
        error={videoExportError}
        onClose={handleCloseVideoExport}
        onConfirm={() => void onConfirmVideoExport()}
      />
    </div>
  );
};
