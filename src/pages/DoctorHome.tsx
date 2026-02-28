import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface PatientRow {
  patientId: string;
  fullName: string;
  lastEntryDate: string | null;
  riskBlocksCount: number;
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
      // Get active links
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

      // Get profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', patientIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p.full_name]) ?? []);

      // Get latest entry per patient
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const rows: PatientRow[] = [];

      for (const pid of patientIds) {
        // Last entry
        const { data: lastEntry } = await supabase
          .from('entries')
          .select('id, entry_date')
          .eq('user_id', pid)
          .order('entry_date', { ascending: false })
          .limit(1)
          .single();

        // Today's summary for risk
        let riskCount = 0;
        const { data: todayEntry } = await supabase
          .from('entries')
          .select('id')
          .eq('user_id', pid)
          .eq('entry_date', todayStr)
          .single();

        if (todayEntry) {
          const { data: summary } = await supabase
            .from('entry_summaries')
            .select('total_risk_blocks_count')
            .eq('entry_id', todayEntry.id)
            .single();
          riskCount = summary?.total_risk_blocks_count ?? 0;
        }

        rows.push({
          patientId: pid,
          fullName: profileMap.get(pid) || 'Пациент',
          lastEntryDate: lastEntry?.entry_date ?? null,
          riskBlocksCount: riskCount,
        });
      }

      setPatients(rows);
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      </div>
    );
  }

  return (
    <div className="p-4 pb-20 space-y-4">
      <h1 className="text-lg font-medium">Мои пациенты</h1>
      {patients.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Нет подключённых пациентов. Поделитесь своим кодом врача.
        </p>
      ) : (
        <div className="space-y-3">
          {patients.map((p) => {
            const isHighRisk = p.riskBlocksCount >= 3;
            return (
              <Card
                key={p.patientId}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/patient/${p.patientId}`)}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.lastEntryDate
                        ? `Последняя запись: ${format(new Date(p.lastEntryDate), 'd MMM yyyy', { locale: ru })}`
                        : 'Нет записей'}
                    </p>
                  </div>
                  <div
                    className={cn(
                      'h-3 w-3 rounded-full shrink-0',
                      p.lastEntryDate === null
                        ? 'bg-muted'
                        : isHighRisk
                          ? 'bg-alert-red'
                          : 'bg-alert-green'
                    )}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DoctorHome;
