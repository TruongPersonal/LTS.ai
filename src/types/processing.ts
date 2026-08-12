export type ProcessingStage =
  | 'queued'
  | 'preparing'
  | 'downloading'
  | 'preprocessing'
  | 'transcribing'
  | 'finalizing'
  | 'completed'
  | 'failed';

export interface ProcessingProgress {
  fileId: string;
  stage: ProcessingStage;
  percent: number;
  message: string;
  chunkIndex?: number;
  chunkCount?: number;
}

export type ProcessingProgressCallback = (progress: ProcessingProgress) => void;
