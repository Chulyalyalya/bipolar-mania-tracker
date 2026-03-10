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

      const { data: entries } = await (supabase
        .from('entries')
        .select('total_risk_blocks_count')
        .eq('user_id', user.id)
        .in('entry_date', dates) as any);

      if (!entries || entries.length < 3) {
        setShow(false);
        return;
      }

      const allHighRisk = entries.every((e: any) => (e.total_risk_blocks_count ?? 0) >= 3);
      setShow(allHighRisk);
    };

    check();
  }, [user]);

  if (!show) return null;

  return (
    <div className="glass-card p-3.5 mb-3">
      <p className="text-xs text-foreground leading-relaxed">
        Наблюдается устойчивая активация в течение нескольких дней. Рекомендуется обсудить это с врачом.
      </p>
    </div>
  );
};

export default SustainedActivationBanner;
