import React, { useState } from 'react';
import { LogIn, Loader2, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { PublicNavbar } from '../components/common/PublicNavbar';

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
    <div className="ui-page flex-1 flex flex-col relative overflow-hidden">
      <PublicNavbar onBack={onViewLanding} />

      <main className="flex-1 grid place-items-center px-4 py-12 relative z-10">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,var(--ui-surface-subtle),transparent_70%)] opacity-80" />

        <section className="ui-card w-full max-w-md p-8 sm:p-9 text-center shadow-xl relative z-10 border border-[var(--ui-border)] rounded-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--ui-surface-subtle)] border border-[var(--ui-border)] text-[11px] font-bold text-[var(--ui-primary)] mb-5">
            <LogIn className="size-3.5" />
            <span>{t('auth.badge')}</span>
          </div>

          <div className="size-14 rounded-2xl bg-[var(--ui-surface-subtle)] border border-[var(--ui-border)] p-2.5 mx-auto mb-4 grid place-items-center shadow-xs">
            <img src="/logo.png" alt="LTS.ai" className="size-9 object-contain" />
          </div>

          <h1 className="text-2xl font-black tracking-tight">{t('auth.welcomeBack')}</h1>
          <p className="text-xs ui-muted mt-2 max-w-xs mx-auto leading-relaxed">{t('auth.subtitle')}</p>

          {errorMsg && (
            <p role="alert" className="ui-status-error p-3 text-xs mt-5 text-left rounded-xl">
              {errorMsg}
            </p>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="ui-button ui-button-primary w-full mt-7 h-11 text-xs font-bold rounded-xl flex items-center justify-center gap-2.5 shadow-sm transition-all active:scale-[0.99]"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <svg className="size-4.5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
            )}
            <span>{loading ? t('auth.redirecting') : t('auth.googleContinue')}</span>
          </button>

          <div className="mt-8 pt-6 border-t border-[var(--ui-border)] grid grid-cols-3 gap-2 text-[10px] ui-muted font-bold">
            <div className="flex items-center justify-center gap-1.5">
              <Sparkles className="size-3.5 text-[var(--ui-accent)]" />
              <span>{t('auth.secure')}</span>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <ShieldCheck className="size-3.5 text-[var(--ui-success)]" />
              <span>{t('auth.fastAi')}</span>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <Zap className="size-3.5 text-[var(--ui-warning)]" />
              <span>{t('auth.driveSync')}</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
