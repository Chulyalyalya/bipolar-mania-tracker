import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays } from 'date-fns';

const SustainedActivationBanner = () => {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user) return;

    const check = async () => {
      const today = new Date();
      const dates = [0, 1, 2].map((i) => format(subDays(today, i), 'yyyy-MM-dd'));

      const { data: entries } = await supabase
        .from('entries')
        .select('id, entry_date')
        .eq('user_id', user.id)
        .in('entry_date', dates);

      if (!entries || entries.length < 3) {
        setShow(false);
        return;
      }

      const entryIds = entries.map((e) => e.id);
      const { data: summaries } = await supabase
        .from('entry_summaries')
        .select('entry_id, total_risk_blocks_count')
        .in('entry_id', entryIds);

      if (!summaries || summaries.length < 3) {
        setShow(false);
        return;
      }

      const allHighRisk = summaries.every((s) => (s.total_risk_blocks_count ?? 0) >= 3);
      setShow(allHighRisk);
    };

    check();
  }, [user]);

  if (!show) return null;

  return (
    <div className="mx-4 rounded-xl bg-secondary p-3">
      <p className="text-xs text-foreground">
        Наблюдается устойчивая активация в течение нескольких дней. Рекомендуется обсудить это с врачом.
      </p>
    </div>
  );
};

export default SustainedActivationBanner;
