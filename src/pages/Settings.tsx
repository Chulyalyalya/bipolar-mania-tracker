import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const Settings = () => {
  const { profile, role, signOut } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [doctorCode, setDoctorCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    const code = doctorCode.trim().toUpperCase();
    if (code.length !== 9) {
      setCodeError('Код должен содержать 9 символов');
      return;
    }
    setCodeError('');
    setConnecting(true);
    try {
      // Find doctor by code
      const { data: doctorProfile, error: findErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('doctor_code', code)
        .single();

      if (findErr || !doctorProfile) {
        setCodeError('Врач с таким кодом не найден');
        setConnecting(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Не авторизован');

      // Revoke existing active links
      await supabase
        .from('doctor_patient_links')
        .update({ status: 'revoked' as any })
        .eq('patient_user_id', user.id)
        .eq('status', 'active' as any);

      // Create new link
      const { error: linkErr } = await supabase
        .from('doctor_patient_links')
        .insert({
          doctor_user_id: doctorProfile.id,
          patient_user_id: user.id,
          status: 'active' as any,
        });

      if (linkErr) throw linkErr;

      toast.success('Врач подключён');
      setSheetOpen(false);
      setDoctorCode('');
    } catch (e: any) {
      toast.error(e.message || 'Ошибка подключения');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="p-4 pb-20 space-y-4">
      <h1 className="text-lg font-medium">Настройки</h1>

      {/* Profile card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Профиль</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="text-muted-foreground">Имя:</span> {profile?.full_name || '—'}</p>
          <p><span className="text-muted-foreground">Роль:</span> {role === 'doctor' ? 'Врач' : 'Пациент'}</p>
          {role === 'doctor' && profile?.doctor_code && (
            <p><span className="text-muted-foreground">Код:</span> <span className="font-mono">{profile.doctor_code}</span></p>
          )}
        </CardContent>
      </Card>

      {/* Add doctor button (patients only) */}
      {role === 'patient' && (
        <Button className="w-full" onClick={() => setSheetOpen(true)}>
          Добавить врача
        </Button>
      )}

      {/* Logout */}
      <Button variant="outline" className="w-full" onClick={signOut}>
        Выйти
      </Button>

      {/* Add doctor sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Подключить врача</SheetTitle>
            <SheetDescription>Введите код, полученный от вашего врача</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div>
              <Input
                placeholder="Код врача (9 символов)"
                value={doctorCode}
                onChange={(e) => {
                  setDoctorCode(e.target.value);
                  setCodeError('');
                }}
                maxLength={9}
                className={cn(
                  'font-mono text-center tracking-widest uppercase',
                  codeError && 'border-destructive'
                )}
              />
              {codeError && (
                <p className="text-xs text-destructive mt-1">{codeError}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={handleConnect}
                disabled={connecting}
              >
                Подключить
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setSheetOpen(false);
                  setDoctorCode('');
                  setCodeError('');
                }}
              >
                Отмена
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Settings;
