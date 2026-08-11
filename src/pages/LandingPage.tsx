import React from 'react';
import { ArrowRight, CheckCircle2, Edit3, HardDrive, Languages, Play, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PublicPreferencesControls } from '../components/common/PublicPreferencesControls';

interface LandingPageProps { onGetStarted: () => void; }

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  const { t } = useTranslation();
  const steps = [
    { number: '01', icon: HardDrive, title: t('landing.workflow.step1Title'), text: t('landing.workflow.step1Text') },
    { number: '02', icon: Languages, title: t('landing.workflow.step2Title'), text: t('landing.workflow.step2Text') },
    { number: '03', icon: Edit3, title: t('landing.workflow.step3Title'), text: t('landing.workflow.step3Text') },
  ];

  return (
    <div className="ui-page flex-1 landing-page">
      <header className="landing-header">
        <div className="ui-container min-h-16 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5"><img src="/logo.png" alt="LTS.ai" className="size-9 object-contain" /><span className="font-extrabold">LTS.ai</span></div>
          <div className="flex items-center gap-2 ml-auto"><PublicPreferencesControls /><button onClick={onGetStarted} className="ui-button ui-button-primary">{t('common.open')}<ArrowRight className="size-4" /></button></div>
        </div>
      </header>

      <main>
        <section className="landing-hero ui-container">
          <div className="landing-hero-copy">
            <span className="landing-eyebrow"><Sparkles className="size-3.5" />{t('landing.eyebrow')}</span>
            <h1>{t('landing.hero.title')}</h1>
            <p>{t('landing.hero.description')}</p>
            <div className="landing-hero-actions">
              <button onClick={onGetStarted} className="ui-button ui-button-primary ui-button-large">{t('landing.hero.primary')}<ArrowRight className="size-4" /></button>
              <span className="landing-privacy"><CheckCircle2 className="size-4 text-[var(--ui-success)]" />{t('landing.hero.privacy')}</span>
            </div>
          </div>

          <div className="landing-product-proof" aria-label={t('landing.previewAria')}>
            <div className="landing-proof-toolbar"><span className="size-2.5 rounded-full bg-[var(--ui-danger)]" /><span className="size-2.5 rounded-full bg-[var(--ui-warning)]" /><span className="size-2.5 rounded-full bg-[var(--ui-success)]" /><span className="ml-2 text-[11px] ui-muted">LTS.ai Editor</span></div>
            <div className="landing-proof-video"><Play className="size-11 text-white" /><span className="landing-proof-time">00:14 → 00:18</span></div>
            <div className="landing-proof-cue">
              <div><p>{t('landing.mock.original')}</p><strong>{t('landing.mock.originalText')}</strong></div>
              <div><p className="text-[var(--ui-accent)]">{t('landing.mock.targetLanguage')}</p><strong>{t('landing.mock.translatedText')}</strong></div>
            </div>
          </div>
        </section>

        <section className="landing-workflow-section">
          <div className="ui-container">
            <div className="landing-section-heading"><h2>{t('landing.workflow.title')}</h2><p>{t('landing.workflow.description')}</p></div>
            <div className="landing-workflow-timeline">
              {steps.map(({ number, icon: Icon, title, text }, index) => (
                <article key={number} className="landing-workflow-step">
                  <div className="landing-step-marker"><span>{number}</span><Icon className="size-5" /></div>
                  <div><h3>{title}</h3><p>{text}</p></div>
                  {index < steps.length - 1 && <div className="landing-step-line" aria-hidden="true" />}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="ui-container landing-capabilities">
          <article><span>01</span><div><h3>{t('landing.capabilities.driveTitle')}</h3><p>{t('landing.capabilities.driveText')}</p></div></article>
          <article><span>02</span><div><h3>{t('landing.capabilities.aiTitle')}</h3><p>{t('landing.capabilities.aiText')}</p></div></article>
          <article><span>03</span><div><h3>{t('landing.capabilities.editorTitle')}</h3><p>{t('landing.capabilities.editorText')}</p></div></article>
        </section>

        <section className="landing-cta ui-container">
          <h2>{t('landing.cta.title')}</h2><p>{t('landing.cta.description')}</p><button onClick={onGetStarted} className="ui-button ui-button-primary ui-button-large">{t('landing.cta.action')}<ArrowRight className="size-4" /></button>
        </section>
      </main>
    </div>
  );
};
