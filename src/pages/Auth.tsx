import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';
import type { AppRole } from '@/types';

/* ─── Shared UI ─── */

const fieldBase =
'flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors';
const fieldNormal =
'border-border/40 bg-card/60 backdrop-blur-sm hover:border-border focus-within:border-primary/50 focus-within:bg-card/80';
const fieldError = 'border-destructive/50 bg-destructive/5';

const inputClass =
'flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none w-full';

const Shell = ({ children }: {children: React.ReactNode;}) =>
<div className="flex min-h-screen items-center justify-center bg-background p-4">
    <div className="w-full max-w-[400px]">
      <div className="rounded-3xl border border-border/30 bg-card/50 p-8 shadow-lg backdrop-blur-xl">
        {children}
      </div>
    </div>
  </div>;


const SubmitButton = ({ loading, label }: {loading: boolean;label: string;}) =>
<button
  type="submit"
  disabled={loading}
  className="group flex w-full items-center justify-between rounded-2xl bg-foreground px-5 py-3.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50">
  
    <span>{label}</span>
    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-background/20">
      <ArrowRight className="h-3.5 w-3.5 text-background" />
    </div>
  </button>;


/* ─── Login Form ─── */

const LoginForm = ({
  loading,
  onSubmit,
  onForgot




}: {loading: boolean;onSubmit: (email: string, password: string) => void;onForgot: () => void;}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handle = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      console.log('LOGIN_CLICK', { email });
      onSubmit(email, password);
    },
    [email, password, onSubmit]
  );

  return (
    <form onSubmit={handle} className="space-y-3">
      <div className={`${fieldBase} ${fieldNormal}`}>
        <label htmlFor="email" className="sr-only">Email</label>
        <Mail className="h-4 w-4 shrink-0 text-muted-foreground/60" />
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e-mail address"
          required
          className={inputClass} />
        
      </div>

      <div className="space-y-1.5">
        <div className="relative">
          <div className={`${fieldBase} ${fieldNormal}`}>
            <label htmlFor="password" className="sr-only">Password</label>
            <Lock className="h-4 w-4 shrink-0 text-muted-foreground/60" />
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              required
              className={inputClass} />
            
          </div>
          <button
            type="button"
            onClick={onForgot}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg border border-border/40 bg-card/80 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
            
            забыл
          </button>
        </div>
      </div>

      <div className="pt-1">
        <SubmitButton loading={loading} label="Войти" />
      </div>
    </form>);

};

/* ─── Register Form ─── */

interface FieldErrors {
  role?: string;
  fullName?: string;
  email?: string;
  password?: string;
}

const RegisterForm = ({
  loading,
  onSubmit,
  onSwitchLogin




}: {loading: boolean;onSubmit: (data: {email: string;password: string;fullName: string;role: AppRole;}) => void;onSwitchLogin: () => void;}) => {
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  const clearError = (field: keyof FieldErrors) =>
  setErrors((prev) => {
    const next = { ...prev };
    delete next[field];
    return next;
  });

  const handle = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('REGISTER_CLICK', { email, fullName, role: selectedRole });
    const newErrors: FieldErrors = {};
    if (!selectedRole) newErrors.role = 'Выберите роль';
    if (!fullName.trim()) newErrors.fullName = 'Введите полное имя';
    if (!email.trim()) newErrors.email = 'Введите email';
    if (password.length < 8) newErrors.password = 'Минимум 8 символов';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    onSubmit({ email, password, fullName, role: selectedRole! });
  };

  return (
    <>
      <form onSubmit={handle} className="space-y-3">
        {/* Role */}
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
            Роль
          </p>
          <div className="grid grid-cols-2 gap-2">
            {([
            { value: 'doctor' as AppRole, label: 'Врач' },
            { value: 'patient' as AppRole, label: 'Пациент' }] as
            const).map((r) =>
            <button
              key={r.value}
              type="button"
              onClick={() => {setSelectedRole(r.value);clearError('role');}}
              className={`rounded-2xl border px-3 py-2.5 text-sm font-medium transition-all ${
              selectedRole === r.value ?
              'border-primary/50 bg-primary/10 text-foreground shadow-sm' :
              `border-border/30 bg-card/40 text-muted-foreground hover:border-border/60 hover:bg-card/60 ${errors.role ? 'border-destructive/40' : ''}`}`
              }>
              
                {r.label}
              </button>
            )}
          </div>
          {errors.role && <p className="text-[11px] text-destructive">{errors.role}</p>}
        </div>

        {/* Full name */}
        <div>
          <div className={`${fieldBase} ${errors.fullName ? fieldError : fieldNormal}`}>
            <label htmlFor="full_name" className="sr-only">Full name</label>
            <User className="h-4 w-4 shrink-0 text-muted-foreground/60" />
            <input
              id="full_name"
              name="full_name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => {setFullName(e.target.value);clearError('fullName');}}
              placeholder="Полное имя"
              className={inputClass} />
            
          </div>
          {errors.fullName && <p className="text-[11px] text-destructive mt-1">{errors.fullName}</p>}
        </div>

        {/* Email */}
        <div>
          <div className={`${fieldBase} ${errors.email ? fieldError : fieldNormal}`}>
            <label htmlFor="register_email" className="sr-only">Email</label>
            <Mail className="h-4 w-4 shrink-0 text-muted-foreground/60" />
            <input
              id="register_email"
              name="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => {setEmail(e.target.value);clearError('email');}}
              placeholder="e-mail address"
              className={inputClass} />
            
          </div>
          {errors.email && <p className="text-[11px] text-destructive mt-1">{errors.email}</p>}
        </div>

        {/* Password */}
        <div className="space-y-1">
          <div className={`${fieldBase} ${errors.password ? fieldError : fieldNormal}`}>
            <label htmlFor="register_password" className="sr-only">Password</label>
            <Lock className="h-4 w-4 shrink-0 text-muted-foreground/60" />
            <input
              id="register_password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {setPassword(e.target.value);clearError('password');}}
              placeholder="пароль"
              minLength={8}
              className={inputClass} />
            
          </div>
          {errors.password ?
          <p className="text-[11px] text-destructive">{errors.password}</p> :

          <p className="text-[11px] text-muted-foreground/50 pl-1">Минимум 8 символов</p>
          }
        </div>

        <div className="pt-1">
          <SubmitButton loading={loading} label="Зарегистрироваться" />
        </div>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-5">
        Уже есть аккаунт?{' '}
        <button
          type="button"
          onClick={() => {console.log('SWITCH_TO_LOGIN');onSwitchLogin();}}
          className="font-medium text-foreground underline hover:opacity-70 transition-opacity">
          
          Войти
        </button>
      </p>
    </>);

};

/* ─── Main Auth Page ─── */

const Auth = () => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');

  const handleLogin = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRegister = useCallback(
    async (data: {email: string;password: string;fullName: string;role: AppRole;}) => {
      setLoading(true);
      try {
        const { data: result, error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: data.fullName }
          }
        });
        if (error) throw error;

        if (result.user) {
          await supabase.from('profiles').update({ full_name: data.fullName }).eq('id', result.user.id);
          await supabase.from('user_roles').insert({ user_id: result.user.id, role: data.role });
        }

        if (result.session) {














          // auto-confirmed
        } else {setConfirmationEmail(data.email);setShowConfirmation(true);}} catch (err: any) {toast.error(err.message);} finally {setLoading(false);}}, []);const handleForgot = async (e: React.FormEvent) => {e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) throw error;
      toast.success('Ссылка для сброса отправлена на почту');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

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
            onClick={() => {setShowConfirmation(false);setTab('login');}}
            className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors">
            
            Перейти ко входу
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </Shell>);

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
            <div className={`${fieldBase} ${fieldNormal}`}>
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground/60" />
              <input
                type="email"
                name="email"
                autoComplete="username"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="e-mail address"
                required
                className={inputClass} />
              
            </div>
            <SubmitButton loading={loading} label="Отправить ссылку" />
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowForgot(false)}>
              
              ← Назад
            </button>
          </form>
        </div>
      </Shell>);

  }

  // ── Main ──
  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Bipolar 
Mania
Tracker
</h1>
          <div className="flex gap-4">
            <button type="button"
            onClick={() => {console.log('SWITCH_TO_LOGIN');setTab('login');}}
            className={`text-sm font-medium transition-colors ${
            tab === 'login' ? 'text-foreground' : 'text-muted-foreground/60 hover:text-muted-foreground'}`
            }>
              
              Вход
            </button>
            <button
              type="button"
              onClick={() => {console.log('SWITCH_TO_REGISTER');setTab('register');}}
              className={`text-sm font-medium transition-colors ${
              tab === 'register' ? 'text-foreground' : 'text-muted-foreground/60 hover:text-muted-foreground'}`
              }>
              
              Регистрация
            </button>
          </div>
        </div>

        {tab === 'login' &&
        <LoginForm
          loading={loading}
          onSubmit={handleLogin}
          onForgot={() => setShowForgot(true)} />

        }

        {tab === 'register' &&
        <RegisterForm
          loading={loading}
          onSubmit={handleRegister}
          onSwitchLogin={() => setTab('login')} />

        }

        <p className="text-center text-[11px] text-muted-foreground/50">
          Clinical daily tracking · Private by default
        </p>
      </div>
    </Shell>);

};

export default Auth;