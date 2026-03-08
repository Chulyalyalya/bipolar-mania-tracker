import { useEffect, useState } from 'react';
import { useSelectedDate } from '@/contexts/DateContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { BLOCKS } from '@/lib/questions';
import { format, subDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const SEGMENT_COUNT = 7;
const SIZE = 160;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;
const GAP_DEG = 4;
const TOTAL_DEG = 360 - SEGMENT_COUNT * GAP_DEG;
const SEG_DEG = TOTAL_DEG / SEGMENT_COUNT;

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(startDeg: number, endDeg: number) {
  const s = polarToCartesian(CENTER, CENTER, RADIUS, startDeg);
  const e = polarToCartesian(CENTER, CENTER, RADIUS, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${e.x} ${e.y}`;
}

const DonutStreak = () => {
  const { user } = useAuth();
  const { dateStr } = useSelectedDate();
  const navigate = useNavigate();
  const [streak, setStreak] = useState(0);
  const [blockFilled, setBlockFilled] = useState<boolean[]>(new Array(7).fill(false));

  useEffect(() => {
    if (!user) return;

    const loadStreak = async () => {
      // Calculate streak ending at today
      const today = format(new Date(), 'yyyy-MM-dd');
      let count = 0;
      const checkDays = 90; // max lookback
      const datesToCheck: string[] = [];
      for (let i = 0; i < checkDays; i++) {
        datesToCheck.push(format(subDays(new Date(), i), 'yyyy-MM-dd'));
      }

      const { data: entries } = await supabase
        .from('entries')
        .select('entry_date, entered_at')
        .eq('user_id', user.id)
        .in('entry_date', datesToCheck)
        .order('entry_date', { ascending: false });

      const entrySet = new Set(
        entries?.filter((e) => e.entered_at !== null).map((e) => e.entry_date) ?? []
      );

      for (let i = 0; i < checkDays; i++) {
        const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
        if (entrySet.has(d)) {
          count++;
        } else {
          break;
        }
      }
      setStreak(count);
    };

    const loadBlockCompletion = async () => {
      const { data: entry } = await supabase
        .from('entries')
        .select('id')
        .eq('user_id', user.id)
        .eq('entry_date', dateStr)
        .single();

      if (!entry) {
        setBlockFilled(new Array(7).fill(false));
        return;
      }

      const { data: answers } = await supabase
        .from('mania_answers')
        .select('block_id')
        .eq('entry_id', entry.id);

      const filledBlocks = new Set(answers?.map((a) => a.block_id) ?? []);
      setBlockFilled(BLOCKS.map((b) => filledBlocks.has(b.id)));
    };

    loadStreak();
    loadBlockCompletion();
  }, [user, dateStr]);

  const segments = BLOCKS.map((block, i) => {
    const startDeg = i * (SEG_DEG + GAP_DEG);
    const endDeg = startDeg + SEG_DEG;
    const filled = blockFilled[i];
    const color = filled ? 'hsl(var(--alert-green))' : 'hsl(var(--muted))';

    return (
      <path
        key={block.id}
        d={arcPath(startDeg, endDeg)}
        fill="none"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        className="cursor-pointer transition-colors"
        onClick={() => navigate(`/block/${block.id}`)}
      />
    );
  });

  return (
    <div className="flex flex-col items-center py-3">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {segments}
        <text
          x={CENTER}
          y={CENTER - 4}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground text-3xl font-semibold"
          style={{ fontSize: 32, fontFamily: 'Montserrat' }}
        >
          {streak}
        </text>
        <text
          x={CENTER}
          y={CENTER + 22}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-muted-foreground text-xs"
          style={{ fontSize: 11, fontFamily: 'Montserrat' }}
        >
          дней
        </text>
      </svg>
    </div>
  );
};

export default DonutStreak;
