import { useSelectedDate } from '@/contexts/DateContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BLOCKS } from '@/lib/questions';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { isFuture, isToday } from 'date-fns';
import type { EntrySummary } from '@/types';
import DonutStreak from '@/components/DonutStreak';
import DailyNotes from '@/components/DailyNotes';
import SustainedActivationBanner from '@/components/SustainedActivationBanner';
import { Check } from 'lucide-react';

const PatientHome = () => {
  const { user } = useAuth();
  const { selectedDate, dateStr } = useSelectedDate();
  const [summary, setSummary] = useState<EntrySummary | null>(null);
  const [filledBlocks, setFilledBlocks] = useState<Set<number>>(new Set());
  const navigate = useNavigate();

  const futureDate = isFuture(selectedDate) && !isToday(selectedDate);

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
        const [{ data: summaryData }, { data: answers }] = await Promise.all([
          supabase.from('entry_summaries').select('*').eq('entry_id', entry.id).single(),
          supabase.from('mania_answers').select('block_id').eq('entry_id', entry.id),
        ]);
        setSummary(summaryData as EntrySummary | null);
        setFilledBlocks(new Set(answers?.map((a) => a.block_id) ?? []));
      } else {
        setSummary(null);
        setFilledBlocks(new Set());
      }
    };
    load();
  }, [user, dateStr]);

  const getBlockSum = (blockId: number): number | null => {
    if (!summary) return null;
    const key = `block${blockId}_sum` as keyof EntrySummary;
    return summary[key] as number;
  };

  const riskCount = summary?.total_risk_blocks_count ?? 0;

  return (
    <div className="p-4 pb-20">
      {/* Urgent risk banner */}
      {riskCount >= 3 && (
        <div className="mb-3 rounded-xl bg-destructive/10 border border-destructive/20 p-3">
          <p className="text-xs text-destructive font-medium">
            Сегодня {riskCount} блоков с повышенным риском. Обратите внимание на своё состояние.
          </p>
        </div>
      )}

      <SustainedActivationBanner />

      {futureDate && (
        <div className="my-4 rounded-xl bg-secondary p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Эта дата ещё не наступила. Заполнение будет доступно позже.
          </p>
        </div>
      )}

      {/* Two-column layout */}
      <div className="flex flex-col md:flex-row gap-4 mt-3">
        {/* Left column: streak + notes */}
        <div className="w-full md:w-1/4 flex flex-col items-center md:items-stretch gap-3">
          <DonutStreak />
          <DailyNotes />
        </div>

        {/* Right column: blocks */}
        <div className="w-full md:w-3/4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Mania Checker</h2>
          <div className="grid grid-cols-2 gap-3">
            {BLOCKS.map((block) => {
              const sum = getBlockSum(block.id);
              const isRisk = sum !== null && sum > 4;
              const isFullWidth = block.id === 7;
              const hasFilled = filledBlocks.has(block.id);
              return (
                <Card
                  key={block.id}
                  className={cn(
                    'cursor-pointer hover:shadow-md transition-shadow',
                    isFullWidth && 'col-span-2',
                    futureDate && 'opacity-50 pointer-events-none'
                  )}
                  onClick={() => !futureDate && navigate(`/block/${block.id}`)}
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">
                          Блок {block.id}
                        </p>
                        {hasFilled && (
                          <Check className="h-3.5 w-3.5 text-alert-green flex-shrink-0" />
                        )}
                      </div>
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
      </div>
    </div>
  );
};

export default PatientHome;
