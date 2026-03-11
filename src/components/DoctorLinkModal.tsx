import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const DoctorLinkModal = () => {
  const { user, role, refreshProfile } = useAuth();
  const [doctorCode, setDoctorCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [codeError, setCodeError] = useState('');

  // Check DB flag on mount
  useEffect(() => {
    if (!user || role !== 'patient') {
      setChecked(true);
      return;
    }

    const check = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('doctor_onboarding_seen')
        .eq('id', user.id)
        .single();

      if (data && !(data as any).doctor_onboarding_seen) {
        // Also check if patient already has a doctor
        const { data: links } = await supabase
          .from('doctor_patient_links')
          .select('id')
          .eq('patient_user_id', user.id)
          .eq('status', 'active' as any)
          .limit(1);

        if (!links?.length) {
          setOpen(true);
        } else {
          // Has doctor already, mark as seen
          await markSeen();
        }
      }
      setChecked(true);
    };

    check();
  }, [user, role]);

  if (!checked || role !== 'patient' || !open) return null;

  const markSeen = async () => {
    if (!user) return;
    await supabase
      .from('profiles')
      .update({ doctor_onboarding_seen: true } as any)
      .eq('id', user.id);
  };

  const handleLink = async () => {
    if (!user) return;
    const code = doctorCode.trim().toUpperCase();
    if (code.length !== 9) {
      setCodeError('Код должен содержать 9 символов');
      return;
    }
    setCodeError('');
    setLoading(true);
    try {
      // Find doctor by code and verify role
      const { data: doctor, error: findErr } = await supabase
        .from('profiles')
        .select('id, role, full_name')
        .eq('doctor_code', code)
        .single();

      if (findErr || !doctor) {
        setCodeError('Врач с таким кодом не найден');
        return;
      }

      if ((doctor as any).role !== 'doctor') {
        setCodeError('Врач с таким кодом не найден');
        return;
      }

      // Check for existing link
      const { data: existing } = await supabase
        .from('doctor_patient_links')
        .select('id, status')
        .eq('doctor_user_id', (doctor as any).id)
        .eq('patient_user_id', user.id)
        .limit(1);

      if (existing?.length) {
        const link = existing[0];
        if ((link as any).status === 'active') {
          setCodeError('Этот врач уже подключён');
          return;
        }
        // Reactivate revoked link
        const { error: updateErr } = await supabase
          .from('doctor_patient_links')
          .update({ status: 'active' as any })
          .eq('id', link.id);
        if (updateErr) throw updateErr;
      } else {
        const { error: linkErr } = await supabase
          .from('doctor_patient_links')
          .insert({
            doctor_user_id: (doctor as any).id,
            patient_user_id: user.id,
            status: 'active' as any,
          });
        if (linkErr) throw linkErr;
      }

      toast.success(`Врач ${(doctor as any).full_name || ''} подключён`);
      await markSeen();
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Ошибка подключения');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async () => {
    await markSeen();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Подключить врача</DialogTitle>
          <DialogDescription>
            Введите код врача, чтобы он мог видеть ваши оценки
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Код врача (9 символов)</Label>
            <Input
              value={doctorCode}
              onChange={(e) => {
                setDoctorCode(e.target.value.toUpperCase());
                setCodeError('');
              }}
              maxLength={9}
              placeholder="A9X2KQ7PZ"
              className={`font-mono tracking-widest ${codeError ? 'border-destructive' : ''}`}
            />
            {codeError && (
              <p className="text-[11px] text-destructive mt-1">{codeError}</p>
            )}
          </div>
          <Button
            className="w-full"
            onClick={handleLink}
            disabled={loading || doctorCode.trim().length !== 9}
          >
            {loading ? 'Подключение…' : 'Подключить'}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={handleDismiss}
            disabled={loading}
          >
            Пропустить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DoctorLinkModal;
