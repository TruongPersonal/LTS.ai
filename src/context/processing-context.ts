import { createContext } from 'react';
import type { FileMedia } from '../types/database';
import type { ProcessingProgress } from '../types/processing';

export interface ProcessingQueueItem {
  file: FileMedia;
  projectId: string;
}

export interface GlobalProcessingContextType {
  isProcessing: boolean;
  queuedItems: ProcessingQueueItem[];
  activeItem: ProcessingQueueItem | null;
  progressByFile: Record<string, ProcessingProgress>;
  completedCount: number;
  failedCount: number;
  totalCount: number;
  activePercent: number;
  activeMessage: string;
  isWidgetVisible: boolean;
  startProcessingProject: (projectId: string, files: FileMedia[]) => Promise<void>;
  dismissWidget: () => void;
  clearFileProgress: (fileId: string) => void;
}

export const ProcessingContext = createContext<GlobalProcessingContextType | null>(null);
