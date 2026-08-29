import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FileMedia } from '../types/database';
import type { ProcessingProgress } from '../types/processing';
import { fileService } from '../services/fileService';
import { subtitleService } from '../services/subtitleService';
import { parseSubtitleFile } from '../utils/subtitleParsers';
import { downloadProjectZip, downloadSubtitleFile, type SubtitleExportFormat, type SubtitleExportTrack } from '../utils/exporter';
import { useGlobalProcessing } from './useGlobalProcessing';

export const useProjectFiles = (projectId: string, targetLanguage: string) => {
  const { t } = useTranslation();
  const [files, setFiles] = useState<FileMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [processingProgressByFile, setProcessingProgressByFile] = useState<Record<string, ProcessingProgress>>({});

  const {
    isProcessing: isGlobalProcessing,
    progressByFile: globalProgress,
    startProcessingProject,
    clearFileProgress,
  } = useGlobalProcessing();

  const wasProcessingRef = useRef(false);

  const loadFiles = useCallback(async (silent = false) => {
    if (!projectId) return;
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const data = await fileService.getFilesByProject(projectId);
      setFiles(data);
    } catch (error) {
      console.error('Error fetching project files:', error);
      setLoadError(t('project.loadError'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    void loadFiles(false);
  }, [loadFiles]);

  useEffect(() => {
    if (wasProcessingRef.current && !isGlobalProcessing) {
      void loadFiles(true);
    }
    wasProcessingRef.current = isGlobalProcessing;
  }, [isGlobalProcessing, loadFiles]);


  const addDriveFile = useCallback(
    async (
      driveFileId: string,
      fileName: string,
      mimeType: string,
      durationSeconds: number,
      existingSubtitle?: { content: string; language: string }
    ) => {
      const createdFile = await fileService.addFile(
        projectId,
        driveFileId,
        fileName,
        mimeType,
        durationSeconds,
        existingSubtitle ? 'existing_subtitle' : 'media',
        existingSubtitle?.language || null
      );

      if (existingSubtitle) {
        await subtitleService.saveSubtitles(
          createdFile.id,
          existingSubtitle.language,
          parseSubtitleFile(existingSubtitle.content)
        );
      }

      setFiles((current) => {
        const exists = current.some((f) => f.id === createdFile.id);
        return exists
          ? current.map((f) => (f.id === createdFile.id ? createdFile : f))
          : [createdFile, ...current];
      });

      setProcessingProgressByFile((current) => {
        if (!current[createdFile.id]) return current;
        const next = { ...current };
        delete next[createdFile.id];
        return next;
      });

      clearFileProgress(createdFile.id);

      return createdFile;
    },
    [projectId, clearFileProgress]
  );

  const processAllDrafts = useCallback(async () => {
    const draftFiles = files.filter((f) => f.status === 'draft');
    if (draftFiles.length === 0) return;
    await startProcessingProject(projectId, draftFiles);
  }, [files, projectId, startProcessingProject]);

  const renameFile = useCallback(
    async (fileId: string, newFileName: string) => {
      await fileService.updateFileName(fileId, newFileName);
      setFiles((current) =>
        current.map((f) => (f.id === fileId ? { ...f, file_name: newFileName } : f))
      );
    },
    []
  );

  const deleteFile = useCallback(async (fileId: string) => {
    await fileService.deleteFile(fileId);
    setFiles((current) => current.filter((f) => f.id !== fileId));
    setProcessingProgressByFile((current) => {
      const next = { ...current };
      delete next[fileId];
      return next;
    });
  }, []);

  const exportSingleFile = useCallback(
    async (file: FileMedia, format: SubtitleExportFormat, track: SubtitleExportTrack = 'target') => {
      try {
        const targetSub = await subtitleService.getSubtitleByFile(file.id, targetLanguage);
        const sourceLang = file.detected_source_lang;
        const sourceSub = sourceLang ? await subtitleService.getSubtitleByFile(file.id, sourceLang) : null;
        await downloadSubtitleFile(
          targetSub?.content || [],
          sourceSub?.content || [],
          file.file_name,
          format,
          track
        );
      } catch (error) {
        console.error('Export single file failed:', error);
        throw error;
      }
    },
    [targetLanguage]
  );

  const exportProjectZip = useCallback(
    async (projectName: string, format: SubtitleExportFormat, track: SubtitleExportTrack = 'target') => {
      try {
        const completedFiles = files.filter((f) => f.status === 'completed');
        const items = await Promise.all(
          completedFiles.map(async (file) => {
            const targetSub = await subtitleService.getSubtitleByFile(file.id, targetLanguage);
            const sourceLang = file.detected_source_lang;
            const sourceSub = sourceLang ? await subtitleService.getSubtitleByFile(file.id, sourceLang) : null;
            return {
              fileName: file.file_name,
              subtitles: targetSub?.content || [],
              sourceSubtitles: sourceSub?.content || [],
            };
          })
        );
        await downloadProjectZip(projectName, items, format, track);
      } catch (error) {
        console.error('Export project ZIP failed:', error);
        throw error;
      }
    },
    [files, targetLanguage]
  );

  return {
    files,
    loading,
    loadError,
    processingProgressByFile: { ...processingProgressByFile, ...globalProgress },
    isProcessing: isGlobalProcessing,
    loadFiles,
    addDriveFile,
    processAllDrafts,
    renameFile,
    deleteFile,
    exportSingleFile,
    exportProjectZip,
  };
};
