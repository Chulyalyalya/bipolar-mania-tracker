import { useState, useEffect, useCallback } from 'react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import PatientExportSection from '@/components/PatientExportSection';

interface LinkedDoctor {
  linkId: string;
  doctorUserId: string;
  fullName: string;
  doctorCode: string | null;
}

const Settings = () => {
  const { profile, role, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [doctorCode, setDoctorCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [connecting, setConnecting] = useState(false);

  const [linkedDoctors, setLinkedDoctors] = useState<LinkedDoctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  const [removingDoctor, setRemovingDoctor] = useState<LinkedDoctor | null>(null);

  const fetchLinkedDoctors = useCallback(async () => {
    if (!user || role !== 'patient') return;
    setLoadingDoctors(true);
    try {
      const { data: links } = await supabase
        .from('doctor_patient_links')
        .select('id, doctor_user_id')
        .eq('patient_user_id', user.id)
        .eq('status', 'active' as any);

      if (!links?.length) {
        setLinkedDoctors([]);
        setLoadingDoctors(false);
        return;
      }

      const doctorIds = links.map((l) => l.doctor_user_id);
      const { data: profiles } = await (supabase
        .from('profiles')
        .select('id, full_name, doctor_code')
        .in('id', doctorIds) as any);

      const profileMap = new Map((profiles as any[])?.map((p: any) => [p.id, p]) ?? []);

      const doctors: LinkedDoctor[] = links.map((l) => {
        const p = profileMap.get(l.doctor_user_id) as any;
        return {
          linkId: l.id,
          doctorUserId: l.doctor_user_id,
          fullName: p?.full_name || 'Врач',
          doctorCode: p?.doctor_code ?? null,
        };
      });

      setLinkedDoctors(doctors);
    } catch (e) {
      console.error('FETCH_DOCTORS_ERROR', e);
    } finally {
      setLoadingDoctors(false);
    }
  }, [user, role]);

  useEffect(() => {
    fetchLinkedDoctors();
  }, [fetchLinkedDoctors]);

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
      const { data: doctorProfile, error: findErr } = await (supabase
        .from('profiles')
        .select('id')
        .eq('doctor_code', code)
        .single() as any);

      if (findErr || !doctorProfile) {
        setCodeError('Врач с таким кодом не найден');
        setConnecting(false);
        return;
      }

      const alreadyLinked = linkedDoctors.some(
        (d) => d.doctorUserId === doctorProfile.id
      );
      if (alreadyLinked) {
        setCodeError('Этот врач уже добавлен');
        setConnecting(false);
        return;
      }

      if (!user) throw new Error('Не авторизован');

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
      await fetchLinkedDoctors();
    } catch (e: any) {
      toast.error(e.message || 'Ошибка подключения');
    } finally {
      setConnecting(false);
    }
  };

  const handleRemoveDoctor = async () => {
    if (!removingDoctor) return;
    try {
      await supabase
        .from('doctor_patient_links')
        .update({ status: 'revoked' as any })
        .eq('id', removingDoctor.linkId);

      setLinkedDoctors((prev) => prev.filter((d) => d.linkId !== removingDoctor.linkId));
      toast.success('Врач удалён');
    } catch (e: any) {
      toast.error(e.message || 'Ошибка удаления');
    } finally {
      setRemovingDoctor(null);
    }
  };

  const handleLogout = async () => {
    try {
      console.log('LOGOUT_CLICK');
      console.log('LOGOUT_START');
      await signOut();
      navigate('/auth', { replace: true });
      console.log('LOGOUT_SUCCESS');
    } catch (error) {
      console.error('LOGOUT_ERROR', error);
      toast.error('Не удалось выйти из аккаунта');
    }
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

        {role === 'patient' && linkedDoctors.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {linkedDoctors.map((doc) => (
              <div key={doc.linkId} className="flex items-center justify-between text-sm">
                <p>
                  <span className="text-muted-foreground">Врач:</span>{' '}
                  {doc.fullName}
                  {doc.doctorCode && (
                    <span className="text-muted-foreground font-mono text-xs ml-1">({doc.doctorCode})</span>
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => setRemovingDoctor(doc)}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors ml-2 shrink-0"
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {role === 'patient' && (
        <>
          <button
            type="button"
            onClick={() => { setSheetOpen(true); }}
            className="group flex w-full items-center justify-center rounded-2xl bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            {linkedDoctors.length > 0 ? 'Добавить ещё одного врача' : 'Добавить врача'}
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

      <AlertDialog open={!!removingDoctor} onOpenChange={(open) => !open && setRemovingDoctor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить врача?</AlertDialogTitle>
            <AlertDialogDescription>
              Врач больше не будет иметь доступ к вашим данным.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveDoctor}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Settings;
