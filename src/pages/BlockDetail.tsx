import { useParams, useNavigate } from 'react-router-dom';
import { useSelectedDate } from '@/contexts/DateContext';
import { useAuth } from '@/contexts/AuthContext';
import { BLOCKS } from '@/lib/questions';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { subDays, format, isFuture, isToday } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, ReferenceLine } from 'recharts';

const RANGES = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
];

const BlockDetail = () => {
  const { blockId } = useParams<{ blockId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedDate, dateStr } = useSelectedDate();
  const [scores, setScores] = useState<number[]>([]);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rangeIdx, setRangeIdx] = useState(0);
  const [chartData, setChartData] = useState<{ date: string; sum: number }[]>([]);
  const [lastEdited, setLastEdited] = useState<string | null>(null);

  const block = useMemo(() => BLOCKS.find((b) => b.id === Number(blockId)), [blockId]);
  const futureDate = isFuture(selectedDate) && !isToday(selectedDate);

  const total = scores.reduce((a, b) => a + b, 0);
  const isRisk = total > 4;

  // Load existing answers
  useEffect(() => {
    if (!user || !block) return;
    const load = async () => {
      const { data: entry, error: entryError } = await supabase
        .from('entries')
        .select('id, last_edited_at')
        .eq('user_id', user.id)
        .eq('entry_date', dateStr)
        .maybeSingle();

      if (entryError) {
        console.error('LOAD_ENTRY_ERROR', entryError);
        return;
      }

      if (entry) {
        setEntryId(entry.id);
        setLastEdited(entry.last_edited_at);
        const { data: answers, error: answersError } = await supabase
          .from('mania_answers')
          .select('question_id, score')
          .eq('entry_id', entry.id)
          .eq('block_id', block.id);

        if (answersError) {
          console.error('LOAD_ANSWERS_ERROR', answersError);
          return;
        }

        const s = new Array(block.questions.length).fill(0);
        answers?.forEach((a) => {
          if (a.question_id >= 0 && a.question_id < s.length) {
            s[a.question_id] = a.score;
          }
        });
        setScores(s);
      } else {
        setEntryId(null);
        setLastEdited(null);
        setScores(new Array(block.questions.length).fill(0));
      }
    };
    load();
  }, [user, dateStr, block]);

  // Load chart data
  const loadChart = useCallback(async () => {
    if (!user || !block) return;
    const range = RANGES[rangeIdx];
    const from = format(subDays(new Date(), range.days), 'yyyy-MM-dd');

    const { data: entries } = await supabase
      .from('entries')
      .select('id, entry_date')
      .eq('user_id', user.id)
      .gte('entry_date', from)
      .order('entry_date', { ascending: true });

    if (!entries?.length) {
      setChartData([]);
      return;
    }

    const entryIds = entries.map((e) => e.id);
    const { data: summaries } = await supabase
      .from('entry_summaries')
      .select('entry_id, block1_sum, block2_sum, block3_sum, block4_sum, block5_sum, block6_sum, block7_sum')
      .in('entry_id', entryIds);

    const sumMap = new Map<string, number>();
    summaries?.forEach((s) => {
      const key = `block${block.id}_sum` as keyof typeof s;
      sumMap.set(s.entry_id, (s[key] as number) ?? 0);
    });

    const points = entries
      .filter((e) => sumMap.has(e.id))
      .map((e) => ({
        date: format(new Date(e.entry_date), 'd MMM', { locale: ru }),
        sum: sumMap.get(e.id) ?? 0,
      }));
    setChartData(points);
  }, [user, rangeIdx, block]);

  useEffect(() => {
    loadChart();
  }, [loadChart]);

  if (!block) return <div className="p-4">Блок не найден</div>;

  const setScore = (qIdx: number, val: number) => {
    setScores((prev) => {
      const next = [...prev];
      next[qIdx] = val;
      return next;
    });
  };

  const handleSaveBlock = async () => {
    if (!user || futureDate) return;
    const actionTag = entryId ? 'UPDATE_ENTRY' : 'SAVE_ENTRY';
    console.log(actionTag, { blockId: block.id, scores, total });
    setSaving(true);
    try {
      let eid = entryId;
      const now = new Date().toISOString();

      if (!eid) {
        const { data, error } = await supabase
          .from('entries')
          .upsert(
            { user_id: user.id, entry_date: dateStr, entered_at: now, last_edited_at: now } as any,
            { onConflict: 'user_id,entry_date' }
          )
          .select('id')
          .single();
        if (error || !data?.id) throw error || new Error('Не удалось создать запись');
        eid = data.id;
        setEntryId(eid);
      } else {
        const { error: updateEntryError } = await supabase
          .from('entries')
          .update({ last_edited_at: now } as any)
          .eq('id', eid);
        if (updateEntryError) throw updateEntryError;
      }

      const { error: deleteAnswersError } = await supabase
        .from('mania_answers')
        .delete()
        .eq('entry_id', eid!)
        .eq('block_id', block.id);
      if (deleteAnswersError) throw deleteAnswersError;

      const rows = scores.map((score, qIdx) => ({
        entry_id: eid!,
        block_id: block.id,
        question_id: qIdx,
        score,
      }));

      const { error: insertErr } = await supabase
        .from('mania_answers')
        .insert(rows);
      if (insertErr) throw insertErr;

      const { data: allAnswers, error: allAnswersError } = await supabase
        .from('mania_answers')
        .select('block_id, score')
        .eq('entry_id', eid!);
      if (allAnswersError) throw allAnswersError;

      const blockSums: Record<string, number> = {};
      for (let i = 1; i <= 7; i++) blockSums[`block${i}_sum`] = 0;
      allAnswers?.forEach((a) => {
        const k = `block${a.block_id}_sum`;
        blockSums[k] = (blockSums[k] || 0) + a.score;
      });

      const riskCount = Object.values(blockSums).filter((v) => v > 4).length;

      const { error: summaryUpsertError } = await supabase
        .from('entry_summaries')
        .upsert({
          entry_id: eid!,
          ...blockSums,
          total_risk_blocks_count: riskCount,
        } as any, { onConflict: 'entry_id' });
      if (summaryUpsertError) throw summaryUpsertError;

      setLastEdited(now);
      toast.success('Сохранено');
      await loadChart();
    } catch (e: any) {
      console.error(`${actionTag}_ERROR`, e);
      toast.error(e.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return null;
    const color = payload.sum > 4 ? 'hsl(var(--alert-red))' : 'hsl(var(--alert-green))';
    return <circle cx={cx} cy={cy} r={4} fill={color} stroke="none" />;
  };

  return (
    <div className="relative isolate p-4 pb-24 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => navigate('/')}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-base font-semibold">Блок {block.id}</h1>
          <p className="text-[11px] text-muted-foreground">{block.name}</p>
        </div>
      </div>

      {futureDate && (
        <div className="glass-card p-5 text-center">
          <p className="text-sm text-muted-foreground">
            Эта дата ещё не наступила. Заполнение будет доступно позже.
          </p>
        </div>
      )}

      <div className="relative z-10 space-y-2.5">
        {block.questions.map((q, qIdx) => (
          <div key={qIdx} className="glass-card p-4 relative z-0">
            <p className="text-xs text-foreground mb-2.5 leading-relaxed">{q}</p>
            <div className="flex gap-2 relative z-10">
              {[0, 1, 2, 3, 4].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => { if (!futureDate) { console.log('SCORE_SELECT', { qIdx, val }); setScore(qIdx, val); } }}
                  disabled={futureDate}
                  className={cn(
                    'h-9 w-9 rounded-xl border-2 text-xs font-medium transition-all pointer-events-auto',
                    scores[qIdx] === val
                      ? 'bg-foreground border-foreground text-background shadow-sm'
                      : 'border-border/30 text-muted-foreground hover:border-primary/50 hover:bg-card/60',
                    futureDate && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card flex items-center justify-between p-4">
        <span className="text-sm font-medium">Сумма блока</span>
        <span className={cn('text-lg font-semibold', isRisk ? 'text-alert-red' : 'text-alert-green')}>
          {total}
        </span>
      </div>

      {!futureDate && (
        <div className="relative z-[120] pointer-events-auto">
          <button
            type="button"
            onClick={() => {
              console.log('SAVE_CLICK');
              alert('SAVE_CLICK');
              void handleSaveBlock();
            }}
            disabled={saving}
            className="relative z-[121] pointer-events-auto flex w-full items-center justify-center rounded-2xl bg-foreground px-5 py-3.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {entryId ? 'Обновить' : 'Сохранить'}
          </button>
        </div>
      )}

      {lastEdited && (
        <p className="text-[10px] text-muted-foreground text-center">
          Последнее обновление: {format(new Date(lastEdited), 'd MMM yyyy, HH:mm', { locale: ru })}
        </p>
      )}

      <div className="space-y-2.5">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Статистика</p>
        <div className="flex gap-1.5">
          {RANGES.map((r, i) => (
            <button
              key={r.label}
              type="button"
              className={cn(
                'rounded-xl px-3 py-1.5 text-xs font-medium transition-all',
                rangeIdx === i
                  ? 'bg-foreground text-background'
                  : 'bg-card/40 text-muted-foreground hover:bg-card/60 border border-border/30'
              )}
              onClick={() => { console.log('CHART_RANGE', r.label); setRangeIdx(i); }}
            >
              {r.label}
            </button>
          ))}
        </div>

        {chartData.length > 0 ? (
          <div className="glass-card p-3">
            <ChartContainer
              config={{ sum: { label: 'Сумма', color: 'hsl(var(--primary))' } }}
              className="h-[200px] w-full"
            >
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <ReferenceLine y={4} stroke="hsl(var(--alert-red))" strokeDasharray="3 3" strokeOpacity={0.5} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="linear"
                  dataKey="sum"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.5}
                  dot={<CustomDot />}
                  connectNulls={false}
                />
              </LineChart>
            </ChartContainer>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-8 text-center">Нет данных за выбранный период</p>
        )}
      </div>
    </div>
  );
};

export default BlockDetail;
