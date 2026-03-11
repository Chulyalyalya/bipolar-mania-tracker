import { useState } from 'react';
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

const STORAGE_KEY = 'doctor_link_dismissed';

const DoctorLinkModal = () => {
  const { user, role } = useAuth();
  const [doctorCode, setDoctorCode] = useState('');
  const [loading, setLoading] = useState(false);

  const dismissed = localStorage.getItem(STORAGE_KEY) === 'true';
  const [open, setOpen] = useState(!dismissed);

  if (role !== 'patient' || dismissed) return null;

  const handleLink = async () => {
    if (!user || doctorCode.length !== 9) return;
    setLoading(true);
    try {
      const { data: doctor, error: findErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('doctor_code', doctorCode.toUpperCase())
        .single();
      if (findErr || !doctor) {
        toast.error('Врач не найден');
        return;
      }
      const { error: linkErr } = await supabase
        .from('doctor_patient_links')
        .insert({ doctor_user_id: doctor.id, patient_user_id: user.id });
      if (linkErr) throw linkErr;
      toast.success('Врач добавлен');
      handleDismiss();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
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
              onChange={(e) => setDoctorCode(e.target.value.toUpperCase())}
              maxLength={9}
              placeholder="A9X2KQ7PZ"
              className="font-mono tracking-widest"
            />
          </div>
          <Button
            className="w-full"
            onClick={handleLink}
            disabled={loading || doctorCode.length !== 9}
          >
            Подключить
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
