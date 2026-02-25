import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import type { AppRole } from '@/types';

type AuthTab = 'register' | 'login';

interface FieldErrors {
  role?: string;
  fullName?: string;
  email?: string;
  password?: string;
}

const Auth = () => {
  const [tab, setTab] = useState<AuthTab>('register');
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
          data: { full_name: fullName }
        }
      });
      if (error) throw error;

      if (data.user) {
        await supabase.from('profiles').update({ full_name: fullName }).eq('id', data.user.id);
        await supabase.from('user_roles').insert({ user_id: data.user.id, role: selectedRole! });
      }

      if (data.session) {
































        // Auto-confirmed — will redirect via auth state change
      } else {setConfirmationEmail(email);setShowConfirmation(true);}} catch (err: any) {toast.error(err.message);} finally {setLoading(false);}};const handleLogin = async (e: React.FormEvent) => {e.preventDefault();setLoading(true);try {const { error } = await supabase.auth.signInWithPassword({ email, password });if (error) throw error;} catch (err: any) {toast.error(err.message);} finally {setLoading(false);}};const handleForgot = async (e: React.FormEvent) => {e.preventDefault();setLoading(true);try {const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });if (error) throw error;toast.success('Ссылка для сброса отправлена на почту');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) toast.error(error.message);
  };

  const errorBorder = (field: keyof FieldErrors) =>
  errors[field] ? 'border-destructive ring-1 ring-destructive/30' : '';

  // Email confirmation screen
  if (showConfirmation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md rounded-2xl border-border/50 bg-card shadow-md">
          <CardContent className="p-8 text-center space-y-4">
            <h2 className="text-lg font-medium text-foreground">Подтвердите почту</h2>
            <p className="text-sm text-muted-foreground">
              Мы отправили письмо с подтверждением на{' '}
              <span className="font-medium text-foreground">{confirmationEmail}</span>.
              Пожалуйста, откройте его, чтобы завершить регистрацию.
            </p>
            <Button
              variant="outline"
              className="w-full rounded-xl"
              onClick={() => {
                setShowConfirmation(false);
                setTab('login');
              }}>

              Перейти ко входу
            </Button>
          </CardContent>
        </Card>
      </div>);

  }

  // Forgot password screen
  if (showForgot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md rounded-2xl border-border/50 bg-card shadow-md">
          <CardContent className="p-8">
            <h2 className="text-lg font-medium text-foreground mb-4">Сброс пароля</h2>
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <Label htmlFor="forgot-email" className="text-sm text-muted-foreground">Email</Label>
                <Input id="forgot-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 rounded-xl" />
              </div>
              <Button type="submit" className="w-full rounded-xl" disabled={loading}>
                Отправить ссылку
              </Button>
              <button type="button" className="text-sm text-muted-foreground underline" onClick={() => setShowForgot(false)}>
                Назад
              </button>
            </form>
          </CardContent>
        </Card>
      </div>);

  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md rounded-2xl border-border/50 bg-card shadow-md">
        <CardContent className="p-8 space-y-6">
          {/* Branding */}
          <div className="text-center space-y-1">
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Bipolar Mania Treacker
            </h1>
            <p className="text-sm text-muted-foreground">Clinical daily tracking. Private by default.</p>
          </div>

          {/* Tabs */}
          <div className="flex rounded-xl bg-muted p-1">
            <button type="button"
            onClick={() => {setTab('register');setErrors({});}}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
            tab === 'register' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`
            }>

              Регистрация
            </button>
            <button
              type="button"
              onClick={() => {setTab('login');setErrors({});}}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              tab === 'login' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`
              }>

              Вход
            </button>
          </div>

          {/* ── REGISTER ── */}
          {tab === 'register' &&
          <form onSubmit={handleRegister} className="space-y-4">
              {/* Role selector */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Выберите роль</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                  type="button"
                  onClick={() => {setSelectedRole('doctor');clearError('role');}}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                  selectedRole === 'doctor' ?
                  'border-primary bg-primary/10 text-foreground' :
                  `border-border bg-background text-muted-foreground hover:border-primary/50 ${errors.role ? 'border-destructive' : ''}`}`
                  }>

                    Психолог / Психиатр
                  </button>
                  <button
                  type="button"
                  onClick={() => {setSelectedRole('patient');clearError('role');}}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                  selectedRole === 'patient' ?
                  'border-primary bg-primary/10 text-foreground' :
                  `border-border bg-background text-muted-foreground hover:border-primary/50 ${errors.role ? 'border-destructive' : ''}`}`
                  }>

                    Пациент
                  </button>
                </div>
                {errors.role && <p className="text-xs text-destructive">{errors.role}</p>}
              </div>

              <div>
                <Label htmlFor="reg-name" className="text-sm text-muted-foreground">Полное имя</Label>
                <Input
                id="reg-name"
                value={fullName}
                onChange={(e) => {setFullName(e.target.value);clearError('fullName');}}
                placeholder="Имя Фамилия"
                className={`mt-1 rounded-xl ${errorBorder('fullName')}`} />

                {errors.fullName && <p className="mt-1 text-xs text-destructive">{errors.fullName}</p>}
              </div>
              <div>
                <Label htmlFor="reg-email" className="text-sm text-muted-foreground">Email</Label>
                <Input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => {setEmail(e.target.value);clearError('email');}}
                className={`mt-1 rounded-xl ${errorBorder('email')}`} />

                {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
              </div>
              <div>
                <Label htmlFor="reg-password" className="text-sm text-muted-foreground">Пароль</Label>
                <Input
                id="reg-password"
                type="password"
                value={password}
                onChange={(e) => {setPassword(e.target.value);clearError('password');}}
                minLength={8}
                className={`mt-1 rounded-xl ${errorBorder('password')}`} />

                {errors.password ?
              <p className="mt-1 text-xs text-destructive">{errors.password}</p> :

              <p className="mt-1 text-xs text-muted-foreground">Минимум 8 символов</p>
              }
              </div>

              <Button type="submit" className="w-full rounded-xl" disabled={loading}>
                Зарегистрироваться
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Уже есть аккаунт?{' '}
                <button type="button" className="text-primary underline" onClick={() => {setTab('login');setErrors({});}}>
                  Войти
                </button>
              </p>
            </form>
          }

          {/* ── LOGIN ── */}
          {tab === 'login' &&
          <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="login-email" className="text-sm text-muted-foreground">Email</Label>
                <Input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 rounded-xl" />
              </div>
              <div>
                <Label htmlFor="login-password" className="text-sm text-muted-foreground">Пароль</Label>
                <Input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1 rounded-xl" />
              </div>
              <Button type="submit" className="w-full rounded-xl" disabled={loading}>
                Войти
              </Button>
              <div className="text-center">
                <button type="button" className="text-sm text-muted-foreground underline" onClick={() => setShowForgot(true)}>
                  Забыли пароль?
                </button>
              </div>
            </form>
          }

          {/* Google sign-in */}
          <Button variant="outline" className="w-full rounded-xl" onClick={handleGoogle} type="button">
            Продолжить с Google
          </Button>
        </CardContent>
      </Card>
    </div>);

};

export default Auth;