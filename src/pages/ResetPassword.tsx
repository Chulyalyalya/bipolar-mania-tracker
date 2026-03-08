import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) {
          console.error('exchangeCodeForSession error:', error);
          setSessionError('Ссылка недействительна или истекла. Запросите сброс пароля повторно.');
          return;
        }
        if (data?.session) {
          setSessionReady(true);
        } else {
          setSessionError('Не удалось восстановить сессию.');
        }
      } catch (err: any) {
        console.error('Session restore error:', err);
        setSessionError('Ссылка недействительна или истекла.');
      }
    };

    restoreSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success('Пароль обновлён');
      navigate('/auth');
    } catch (err: any) {
      console.error('Password update error:', err);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (sessionError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm bg-card">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Ошибка</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{sessionError}</p>
            <Button className="w-full" onClick={() => navigate('/auth')}>
              Вернуться ко входу
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <p className="text-sm text-muted-foreground">Восстановление сессии...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm bg-card">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Новый пароль</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">Новый пароль</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              Обновить пароль
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
