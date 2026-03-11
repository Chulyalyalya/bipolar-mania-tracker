import { useEffect, useState, useCallback } from 'react';
import { useSelectedDate } from '@/contexts/DateContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { isFuture, isToday } from 'date-fns';

interface MedicationRow {
  id: string;
  medication_name: string;
  dosage: string | null;
}

const MedicationTracker = () => {
  const { user } = useAuth();
  const { selectedDate, dateStr } = useSelectedDate();
  const [morningTaken, setMorningTaken] = useState(false);
  const [eveningTaken, setEveningTaken] = useState(false);
  const [morningMeds, setMorningMeds] = useState<MedicationRow[]>([]);
  const [eveningMeds, setEveningMeds] = useState<MedicationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const futureDate = isFuture(selectedDate) && !isToday(selectedDate);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [trackRes, medsRes] = await Promise.all([
      supabase
        .from('medication_tracking')
        .select('morning_taken, evening_taken')
        .eq('user_id', user.id)
        .eq('entry_date', dateStr)
        .maybeSingle(),
      supabase
        .from('medications')
        .select('id, period, medication_name, dosage')
        .eq('user_id', user.id),
    ]);

    const track = trackRes.data;
    setMorningTaken(track?.morning_taken ?? false);
    setEveningTaken(track?.evening_taken ?? false);

    const meds = medsRes.data ?? [];
    setMorningMeds(meds.filter((m) => m.period === 'morning'));
    setEveningMeds(meds.filter((m) => m.period === 'evening'));
    setLoading(false);
  }, [user, dateStr]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (field: 'morning_taken' | 'evening_taken', current: boolean) => {
    if (!user || futureDate) return;
    const newVal = !current;

    if (field === 'morning_taken') setMorningTaken(newVal);
    else setEveningTaken(newVal);

    const { data: existing } = await supabase
      .from('medication_tracking')
      .select('id')
      .eq('user_id', user.id)
      .eq('entry_date', dateStr)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('medication_tracking')
        .update({ [field]: newVal, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('medication_tracking')
        .insert({
          user_id: user.id,
          entry_date: dateStr,
          [field]: newVal,
        });
    }
  };

  return (
    <div className="mt-4">
      <p className="text-[11px] font-medium text-muted-foreground mb-3 uppercase tracking-wider">
        Трекер приема фармакологии
      </p>
      <div className={cn('glass-card divide-y divide-border/30', futureDate && 'opacity-50 pointer-events-none')}>
        {/* Morning */}
        <div className="flex items-start justify-between p-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Утро</p>
            {morningMeds.length > 0 ? (
              <div className="mt-1 space-y-0.5">
                {morningMeds.map((m) => (
                  <p key={m.id} className="text-[11px] text-muted-foreground truncate">
                    {m.medication_name}{m.dosage ? ` · ${m.dosage}` : ''}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground mt-0.5">Нет добавленных препаратов</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => toggle('morning_taken', morningTaken)}
            disabled={futureDate}
            className={cn(
              'mt-0.5 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0',
              morningTaken
                ? 'border-foreground bg-foreground'
                : 'border-muted-foreground/40 bg-transparent'
            )}
            aria-label="Утро принято"
          >
            {morningTaken && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6L5 8.5L9.5 3.5" stroke="hsl(var(--background))" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>

        {/* Evening */}
        <div className="flex items-start justify-between p-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Вечер</p>
            {eveningMeds.length > 0 ? (
              <div className="mt-1 space-y-0.5">
                {eveningMeds.map((m) => (
                  <p key={m.id} className="text-[11px] text-muted-foreground truncate">
                    {m.medication_name}{m.dosage ? ` · ${m.dosage}` : ''}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground mt-0.5">Нет добавленных препаратов</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => toggle('evening_taken', eveningTaken)}
            disabled={futureDate}
            className={cn(
              'mt-0.5 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0',
              eveningTaken
                ? 'border-foreground bg-foreground'
                : 'border-muted-foreground/40 bg-transparent'
            )}
            aria-label="Вечер принято"
          >
            {eveningTaken && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6L5 8.5L9.5 3.5" stroke="hsl(var(--background))" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MedicationTracker;
