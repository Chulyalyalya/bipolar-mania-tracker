import { useEffect, useState } from 'react';
import { useSelectedDate } from '@/contexts/DateContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import { isFuture, isToday } from 'date-fns';

const DailyNotes = ({ className }: { className?: string }) => {
  const { user } = useAuth();
  const { selectedDate, dateStr } = useSelectedDate();
  const [note, setNote] = useState('');
  const [loadedDate, setLoadedDate] = useState('');

  const futureDate = isFuture(selectedDate) && !isToday(selectedDate);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: entry } = await (supabase
        .from('entries')
        .select('daily_note')
        .eq('user_id', user.id)
        .eq('entry_date', dateStr)
        .maybeSingle() as any);

      setNote(entry?.daily_note || '');
      setLoadedDate(dateStr);
    };
    load();
  }, [user, dateStr]);

  const handleChange = (val: string) => {
    if (futureDate) return;
    setNote(val);
  };

  const handleBlur = async () => {
    if (!user || futureDate) return;

    const now = new Date().toISOString();

    const { data: entry } = await (supabase
      .from('entries')
      .upsert(
        { user_id: user.id, entry_date: dateStr, entered_at: now, last_edited_at: now },
        { onConflict: 'user_id,entry_date' }
      )
      .select('id')
      .single() as any);

    if (entry) {
      await (supabase
        .from('entries')
        .update({ daily_note: note, last_edited_at: now })
        .eq('id', entry.id) as any);
    }
  };

  return (
    <div className={`glass-card p-4 flex flex-col ${className ?? ''}`}>
      <p className="text-[11px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">
        Заметки дня
      </p>
      <Textarea
        value={note}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        disabled={futureDate}
        placeholder="Как вы себя чувствуете…"
        className="text-xs flex-1 min-h-[120px] rounded-xl resize-none bg-transparent border-border/20 focus:border-primary/40"
      />
    </div>
  );
};

export default DailyNotes;
