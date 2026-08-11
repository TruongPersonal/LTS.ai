import React, { useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { PublicPreferencesControls } from '../components/common/PublicPreferencesControls';

interface LoginPageProps {
  onViewLanding?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onViewLanding }) => {
  const { t } = useTranslation();
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Google sign in failed:', error);
      setErrorMsg(t('auth.loginError'));
      setLoading(false);
    }
  };

  return (
    <div className="ui-page flex-1 flex flex-col">
      <header className="border-b border-[var(--ui-border)] bg-[var(--ui-surface)]">
        <div className="ui-container min-h-16 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="LTS.ai" className="size-9 object-contain" />
            <span className="font-extrabold">LTS.ai</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <PublicPreferencesControls />
            {onViewLanding && <button onClick={onViewLanding} className="ui-button ui-button-ghost"><ArrowLeft className="size-4" />{t('navigation.backHome')}</button>}
          </div>
        </div>
      </header>

      <main className="flex-1 grid place-items-center px-4 py-10">
        <section className="ui-card w-full max-w-sm p-7 sm:p-8 text-center">
          <img src="/logo.png" alt="LTS.ai" className="size-12 object-contain mx-auto" />
          <h1 className="text-xl font-extrabold mt-4">{t('auth.welcomeBack')}</h1>
          <p className="text-xs ui-muted mt-2">{t('auth.subtitle')}</p>
          {errorMsg && <p role="alert" className="ui-status-error p-3 text-xs mt-5 text-left">{errorMsg}</p>}
          <button onClick={handleGoogleLogin} disabled={loading} className="ui-button ui-button-secondary w-full mt-6">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <span aria-hidden="true">G</span>}
            <span>{loading ? t('auth.redirecting') : t('auth.googleContinue')}</span>
          </button>
          <p className="text-[10px] leading-relaxed ui-soft mt-4">{t('auth.googleDriveExplanation')}</p>
        </section>
      </main>
    </div>
  );
};
