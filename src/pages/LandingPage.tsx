import React from 'react';
import { ArrowRight, ArrowDown, Edit3, HardDrive, Languages, Play, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PublicNavbar } from '../components/common/PublicNavbar';

interface LandingPageProps {
  onGetStarted: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  const { t } = useTranslation();

  const steps = [
    { number: '01', icon: HardDrive, title: t('landing.workflow.step1Title'), text: t('landing.workflow.step1Text') },
    { number: '02', icon: Languages, title: t('landing.workflow.step2Title'), text: t('landing.workflow.step2Text') },
    { number: '03', icon: Edit3, title: t('landing.workflow.step3Title'), text: t('landing.workflow.step3Text') },
  ];

  const supportedLanguages = [
    { code: 'vi', flag: '🇻🇳' },
    { code: 'en', flag: '🇺🇸' },
    { code: 'ja', flag: '🇯🇵' },
    { code: 'ko', flag: '🇰🇷' },
    { code: 'zh', flag: '🇨🇳' },
    { code: 'fr', flag: '🇫🇷' },
    { code: 'it', flag: '🇮🇹' },
  ];

  const scrollToWorkflow = () => {
    document.getElementById('workflow')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="ui-page flex-1 landing-page">
      <PublicNavbar onNext={onGetStarted} />

      <main>
        <section className="landing-hero ui-container">
          <div className="landing-hero-copy">
            <span className="landing-eyebrow"><Sparkles className="size-3.5" />{t('landing.eyebrow')}</span>
            <h1>{t('landing.hero.title')}</h1>
            <p>{t('landing.hero.description')}</p>
            <div className="landing-hero-actions">
              <button onClick={onGetStarted} className="ui-button ui-button-primary ui-button-large">{t('landing.hero.primary')}<ArrowRight className="size-4" /></button>
              <button onClick={scrollToWorkflow} className="ui-button ui-button-secondary ui-button-large">{t('landing.hero.learnMore')}<ArrowDown className="size-4" /></button>
            </div>
          </div>

          <div className="landing-product-proof" aria-label={t('landing.previewAria')}>
            <div className="landing-proof-toolbar"><span className="size-2.5 rounded-full bg-[var(--ui-danger)]" /><span className="size-2.5 rounded-full bg-[var(--ui-warning)]" /><span className="size-2.5 rounded-full bg-[var(--ui-success)]" /><span className="ml-2 text-[11px] ui-muted font-mono font-bold">LTS.ai Editor</span></div>
            <div className="landing-proof-video relative overflow-hidden group">
              <img src="/landing-preview.png" alt="Video Preview" className="absolute inset-0 w-full h-full object-cover object-center opacity-85 group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/20" />
              <div className="relative z-10 size-14 rounded-full bg-white/20 border border-white/30 grid place-items-center shadow-lg group-hover:bg-white/30 transition-all cursor-pointer">
                <Play className="size-6 text-white ml-0.5" />
              </div>
              <span className="landing-proof-time z-10">00:14 → 00:18</span>
            </div>
            <div className="landing-proof-cue">
              <div><p>{t('landing.mock.originalLabel')}</p><strong>{t('landing.mock.originalText')}</strong></div>
              <div><p className="text-[var(--ui-accent)]">{t('landing.mock.targetLabel')}</p><strong>{t('landing.mock.translatedText')}</strong></div>
            </div>
          </div>
        </section>

        <section id="workflow" className="landing-workflow-section">
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

        <section className="landing-workflow-section landing-languages-section">
          <div className="ui-container">
            <div className="landing-section-heading text-center mx-auto mb-8">
              <h2>{t('landing.languagesSection.title')}</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 max-w-4xl mx-auto">
              {supportedLanguages.map((lang) => (
                <div key={lang.code} className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-[var(--ui-surface)] border border-[var(--ui-border)] hover:border-[var(--ui-accent)] transition-all text-center shadow-xs">
                  <span className="text-2xl mb-1">{lang.flag}</span>
                  <span className="text-xs font-bold">{t(`landing.languagesSection.${lang.code}`)}</span>
                  <span className="text-[10px] ui-soft uppercase tracking-wider font-mono mt-0.5">{lang.code}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-cta ui-container">
          <h2>{t('landing.cta.title')}</h2>
          <p>{t('landing.cta.description')}</p>
          <button onClick={onGetStarted} className="ui-button ui-button-primary ui-button-large">{t('landing.cta.action')}<ArrowRight className="size-4" /></button>
        </section>
      </main>
    </div>
  );
};
