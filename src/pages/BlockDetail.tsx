import { useParams, useNavigate } from 'react-router-dom';
import { useSelectedDate } from '@/contexts/DateContext';
import { useAuth } from '@/contexts/AuthContext';
import { BLOCKS } from '@/lib/questions';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { subDays, format } from 'date-fns';
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
  const { dateStr } = useSelectedDate();
  const [scores, setScores] = useState<number[]>([]);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rangeIdx, setRangeIdx] = useState(0);
  const [chartData, setChartData] = useState<{ date: string; sum: number }[]>([]);

  const block = useMemo(() => BLOCKS.find((b) => b.id === Number(blockId)), [blockId]);

  const total = scores.reduce((a, b) => a + b, 0);
  const isRisk = total > 4;

  // Load existing answers
  useEffect(() => {
    if (!user || !block) return;
    const load = async () => {
      const { data: entry } = await supabase
        .from('entries')
        .select('id')
        .eq('user_id', user.id)
        .eq('entry_date', dateStr)
        .single();

      if (entry) {
        setEntryId(entry.id);
        const { data: answers } = await supabase
          .from('mania_answers')
          .select('question_id, score')
          .eq('entry_id', entry.id)
          .eq('block_id', block.id);

        const s = new Array(block.questions.length).fill(0);
        answers?.forEach((a) => {
          if (a.question_id >= 0 && a.question_id < s.length) {
            s[a.question_id] = a.score;
          }
        });
        setScores(s);
      } else {
        setEntryId(null);
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

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      let eid = entryId;
      if (!eid) {
        const { data, error } = await supabase
          .from('entries')
          .upsert({ user_id: user.id, entry_date: dateStr }, { onConflict: 'user_id,entry_date' })
          .select('id')
          .single();
        if (error) throw error;
        eid = data.id;
        setEntryId(eid);
      }

      // Delete old answers for this block then insert
      await supabase
        .from('mania_answers')
        .delete()
        .eq('entry_id', eid!)
        .eq('block_id', block.id);

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

      // Recompute summary
      const { data: allAnswers } = await supabase
        .from('mania_answers')
        .select('block_id, score')
        .eq('entry_id', eid!);

      const blockSums: Record<string, number> = {};
      for (let i = 1; i <= 7; i++) blockSums[`block${i}_sum`] = 0;
      allAnswers?.forEach((a) => {
        const k = `block${a.block_id}_sum`;
        blockSums[k] = (blockSums[k] || 0) + a.score;
      });

      const riskCount = Object.values(blockSums).filter((v) => v > 4).length;

      await supabase
        .from('entry_summaries')
        .upsert({
          entry_id: eid!,
          ...blockSums,
          total_risk_blocks_count: riskCount,
        } as any, { onConflict: 'entry_id' });

      toast.success('Сохранено');
      loadChart();
    } catch (e: any) {
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
    <div className="p-4 pb-20 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/')}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-base font-medium">Блок {block.id}</h1>
          <p className="text-xs text-muted-foreground">{block.name}</p>
        </div>
      </div>

      <div className="space-y-3">
        {block.questions.map((q, qIdx) => (
          <Card key={qIdx}>
            <CardContent className="p-3">
              <p className="text-xs text-foreground mb-2">{q}</p>
              <div className="flex gap-1.5">
                {[0, 1, 2, 3, 4].map((val) => (
                  <button
                    key={val}
                    onClick={() => setScore(qIdx, val)}
                    className={cn(
                      'h-8 w-8 rounded-full border-2 text-xs font-medium transition-colors',
                      scores[qIdx] === val
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    )}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
        <span className="text-sm font-medium">Сумма блока</span>
        <span className={cn('text-lg font-semibold', isRisk ? 'text-alert-red' : 'text-alert-green')}>
          {total}
        </span>
      </div>

      <Button className="w-full" onClick={handleSave} disabled={saving}>
        {entryId ? 'Обновить' : 'Сохранить'}
      </Button>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">Статистика</h3>
        <div className="flex gap-1">
          {RANGES.map((r, i) => (
            <Button
              key={r.label}
              variant={rangeIdx === i ? 'default' : 'outline'}
              size="sm"
              className="text-xs"
              onClick={() => setRangeIdx(i)}
            >
              {r.label}
            </Button>
          ))}
        </div>

        {chartData.length > 0 ? (
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
        ) : (
          <p className="text-xs text-muted-foreground py-8 text-center">Нет данных за выбранный период</p>
        )}
      </div>
    </div>
  );
};

export default BlockDetail;
