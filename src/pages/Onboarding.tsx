import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import type { AppRole } from '@/types';

type Step = 'role' | 'name' | 'doctor-code';

const Onboarding = () => {
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState<Step>('role');
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);
  const [fullName, setFullName] = useState('');
  const [doctorCode, setDoctorCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRoleSelect = (role: AppRole) => {
    setSelectedRole(role);
    setStep('name');
  };

  const handleNameSubmit = async () => {
    if (!user || !selectedRole) return;
    setLoading(true);
    try {
      // Update profile name
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id);
      if (profileErr) throw profileErr;

      // Assign role
      const { error: roleErr } = await supabase
        .from('user_roles')
        .insert({ user_id: user.id, role: selectedRole });
      if (roleErr) throw roleErr;

      if (selectedRole === 'patient') {
        setStep('doctor-code');
      } else {
        await refreshProfile();
        toast.success('Профиль создан');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorCode = async (skip: boolean) => {
    if (!user) return;
    setLoading(true);
    try {
      if (!skip && doctorCode.length === 9) {
        // Find doctor by code
        const { data: doctor, error: findErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('doctor_code', doctorCode.toUpperCase())
          .single();
        if (findErr || !doctor) {
          toast.error('Врач не найден');
          setLoading(false);
          return;
        }
        // Create link
        const { error: linkErr } = await supabase
          .from('doctor_patient_links')
          .insert({ doctor_user_id: doctor.id, patient_user_id: user.id });
        if (linkErr) throw linkErr;
        toast.success('Врач добавлен');
      }
      await refreshProfile();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm bg-card">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Настройка профиля</CardTitle>
        </CardHeader>
        <CardContent>
          {step === 'role' && (
            <div className="space-y-3">
              <CardDescription>Выберите вашу роль</CardDescription>
              <Button variant="outline" className="w-full justify-start" onClick={() => handleRoleSelect('doctor')}>
                Психолог / Психиатр
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => handleRoleSelect('patient')}>
                Пациент
              </Button>
            </div>
          )}

          {step === 'name' && (
            <div className="space-y-4">
              <div>
                <Label>Полное имя</Label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Имя Фамилия" />
              </div>
              <Button className="w-full" onClick={handleNameSubmit} disabled={loading || !fullName.trim()}>
                Продолжить
              </Button>
            </div>
          )}

          {step === 'doctor-code' && (
            <div className="space-y-4">
              <CardDescription>Подключить врача</CardDescription>
              <div>
                <Label>Код врача (9 символов)</Label>
                <Input
                  value={doctorCode}
                  onChange={e => setDoctorCode(e.target.value.toUpperCase())}
                  maxLength={9}
                  placeholder="A9X2KQ7PZ"
                  className="font-mono tracking-widest"
                />
              </div>
              <Button className="w-full" onClick={() => handleDoctorCode(false)} disabled={loading || doctorCode.length !== 9}>
                Подключить
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => handleDoctorCode(true)} disabled={loading}>
                Пропустить
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;
