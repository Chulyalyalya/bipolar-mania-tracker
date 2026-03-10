import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronRight, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PatientRow {
  patientId: string;
  fullName: string;
  lastEntryDate: string | null;
  riskCount: number;
}

const DoctorHome = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data: links } = await supabase
        .from('doctor_patient_links')
        .select('patient_user_id')
        .eq('doctor_user_id', user.id)
        .eq('status', 'active' as any);

      if (!links?.length) {
        setPatients([]);
        setLoading(false);
        return;
      }

      const patientIds = links.map((l) => l.patient_user_id);

      const { data: profiles } = await (supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', patientIds) as any);

      const profileMap = new Map((profiles as any[])?.map((p: any) => [p.id, p.full_name]) ?? []);

      const rows: PatientRow[] = [];

      for (const pid of patientIds) {
        const { data: lastEntry } = await (supabase
          .from('entries')
          .select('entry_date, total_risk_blocks_count')
          .eq('user_id', pid)
          .order('entry_date', { ascending: false })
          .limit(1)
          .maybeSingle() as any);

        rows.push({
          patientId: pid,
          fullName: profileMap.get(pid) || 'Пациент',
          lastEntryDate: lastEntry?.entry_date ?? null,
          riskCount: lastEntry?.total_risk_blocks_count ?? 0,
        });
      }

      setPatients(rows);
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="p-5">
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      </div>
    );
  }

  return (
    <div className="p-4 pb-20 space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Мои пациенты
        </p>
      </div>

      {patients.length === 0 ? (
        <div className="glass-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Нет подключённых пациентов. Поделитесь своим кодом врача.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {patients.map((p) => (
            <div
              key={p.patientId}
              className="glass-card cursor-pointer hover:shadow-md transition-all group"
              onClick={() => {
                console.log('BLOCK_OPEN patient', p.patientId);
                navigate(`/patient/${p.patientId}`);
              }}
            >
              <div className="flex items-center justify-between p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{p.fullName}</p>
                    {p.riskCount >= 3 && (
                      <div className="h-2.5 w-2.5 rounded-full bg-alert-red flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {p.lastEntryDate
                      ? `Последняя запись: ${format(new Date(p.lastEntryDate), 'd MMM yyyy', { locale: ru })}`
                      : 'Нет записей'}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DoctorHome;
