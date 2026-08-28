import React, { useCallback, useRef, useState } from 'react';
import type { FileMedia } from '../types/database';
import type { ProcessingProgress } from '../types/processing';
import { fileService } from '../services/fileService';
import { ProcessingContext, type ProcessingQueueItem } from './processing-context';

const FILE_PROCESSING_CONCURRENCY = 1;

export const ProcessingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [queuedItems, setQueuedItems] = useState<ProcessingQueueItem[]>([]);
  const [activeItem, setActiveItem] = useState<ProcessingQueueItem | null>(null);
  const [progressByFile, setProgressByFile] = useState<Record<string, ProcessingProgress>>({});
  const [completedCount, setCompletedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [activePercent, setActivePercent] = useState(0);
  const [activeMessage, setActiveMessage] = useState('');
  const [isWidgetVisible, setIsWidgetVisible] = useState(false);

  const isProcessingRef = useRef(false);
  const queueRef = useRef<ProcessingQueueItem[]>([]);
  const inFlightFileIdsRef = useRef<Set<string>>(new Set());
  const dismissTimerRef = useRef<number | null>(null);

  const dismissWidget = useCallback(() => {
    if (dismissTimerRef.current) {
      window.clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setIsWidgetVisible(false);
  }, []);

  const runQueue = useCallback(async function runProcessingQueue() {
    if (isProcessingRef.current) return;
    if (queueRef.current.length === 0) return;

    isProcessingRef.current = true;
    setIsProcessing(true);
    setIsWidgetVisible(true);

    if (dismissTimerRef.current) {
      window.clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }

    const runWorker = async (): Promise<void> => {
      while (queueRef.current.length > 0) {
        const current = queueRef.current.shift();
        if (!current) return;

        inFlightFileIdsRef.current.add(current.file.id);
        setActiveItem(current);
        setQueuedItems([...queueRef.current]);
        setActivePercent(0);
        setActiveMessage('Đang chuẩn bị...');

        try {
          await fileService.processSingleDraftFile(
            current.projectId,
            current.file,
            (progress) => {
              setProgressByFile((prev) => ({ ...prev, [progress.fileId]: progress }));
              setActiveItem(current);
              setActivePercent(Math.min(100, Math.max(0, Math.round(progress.percent))));
              if (progress.message) setActiveMessage(progress.message);
            }
          );
          setCompletedCount((prev) => prev + 1);
        } catch (err) {
          console.error('Error processing background file:', current.file.file_name, err);
          setFailedCount((prev) => prev + 1);
        } finally {
          inFlightFileIdsRef.current.delete(current.file.id);
        }
      }
    };

    await Promise.all(
      Array.from(
        { length: Math.min(FILE_PROCESSING_CONCURRENCY, queueRef.current.length) },
        () => runWorker()
      )
    );

    setActiveItem(null);
    setActivePercent(100);
    setActiveMessage('Hoàn thành');
    isProcessingRef.current = false;
    setIsProcessing(false);

    if (queueRef.current.length > 0) {
      void runProcessingQueue();
      return;
    }

    inFlightFileIdsRef.current.clear();

    dismissTimerRef.current = window.setTimeout(() => {
      setIsWidgetVisible(false);
      dismissTimerRef.current = null;
    }, 6000);
  }, []);

  const startProcessingProject = useCallback(
    async (projectId: string, filesToProcess: FileMedia[]) => {
      const activeOrQueuedIds = new Set([
        ...inFlightFileIdsRef.current,
        ...queueRef.current.map((q) => q.file.id),
      ]);

      const uniqueFiles = filesToProcess.filter((f) => !activeOrQueuedIds.has(f.id));
      if (uniqueFiles.length === 0 && isProcessingRef.current) return;

      const newItems: ProcessingQueueItem[] = uniqueFiles.map((file) => ({
        file,
        projectId,
      }));

      const queuedProgress: Record<string, ProcessingProgress> = {};
      uniqueFiles.forEach((file) => {
        queuedProgress[file.id] = {
          fileId: file.id,
          stage: 'queued',
          percent: 0,
          message: 'Đang xếp hàng...',
        };
      });

      if (!isProcessingRef.current) {
        queueRef.current = [...newItems];
        setQueuedItems([...newItems]);
        setProgressByFile((prev) => ({ ...prev, ...queuedProgress }));
        setCompletedCount(0);
        setFailedCount(0);
        setTotalCount(newItems.length);
      } else {
        queueRef.current = [...queueRef.current, ...newItems];
        setQueuedItems([...queueRef.current]);
        setProgressByFile((prev) => ({ ...prev, ...queuedProgress }));
        setTotalCount((prev) => prev + newItems.length);
      }

      void runQueue();
    },
    [runQueue]
  );

  return (
    <ProcessingContext.Provider
      value={{
        isProcessing,
        queuedItems,
        activeItem,
        progressByFile,
        completedCount,
        failedCount,
        totalCount,
        activePercent,
        activeMessage,
        isWidgetVisible,
        startProcessingProject,
        dismissWidget,
      }}
    >
      {children}
    </ProcessingContext.Provider>
  );
};
