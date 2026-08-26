import React, { useCallback, useRef, useState } from 'react';
import type { FileMedia } from '../types/database';
import type { ProcessingProgress } from '../types/processing';
import { fileService } from '../services/fileService';
import { ProcessingContext, type ProcessingQueueItem } from './processing-context';

const FILE_PROCESSING_CONCURRENCY = 2;

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
              // The compact widget follows whichever active file emitted the
              // latest progress; per-file progress remains available in the map.
              setActiveItem(current);
              setActivePercent(Math.min(100, Math.max(0, Math.round(progress.percent))));
              if (progress.message) setActiveMessage(progress.message);
            }
          );
          setCompletedCount((prev) => prev + 1);
        } catch (err) {
          console.error('Error processing background file:', current.file.file_name, err);
          setFailedCount((prev) => prev + 1);
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

    // An item may be appended just as the last worker exits. Start a new batch
    // instead of leaving that item queued until another user action occurs.
    if (queueRef.current.length > 0) {
      void runProcessingQueue();
      return;
    }

    // Auto-dismiss widget after 6 seconds of completion
    dismissTimerRef.current = window.setTimeout(() => {
      setIsWidgetVisible(false);
      dismissTimerRef.current = null;
    }, 6000);
  }, []);

  const startProcessingProject = useCallback(
    async (projectId: string, filesToProcess: FileMedia[]) => {
      const newItems: ProcessingQueueItem[] = filesToProcess.map((file) => ({
        file,
        projectId,
      }));

      queueRef.current = [...queueRef.current, ...newItems];
      setQueuedItems([...queueRef.current]);
      setTotalCount((prev) => (isProcessingRef.current ? prev + newItems.length : newItems.length));
      if (!isProcessingRef.current) {
        setCompletedCount(0);
        setFailedCount(0);
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
