import React from 'react';

interface ProjectGridSkeletonProps {
  count?: number;
}

export const ProjectGridSkeleton: React.FC<ProjectGridSkeletonProps> = ({ count = 3 }) => {
  return (
    <div className="project-grid" role="status" aria-label="Loading projects">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="project-card ui-card-flat p-5 space-y-4">
          <div className="ui-skeleton h-10 w-10 rounded-xl" />
          <div className="ui-skeleton h-5 w-2/3 rounded-lg" />
          <div className="ui-skeleton h-12 w-full rounded-lg" />
          <div className="ui-skeleton h-4 w-1/2 rounded-lg" />
        </div>
      ))}
    </div>
  );
};

interface FileListSkeletonProps {
  count?: number;
}

export const FileListSkeleton: React.FC<FileListSkeletonProps> = ({ count = 3 }) => {
  return (
    <div className="space-y-3" role="status" aria-label="Loading files">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="file-workspace-row p-4 flex items-center gap-3">
          <div className="ui-skeleton size-5 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="ui-skeleton h-4 w-1/3 rounded" />
            <div className="ui-skeleton h-3 w-1/4 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const CueListSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="editor-cue-viewport space-y-3 p-3" role="status" aria-label="Loading cues">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-4 space-y-3.5 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)]/70 backdrop-blur-sm"
          style={{ opacity: Math.max(0.35, 1 - i * 0.18) }}
        >
          {/* Header pill: Index + Timecode */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="ui-skeleton h-5 w-7 rounded-full opacity-80" />
              <div className="ui-skeleton h-5 w-28 rounded-full opacity-80" />
            </div>
            <div className="ui-skeleton size-5 rounded-md opacity-30" />
          </div>

          {/* Subtitle text placeholders: Source (thin) + Translation (full) */}
          <div className="space-y-2 pt-0.5">
            <div className="ui-skeleton h-3.5 w-7/12 rounded-md opacity-40" />
            <div className="ui-skeleton h-4 w-10/12 rounded-md opacity-90" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const EditorSkeleton: React.FC = () => {
  return (
    <div className="editor-workspace" role="status" aria-label="Loading editor">
      <header className="editor-local-toolbar">
        <div className="editor-toolbar-inner">
          <div className="editor-toolbar-main-row">
            <div className="editor-toolbar-lead">
              <div className="min-w-0 flex-1 space-y-1.5 py-1">
                <div className="ui-skeleton h-4 w-44 sm:w-64 rounded-md" />
                <div className="ui-skeleton h-3 w-28 rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="editor-main">
        <section className="editor-video-shell flex items-center justify-center">
          <div className="relative w-full h-full flex items-center justify-center bg-[var(--ui-surface-subtle)]">
            <div className="absolute inset-0 ui-skeleton opacity-80" />
            <div className="relative z-10 size-12 rounded-2xl ui-skeleton shadow-sm" />
          </div>
        </section>

        <section className="editor-cue-section">
          <CueListSkeleton count={3} />
        </section>
      </main>
    </div>
  );
};
