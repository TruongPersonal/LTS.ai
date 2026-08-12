import React, { useEffect, useRef, useState } from 'react';
import { Calendar, Edit3, Film, Folder, MoreHorizontal, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Project } from '../../types/database';
import { getLanguageOption } from '../../types/project';
import { formatUiDate } from '../../i18n/formatters';

interface ProjectCardProps {
  project: Project;
  onSelect: (project: Project) => void;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onSelect, onEdit, onDelete }) => {
  const { t, i18n } = useTranslation();
  const language = getLanguageOption(project.target_language);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false); };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => { document.removeEventListener('mousedown', closeOutside); document.removeEventListener('keydown', closeEscape); };
  }, []);

  return (
    <article className="project-card ui-card-flat relative">
      <button type="button" onClick={() => onSelect(project)} className="project-card-main ui-focus-ring" aria-label={t('project.openAria')}>
        <div className="project-card-top">
          <span className="project-folder-icon"><Folder className="size-5" /></span>
          {language && <span className="project-language-pill"><span>{language.flag}</span>{language.nativeName}</span>}
        </div>
        <div className="mt-5 text-left min-w-0">
          <h3 className="text-[15px] font-extrabold break-words line-clamp-2">{project.title}</h3>
          {project.description && <p className="text-xs ui-muted mt-2 line-clamp-2 leading-relaxed">{project.description}</p>}
        </div>
        <div className="project-card-meta">
          <span><Film className="size-3.5" />{t('project.fileCount', { count: project.files_count || 0 })}</span>
          <span><Calendar className="size-3.5" />{formatUiDate(project.created_at, i18n.resolvedLanguage)}</span>
        </div>
      </button>

      <div className="project-card-menu" ref={menuRef}>
        <button type="button" onClick={() => setMenuOpen((value) => !value)} className="ui-icon-button ui-icon-button-sm" aria-haspopup="menu" aria-expanded={menuOpen} aria-label={t('common.more')} title={t('common.more')}><MoreHorizontal className="size-4" /></button>
        {menuOpen && (
          <div className="overflow-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onEdit(project); }}><Edit3 className="size-4" />{t('project.editAria')}</button>
            <button type="button" role="menuitem" className="ui-danger-text" onClick={() => { setMenuOpen(false); onDelete(project); }}><Trash2 className="size-4" />{t('project.deleteAria')}</button>
          </div>
        )}
      </div>
    </article>
  );
};
