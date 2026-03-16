import { useSelectedDate } from '@/contexts/DateContext';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BLOCKS } from '@/lib/questions';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { isFuture, isToday } from 'date-fns';
import DonutStreak from '@/components/DonutStreak';
import DailyNotes from '@/components/DailyNotes';
import MedicationTracker from '@/components/MedicationTracker';
import SustainedActivationBanner from '@/components/SustainedActivationBanner';
import { Check, ChevronRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const PatientHome = () => {
  const { user } = useAuth();
  const { selectedDate, dateStr } = useSelectedDate();
  const [blockSums, setBlockSums] = useState<Record<string, number> | null>(null);
  const [filledBlocks, setFilledBlocks] = useState<Set<number>>(new Set());
  const navigate = useNavigate();

  const futureDate = isFuture(selectedDate) && !isToday(selectedDate);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: entry } = await (supabase
      .from('entries')
      .select('id, block1_sum, block2_sum, block3_sum, block4_sum, block5_sum, block6_sum, block7_sum, total_risk_blocks_count')
      .eq('user_id', user.id)
      .eq('entry_date', dateStr)
      .maybeSingle() as any);

    if (entry) {
      setBlockSums(entry);
      const { data: answers } = await supabase
        .from('mania_answers')
        .select('block_id')
        .eq('entry_id', entry.id);
      setFilledBlocks(new Set(answers?.map((a) => a.block_id) ?? []));
    } else {
      setBlockSums(null);
      setFilledBlocks(new Set());
    }
  }, [user, dateStr]);

  useEffect(() => { load(); }, [load]);

  const hasData = blockSums !== null;

  const handleClearDay = async () => {
    if (!user) return;
    setClearing(true);
    try {
      // 1. Get the entry for this date
      const { data: entry } = await (supabase
        .from('entries')
        .select('id')
        .eq('user_id', user.id)
        .eq('entry_date', dateStr)
        .maybeSingle() as any);

      if (entry) {
        // 2. Delete mania answers for this entry
        await supabase
          .from('mania_answers')
          .delete()
          .eq('entry_id', entry.id);

        // 3. Reset entry sums, note, risk count
        await (supabase
          .from('entries')
          .update({
            block1_sum: 0,
            block2_sum: 0,
            block3_sum: 0,
            block4_sum: 0,
            block5_sum: 0,
            block6_sum: 0,
            block7_sum: 0,
            total_risk_blocks_count: 0,
            daily_note: null,
            flags: {},
          })
          .eq('id', entry.id) as any);
      }

      // 4. Delete medication tracking for this date
      await supabase
        .from('medication_tracking')
        .delete()
        .eq('user_id', user.id)
        .eq('entry_date', dateStr);

      toast.success('Данные за день очищены');
      await load();
    } catch (err) {
      console.error('CLEAR_DAY_ERROR', err);
      toast.error('Не удалось очистить данные');
    } finally {
      setClearing(false);
    }
  };

  const getBlockSum = (blockId: number): number | null => {
    if (!blockSums) return null;
    const key = `block${blockId}_sum`;
    return (blockSums as any)[key] as number;
  };

  const riskCount = (blockSums as any)?.total_risk_blocks_count ?? 0;

  return (
    <div className="p-4 pb-20">
      {/* Urgent risk banner */}
      {riskCount >= 3 && (
        <div className="mb-3 glass-card border-destructive/20 bg-destructive/5 p-3.5">
          <p className="text-xs text-destructive font-medium">
            Сегодня {riskCount} блоков с повышенным риском. Обратите внимание на своё состояние.
          </p>
        </div>
      )}

      <SustainedActivationBanner />

      {futureDate && (
        <div className="my-4 glass-card p-5 text-center">
          <p className="text-sm text-muted-foreground">
            Эта дата ещё не наступила. Заполнение будет доступно позже.
          </p>
        </div>
      )}

      {/* Two-column layout */}
      <div className="flex flex-col md:flex-row gap-4 mt-3 md:items-stretch">
        {/* Left column: streak + notes */}
        <div className="w-full md:w-1/4 flex flex-col items-stretch gap-3">
          <DonutStreak />
          <DailyNotes className="flex-1" />
        </div>

        {/* Right column: blocks */}
        <div className="w-full md:w-3/4">
          <p className="text-[11px] font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            Mania Checker
          </p>
          <div className="grid grid-cols-2 gap-3">
            {BLOCKS.map((block) => {
              const sum = getBlockSum(block.id);
              const isRisk = sum !== null && sum > 4;
              const isFullWidth = block.id === 7;
              const hasFilled = filledBlocks.has(block.id);
              return (
                <div
                  key={block.id}
                  className={cn(
                    'glass-card cursor-pointer hover:shadow-md transition-all group',
                    isFullWidth && 'col-span-2',
                    futureDate && 'opacity-50 pointer-events-none'
                  )}
                  onClick={() => { if (!futureDate) { console.log('BLOCK_OPEN', block.id); navigate(`/block/${block.id}`); } }}
                >
                  <div className="flex items-center justify-between p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">
                          Блок {block.id}
                        </p>
                        {hasFilled && (
                          <Check className="h-3.5 w-3.5 text-alert-green flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{block.name}</p>
                    </div>
                    <div className="flex items-center gap-2.5">
                      {sum !== null && sum > 0 && (
                        <span className="text-sm font-semibold">{sum}</span>
                      )}
                      <div
                        className={cn(
                          'h-3 w-3 rounded-full',
                          sum === null || !filledBlocks.has(block.id) ? 'bg-muted' : isRisk ? 'bg-alert-red' : 'bg-alert-green'
                        )}
                      />
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <MedicationTracker />
        </div>
      </div>
    </div>
  );
};

export default PatientHome;
