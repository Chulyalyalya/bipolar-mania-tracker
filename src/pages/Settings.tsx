import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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
import PatientExportSection from '@/components/PatientExportSection';

const Settings = () => {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [doctorCode, setDoctorCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    console.log('CONNECT_DOCTOR', { doctorCode });
    const code = doctorCode.trim().toUpperCase();
    if (code.length !== 9) {
      setCodeError('Код должен содержать 9 символов');
      return;
    }
    setCodeError('');
    setConnecting(true);
    try {
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

      await supabase
        .from('doctor_patient_links')
        .update({ status: 'revoked' as any })
        .eq('patient_user_id', user.id)
        .eq('status', 'active' as any);

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

  const handleLogout = async () => {
    console.log('LOGOUT');
    console.log('LOGOUT_CLICK');
    alert('LOGOUT_CLICK');
    await signOut();
    navigate('/auth', { replace: true });
  };

  return (
    <div className="p-4 pb-20 space-y-4">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
        Настройки
      </p>

      <div className="glass-card p-5 space-y-3">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Профиль</p>
        <div className="space-y-1.5 text-sm">
          <p><span className="text-muted-foreground">Имя:</span> {profile?.full_name || '—'}</p>
          <p><span className="text-muted-foreground">Роль:</span> {role === 'doctor' ? 'Врач' : 'Пациент'}</p>
          {role === 'doctor' && profile?.doctor_code && (
            <p><span className="text-muted-foreground">Код:</span> <span className="font-mono">{profile.doctor_code}</span></p>
          )}
        </div>
      </div>

      {role === 'patient' && (
        <>
          <button
            type="button"
            onClick={() => { console.log('OPEN_ADD_DOCTOR'); setSheetOpen(true); }}
            className="group flex w-full items-center justify-center rounded-2xl bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Добавить врача
          </button>

          <PatientExportSection />
        </>
      )}

      <button
        type="button"
        onClick={handleLogout}
        className="flex w-full items-center justify-center rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm px-5 py-3 text-sm font-medium text-foreground transition-all hover:bg-card/60"
      >
        Выйти
      </button>

      {/* Add doctor sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-border/20">
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
                  'font-mono text-center tracking-widest uppercase rounded-2xl border-border/30 bg-card/40',
                  codeError && 'border-destructive'
                )}
              />
              {codeError && (
                <p className="text-[11px] text-destructive mt-1">{codeError}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConnect}
                disabled={connecting}
                className="flex-1 rounded-2xl bg-foreground px-4 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Подключить
              </button>
              <button
                type="button"
                onClick={() => {
                  setSheetOpen(false);
                  setDoctorCode('');
                  setCodeError('');
                }}
                className="flex-1 rounded-2xl border border-border/30 bg-card/40 px-4 py-3 text-sm font-medium text-foreground transition-all hover:bg-card/60"
              >
                Отмена
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Settings;

