import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays } from 'date-fns';

const DonutStreak = () => {
  const { user } = useAuth();
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!user) return;

    const loadStreak = async () => {
      const checkDays = 90;
      const datesToCheck: string[] = [];
      for (let i = 0; i < checkDays; i++) {
        datesToCheck.push(format(subDays(new Date(), i), 'yyyy-MM-dd'));
      }

      // Get entries for these dates
      const { data: entries } = await (supabase
        .from('entries')
        .select('id, entry_date')
        .eq('user_id', user.id)
        .in('entry_date', datesToCheck) as any);

      if (!entries?.length) {
        setStreak(0);
        return;
      }

      const entryIds = entries.map((e: any) => e.id);

      // Check which entries actually have mania_answers
      const { data: answers } = await supabase
        .from('mania_answers')
        .select('entry_id')
        .in('entry_id', entryIds);

      const entriesWithAnswers = new Set(answers?.map((a) => a.entry_id) ?? []);

      // Build set of completed dates (dates that have at least one answer)
      const completedDates = new Set<string>();
      entries.forEach((e: any) => {
        if (entriesWithAnswers.has(e.id)) {
          completedDates.add(e.entry_date);
        }
      });

      // Count consecutive days from today
      let count = 0;
      for (let i = 0; i < checkDays; i++) {
        const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
        if (completedDates.has(d)) {
          count++;
        } else {
          break;
        }
      }
      setStreak(count);
    };

    loadStreak();
  }, [user]);

  return (
    <div className="glass-card flex flex-col items-center justify-center p-5">
      <div className="h-20 w-20 rounded-full border-2 border-border/30 bg-card/30 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold text-foreground leading-none">{streak}</span>
        <span className="text-[10px] text-muted-foreground mt-0.5">дней</span>
      </div>
    </div>
  );
};

export default DonutStreak;
