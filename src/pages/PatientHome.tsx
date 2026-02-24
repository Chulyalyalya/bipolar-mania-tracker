import { useSelectedDate } from '@/contexts/DateContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BLOCKS } from '@/lib/questions';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
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
    <div className="p-4 pb-20">
      <h2 className="text-sm font-medium text-muted-foreground mb-3">Mania Checker</h2>
      <div className="grid grid-cols-2 gap-3">
        {BLOCKS.map((block) => {
          const sum = getBlockSum(block.id);
          const isRisk = sum !== null && sum > 4;
          const isFullWidth = block.id === 7;
          return (
            <Card
              key={block.id}
              className={cn(
                'cursor-pointer hover:shadow-md transition-shadow',
                isFullWidth && 'col-span-2'
              )}
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
    </div>
  );
};

export default PatientHome;
