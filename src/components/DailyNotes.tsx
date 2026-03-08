import { useEffect, useState } from 'react';
import { useSelectedDate } from '@/contexts/DateContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import { isFuture, isToday } from 'date-fns';

const DailyNotes = () => {
  const { user } = useAuth();
  const { selectedDate, dateStr } = useSelectedDate();
  const [note, setNote] = useState('');
  const [loadedDate, setLoadedDate] = useState('');

  const futureDate = isFuture(selectedDate) && !isToday(selectedDate);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: entry } = await supabase
        .from('entries')
        .select('daily_note')
        .eq('user_id', user.id)
        .eq('entry_date', dateStr)
        .maybeSingle();

      setNote((entry as any)?.daily_note || '');
      setLoadedDate(dateStr);
    };
    load();
  }, [user, dateStr]);

  const handleChange = (val: string) => {
    if (futureDate) return;
    setNote(val);
  };

  // Save note to DB (called from parent or on blur)
  const handleBlur = async () => {
    if (!user || futureDate) return;

    const now = new Date().toISOString();

    // Upsert entry
    const { data: entry } = await supabase
      .from('entries')
      .upsert(
        { user_id: user.id, entry_date: dateStr, entered_at: now, last_edited_at: now } as any,
        { onConflict: 'user_id,entry_date' }
      )
      .select('id')
      .single();

    if (entry) {
      await supabase
        .from('entries')
        .update({ daily_note: note, last_edited_at: now } as any)
        .eq('id', entry.id);
    }
  };

  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-muted-foreground mb-1.5">Заметки</p>
      <Textarea
        value={note}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        disabled={futureDate}
        placeholder="Как вы себя чувствуете…"
        className="text-xs min-h-[80px] rounded-xl resize-none bg-card"
      />
    </div>
  );
};

export default DailyNotes;
