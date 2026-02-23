import { useSelectedDate } from '@/contexts/DateContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BLOCKS } from '@/lib/questions';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import type { EntrySummary } from '@/types';

const PatientHome = () => {
  const { user } = useAuth();
  const { dateStr } = useSelectedDate();
  const [summary, setSummary] = useState<EntrySummary | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: entry } = await supabase
        .from('entries')
        .select('id')
        .eq('user_id', user.id)
        .eq('entry_date', dateStr)
        .single();
      if (entry) {
        const { data } = await supabase
          .from('entry_summaries')
          .select('*')
          .eq('entry_id', entry.id)
          .single();
        setSummary(data as EntrySummary | null);
      } else {
        setSummary(null);
      }
    };
    load();
  }, [user, dateStr]);

  const getBlockSum = (blockId: number): number | null => {
    if (!summary) return null;
    const key = `block${blockId}_sum` as keyof EntrySummary;
    return summary[key] as number;
  };

  return (
    <div className="space-y-3 p-4 pb-20">
      <h2 className="text-sm font-medium text-muted-foreground">Mania Checker</h2>
      <div className="grid gap-2">
        {BLOCKS.map((block) => {
          const sum = getBlockSum(block.id);
          const isRisk = sum !== null && sum > 4;
          return (
            <Card
              key={block.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/block/${block.id}`)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    Блок {block.id}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{block.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  {sum !== null && (
                    <span className="text-sm font-medium">{sum}</span>
                  )}
                  <div
                    className={cn(
                      'h-3 w-3 rounded-full',
                      sum === null ? 'bg-muted' : isRisk ? 'bg-alert-red' : 'bg-alert-green'
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <h2 className="text-sm font-medium text-muted-foreground mt-4">IPSRT Ритмы</h2>
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/ipsrt')}>
        <CardContent className="flex items-center justify-between p-4">
          <p className="text-sm font-medium">Ритм стабильности</p>
          <div className="h-3 w-3 rounded-full bg-muted" />
        </CardContent>
      </Card>
    </div>
  );
};

// Need cn import
import { cn } from '@/lib/utils';

export default PatientHome;
