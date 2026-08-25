import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FileMedia, Project } from '../types/database';
import { getNativeLanguageName } from '../types/project';
import { VideoPlayer } from '../components/editor/VideoPlayer';
import { ExportModal } from '../components/editor/ExportModal';
import { VideoExportModal, type VideoExportStatus } from '../components/editor/VideoExportModal';
import { EditorToolbar } from '../components/editor/EditorToolbar';
import { EditorCueList } from '../components/editor/EditorCueList';
import { CueListSkeleton, EditorSkeleton } from '../components/common/LoadingSkeleton';
import { useEditorSubtitles } from '../hooks/useEditorSubtitles';
import { useEditorVideo } from '../hooks/useEditorVideo';
import { useEditorDraft } from '../hooks/useEditorDraft';
import { useCueVisibility } from '../hooks/useCueVisibility';
import { useSubtitleTrack } from '../hooks/useSubtitleTrack';
import { findActiveCueId, getSourceTextById } from '../utils/subtitleEditor';
import { getEditorCueDensity } from '../utils/editorDensity';
import { downloadSubtitleFile, type SubtitleExportFormat, type SubtitleExportTrack } from '../utils/exporter';
import { saveAs } from 'file-saver';
import { exportVideoWithSubtitles, VideoSubtitleExportError } from '../services/videoSubtitleExporter';

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
  const cueRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const cueViewportRef = useRef<HTMLDivElement>(null);

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [cuePendingDelete, setCuePendingDelete] = useState<number | null>(null);
  const [videoExportOpen, setVideoExportOpen] = useState(false);
  const [videoExportStatus, setVideoExportStatus] = useState<VideoExportStatus>('idle');
  const [videoExportProgress, setVideoExportProgress] = useState(0);
  const [videoExportError, setVideoExportError] = useState<string | null>(null);

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
    videoBlob,
    videoLoading,
    videoError,
    currentTime,
    setCurrentTime,
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

  const sourceLanguageLabel = getNativeLanguageName(sourceLanguage || file.detected_source_lang);
  const targetLanguageLabel = getNativeLanguageName(project.target_language);
  const activeCueId = findActiveCueId(subtitles, currentTime);

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
  const validTimingDraft =
    !hasInvalidTimingDraft && timingDraft !== null
      ? {
          start: Number(timingDraft.start),
          end: Number(timingDraft.end),
        }
      : null;
  const effectiveTargetSubtitles = subtitles.map((subtitle) => {
    const effectiveText =
      editingTextCueId === subtitle.id && textDraft !== null
        ? { ...subtitle, text: textDraft }
        : subtitle;
    if (editingTimingCueId !== subtitle.id || validTimingDraft === null) {
      return effectiveText;
    }
    return { ...effectiveText, ...validTimingDraft };
  });

  const hasPendingTextChange = Boolean(
    (editingTextCue && textDraft !== null && editingTextCue.text !== textDraft) ||
      (editingTextCueId !== null &&
        sourceDraft !== null &&
        getSourceTextById(sourceSubtitles, editingTextCueId) !== sourceDraft)
  );

  const hasUnsavedChanges = isDirty || hasPendingTextChange;
  const videoExportBusy =
    videoExportStatus === 'preparing' || videoExportStatus === 'exporting';
  const videoMimeType = videoBlob?.type.toLowerCase() ?? '';
  const isVideoBlobReady = Boolean(
    videoBlob &&
      videoBlob.size > 0 &&
      videoMimeType.startsWith('video/') &&
      !videoMimeType.startsWith('audio/')
  );
  const canExportVideo = Boolean(
    !routeLoading &&
      !videoLoading &&
      !videoError &&
      !subtitlesLoading &&
      !subtitlesError &&
      !videoExportBusy &&
      isVideoBlobReady &&
      effectiveTargetSubtitles.length > 0 &&
      !hasInvalidTimingDraft
  );

  const cueDensity = getEditorCueDensity(
    globalVisibility.metadata,
    globalVisibility.source,
    cueActionsVisible
  );

  useEffect(() => {
    if (activeCueId === null) return;
    const container = cueViewportRef.current;
    const cue = cueRefs.current.get(activeCueId);
    if (!container || !cue) return;
    const top =
      cue.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    container.scrollTo({ top, behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [activeCueId]);

  useEffect(() => {
    const handleKeyboardSave = (event: KeyboardEvent) => {
      const isSaveShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's';
      if (!isSaveShortcut) return;
      event.preventDefault();
      if (hasUnsavedChanges && !saving) void saveSubtitles();
    };
    window.addEventListener('keydown', handleKeyboardSave);
    return () => window.removeEventListener('keydown', handleKeyboardSave);
  }, [hasUnsavedChanges, saveSubtitles, saving]);

  const handleBack = () => {
    onBack();
  };

  const handleConfirmTimingEdit = (id: number) => {
    if (timingDraft) {
      const s = Number(timingDraft.start);
      const e = Number(timingDraft.end);
      if (Number.isFinite(s) && Number.isFinite(e) && s >= 0 && e > s) {
        updateCueTiming(id, s, e);
      }
    }
    cancelEditingTiming();
  };

  const handleConfirmTextEdit = (id: number) => {
    if (textDraft !== null || sourceDraft !== null) {
      updateCueText(id, textDraft ?? undefined, sourceDraft ?? undefined);
    }
    cancelEditingText();
  };

  const handleConfirmExport = (
    format: SubtitleExportFormat,
    track: SubtitleExportTrack = 'target'
  ) => {
    downloadSubtitleFile(subtitles, sourceSubtitles, file.file_name, format, track);
  };

  const handleExportVideo = async () => {
    if (!canExportVideo || videoBlob === null) return;

    const exportBlob = videoBlob;
    const exportSubtitles = effectiveTargetSubtitles;
    setVideoExportOpen(true);
    setVideoExportStatus('preparing');
    setVideoExportProgress(0);
    setVideoExportError(null);

    await Promise.resolve();
    setVideoExportStatus('exporting');

    try {
      const output = await exportVideoWithSubtitles({
        videoBlob: exportBlob,
        subtitles: exportSubtitles,
        fileName: file.file_name,
        onProgress: setVideoExportProgress,
      });
      const baseName = file.file_name.replace(/\.[^/.]+$/, '') || file.file_name;
      saveAs(output, baseName + '_subtitled.mp4');
      setVideoExportProgress(1);
      setVideoExportStatus('completed');
    } catch (error) {
      const message =
        error instanceof VideoSubtitleExportError
          ? error.kind === 'load'
            ? t('editor.videoExport.loadError')
            : error.kind === 'unsupported'
              ? t('editor.videoExport.unsupportedError')
              : error.kind === 'output'
                ? t('editor.videoExport.outputError')
                : t('editor.videoExport.executionError')
          : t('editor.videoExport.executionError');
      setVideoExportError(message);
      setVideoExportStatus('error');
    }
  };

  const handleCloseVideoExport = () => {
    if (videoExportBusy) return;
    setVideoExportOpen(false);
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
        onSave={saveSubtitles}
        onExport={() => setIsExportOpen(true)}
        onExportVideo={() => void handleExportVideo()}
        exportVideoDisabled={!canExportVideo}
      />

      <main className="editor-main">
        <section className="editor-video-shell">
          <VideoPlayer
            videoUrl={videoUrl}
            loading={routeLoading || videoLoading}
            error={videoError}
            currentTime={currentTime}
            onTimeUpdate={setCurrentTime}
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
              onSelectCue={(item) => setCurrentTime(item.start)}
              onCueVisibilityToggle={toggleCueOverride}
              getResolvedVisibility={getResolvedVisibility}
              onAddCue={addCue}
              onStartTextEdit={(item) =>
                startEditingText(item, getSourceTextById(sourceSubtitles, item.id))
              }
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
      />
    </div>
  );
};
