import React from 'react';
import { ArrowRight, ArrowDown, Edit3, HardDrive, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PublicNavbar } from '../components/common/PublicNavbar';
import { LandingShowcaseGallery } from '../components/landing/LandingShowcaseGallery';
import { LandingHeroVideo } from '../components/landing/LandingHeroVideo';

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
            <span className="landing-eyebrow">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {t('landing.eyebrow')}
            </span>
            <h1 className="cosmic-gradient-text">{t('landing.hero.title')}</h1>
            <p>{t('landing.hero.description')}</p>
            <div className="landing-hero-actions">
              <button onClick={onGetStarted} className="ui-button ui-button-primary ui-button-large">
                {t('landing.hero.primary')}
                <ArrowRight className="size-4" />
              </button>
              <button onClick={scrollToWorkflow} className="ui-button ui-button-secondary ui-button-large">
                {t('landing.hero.learnMore')}
                <ArrowDown className="size-4" />
              </button>
            </div>
          </div>

          <LandingHeroVideo />
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
            <div className="flex flex-wrap items-center justify-center gap-3 max-w-[620px] mx-auto">
              {supportedLanguages.map((lang) => (
                <div
                  key={lang.code}
                  className="flex flex-col items-center justify-center w-[125px] sm:w-[135px] p-3.5 sm:p-4 rounded-2xl bg-[var(--ui-surface)] border border-[var(--ui-border)] hover:border-[var(--ui-accent)] transition-all text-center shadow-xs"
                >
                  <span className="text-2xl mb-1.5">{lang.flag}</span>
                  <span className="text-xs font-bold text-[var(--ui-text)]">{t(`landing.languagesSection.${lang.code}`)}</span>
                  <span className="text-[10px] ui-soft uppercase tracking-wider font-mono mt-0.5">{lang.code}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {}
        <LandingShowcaseGallery />

        <section className="landing-cta ui-container">
          <h2>{t('landing.cta.title')}</h2>
          <p>{t('landing.cta.description')}</p>
          <button onClick={onGetStarted} className="ui-button ui-button-primary ui-button-large">{t('landing.cta.action')}<ArrowRight className="size-4" /></button>
        </section>
      </main>
    </div>
  );
};
