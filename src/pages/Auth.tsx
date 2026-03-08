import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';
import type { AppRole } from '@/types';

type AuthTab = 'register' | 'login';

interface FieldErrors {
  role?: string;
  fullName?: string;
  email?: string;
  password?: string;
}

const GlassInput = ({
  icon: Icon,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  icon: React.ElementType;
  error?: boolean;
}) => (
  <div
    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors
      ${error
        ? 'border-destructive/50 bg-destructive/5'
        : 'border-border/40 bg-card/60 backdrop-blur-sm hover:border-border focus-within:border-primary/50 focus-within:bg-card/80'
      }`}
  >
    <Icon className="h-4 w-4 shrink-0 text-muted-foreground/60" />
    <input
      className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none w-full"
      {...props}
    />
  </div>
);

const Auth = () => {
  const [tab, setTab] = useState<AuthTab>('login');
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  const clearError = (field: keyof FieldErrors) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateRegister = (): boolean => {
    const newErrors: FieldErrors = {};
    if (!selectedRole) newErrors.role = 'Выберите роль';
    if (!fullName.trim()) newErrors.fullName = 'Введите полное имя';
    if (!email.trim()) newErrors.email = 'Введите email';
    if (password.length < 8) newErrors.password = 'Минимум 8 символов';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateRegister()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName },
        },
      });
      if (error) throw error;

      if (data.user) {
        await supabase.from('profiles').update({ full_name: fullName }).eq('id', data.user.id);
        await supabase.from('user_roles').insert({ user_id: data.user.id, role: selectedRole! });
      }

      if (data.session) {
        // Auto-confirmed — will redirect via auth state change
      } else {
        setConfirmationEmail(email);
        setShowConfirmation(true);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success('Ссылка для сброса отправлена на почту');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };


  // ── Wrapper ──
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-[400px]">
        <div className="rounded-3xl border border-border/30 bg-card/50 p-8 shadow-lg backdrop-blur-xl">
          {children}
        </div>
      </div>
    </div>
  );

  // ── Confirmation ──
  if (showConfirmation) {
    return (
      <Shell>
        <div className="text-center space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-medium text-foreground">Подтвердите почту</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Мы отправили письмо на{' '}
              <span className="font-medium text-foreground">{confirmationEmail}</span>.
              <br />
              Откройте его, чтобы завершить регистрацию.
            </p>
          </div>
          <button
            onClick={() => { setShowConfirmation(false); setTab('login'); }}
            className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            Перейти ко входу
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </Shell>
    );
  }

  // ── Forgot ──
  if (showForgot) {
    return (
      <Shell>
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-medium text-foreground">Сброс пароля</h2>
            <p className="mt-1 text-xs text-muted-foreground">Введите email для получения ссылки</p>
          </div>
          <form onSubmit={handleForgot} className="space-y-4">
            <GlassInput
              icon={Mail}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e-mail address"
              required
            />
            <SubmitButton loading={loading} label="Отправить ссылку" />
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowForgot(false)}
            >
              ← Назад
            </button>
          </form>
        </div>
      </Shell>
    );
  }

  // ── Main ──
  return (
    <Shell>
      <div className="space-y-6">
        {/* Header with tabs */}
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Bipolar Tracker
          </h1>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => { setTab('login'); setErrors({}); }}
              className={`text-sm font-medium transition-colors ${
                tab === 'login' ? 'text-foreground' : 'text-muted-foreground/60 hover:text-muted-foreground'
              }`}
            >
              Вход
            </button>
            <button
              type="button"
              onClick={() => { setTab('register'); setErrors({}); }}
              className={`text-sm font-medium transition-colors ${
                tab === 'register' ? 'text-foreground' : 'text-muted-foreground/60 hover:text-muted-foreground'
              }`}
            >
              Регистрация
            </button>
          </div>
        </div>

        {/* Google */}
        <button
          type="button"
          onClick={handleGoogle}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border/40 bg-card/60 px-4 py-3 text-sm font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-card/80"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Google
        </button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border/40" />
          <span className="text-[11px] text-muted-foreground/50 uppercase tracking-wider">или</span>
          <div className="h-px flex-1 bg-border/40" />
        </div>

        {/* ── LOGIN ── */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-3">
            <GlassInput
              icon={Mail}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e-mail address"
              required
            />
            <div className="space-y-1.5">
              <div className="relative">
                <GlassInput
                  icon={Lock}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg border border-border/40 bg-card/80 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  забыл
                </button>
              </div>
            </div>

            <div className="pt-1">
              <SubmitButton loading={loading} label="Войти" />
            </div>
          </form>
        )}

        {/* ── REGISTER ── */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3">
            {/* Role */}
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                Роль
              </p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: 'doctor' as AppRole, label: 'Врач' },
                  { value: 'patient' as AppRole, label: 'Пациент' },
                ] as const).map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => { setSelectedRole(r.value); clearError('role'); }}
                    className={`rounded-2xl border px-3 py-2.5 text-sm font-medium transition-all ${
                      selectedRole === r.value
                        ? 'border-primary/50 bg-primary/10 text-foreground shadow-sm'
                        : `border-border/30 bg-card/40 text-muted-foreground hover:border-border/60 hover:bg-card/60 ${errors.role ? 'border-destructive/40' : ''}`
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              {errors.role && <p className="text-[11px] text-destructive">{errors.role}</p>}
            </div>

            <GlassInput
              icon={User}
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); clearError('fullName'); }}
              placeholder="Полное имя"
              error={!!errors.fullName}
            />
            {errors.fullName && <p className="text-[11px] text-destructive -mt-1">{errors.fullName}</p>}

            <GlassInput
              icon={Mail}
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearError('email'); }}
              placeholder="e-mail address"
              error={!!errors.email}
            />
            {errors.email && <p className="text-[11px] text-destructive -mt-1">{errors.email}</p>}

            <div className="space-y-1">
              <GlassInput
                icon={Lock}
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearError('password'); }}
                placeholder="пароль"
                minLength={8}
                error={!!errors.password}
              />
              {errors.password ? (
                <p className="text-[11px] text-destructive">{errors.password}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground/50 pl-1">Минимум 8 символов</p>
              )}
            </div>

            <div className="pt-1">
              <SubmitButton loading={loading} label="Зарегистрироваться" />
            </div>
          </form>
        )}

        {/* Footer hint */}
        <p className="text-center text-[11px] text-muted-foreground/50">
          Clinical daily tracking · Private by default
        </p>
      </div>
    </Shell>
  );
};

const SubmitButton = ({ loading, label }: { loading: boolean; label: string }) => (
  <button
    type="submit"
    disabled={loading}
    className="group flex w-full items-center justify-between rounded-2xl bg-foreground px-5 py-3.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
  >
    <span>{label}</span>
    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-background/20">
      <ArrowRight className="h-3.5 w-3.5 text-background" />
    </div>
  </button>
);

export default Auth;
