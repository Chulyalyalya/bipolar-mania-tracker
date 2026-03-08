import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { BLOCKS } from '@/lib/questions';
import { Button } from '@/components/ui/button';
import { format, subDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const RANGES = [
  { label: '14 дней', days: 14 },
  { label: '30 дней', days: 30 },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const PrepareExportModal = ({ open, onOpenChange }: Props) => {
  const { user, profile } = useAuth();
  const [rangeIdx, setRangeIdx] = useState(0);
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [useCustom, setUseCustom] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!user) return;
    setExporting(true);

    try {
      let fromDate: string;
      let toDate: string;

      if (useCustom && customFrom && customTo) {
        fromDate = format(customFrom, 'yyyy-MM-dd');
        toDate = format(customTo, 'yyyy-MM-dd');
      } else {
        const days = RANGES[rangeIdx].days;
        fromDate = format(subDays(new Date(), days), 'yyyy-MM-dd');
        toDate = format(new Date(), 'yyyy-MM-dd');
      }

      const { data: entries } = await supabase
        .from('entries')
        .select('id, entry_date')
        .eq('user_id', user.id)
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate)
        .order('entry_date', { ascending: true });

      if (!entries?.length) {
        toast.error('Нет данных за выбранный период');
        setExporting(false);
        return;
      }

      const entryIds = entries.map((e) => e.id);
      const { data: answers } = await supabase
        .from('mania_answers')
        .select('entry_id, block_id, question_id, score')
        .in('entry_id', entryIds);

      const dataMap: Record<number, Record<number, Record<string, number>>> = {};
      answers?.forEach((a) => {
        if (!dataMap[a.block_id]) dataMap[a.block_id] = {};
        if (!dataMap[a.block_id][a.question_id]) dataMap[a.block_id][a.question_id] = {};
        dataMap[a.block_id][a.question_id][a.entry_id] = a.score;
      });

      const wb = XLSX.utils.book_new();

      for (const block of BLOCKS) {
        const blockData = dataMap[block.id] || {};
        const sortedDates = entries.map((e) => e.entry_date);

        const datesWithData = sortedDates.filter((date) => {
          const eid = entries.find((e) => e.entry_date === date)?.id;
          if (!eid) return false;
          return block.questions.some((_, qIdx) => blockData[qIdx]?.[eid] !== undefined);
        });

        const header = ['Критерий', ...datesWithData];
        const rows = block.questions.map((q, qIdx) => {
          const row: (string | number)[] = [q];
          datesWithData.forEach((date) => {
            const eid = entries.find((e) => e.entry_date === date)?.id;
            const score = eid ? blockData[qIdx]?.[eid] : undefined;
            row.push(score !== undefined ? score : '');
          });
          return row;
        });

        // Add sum row
        const sumRow: (string | number)[] = ['Сумма блока'];
        datesWithData.forEach((date) => {
          const eid = entries.find((e) => e.entry_date === date)?.id;
          let total = 0;
          block.questions.forEach((_, qIdx) => {
            total += eid ? (blockData[qIdx]?.[eid] ?? 0) : 0;
          });
          sumRow.push(total);
        });

        const sheetData = [header, ...rows, sumRow];
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws['!cols'] = [{ wch: 60 }, ...datesWithData.map(() => ({ wch: 12 }))];
        XLSX.utils.book_append_sheet(wb, ws, `Блок ${block.id}`);
      }

      const safeName = (profile?.full_name || 'Patient').replace(/[^a-zA-Zа-яА-Я0-9]/g, '_');
      XLSX.writeFile(wb, `PatientData_${safeName}_${fromDate}_${toDate}.xlsx`);
      toast.success('Файл скачан');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Ошибка экспорта');
    } finally {
      setExporting(false);
    }
  };

  const today = new Date();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Подготовить данные к приёму</SheetTitle>
          <SheetDescription>Выберите период и скачайте Excel-файл</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 py-4">
          {/* Range options */}
          <div className="flex flex-wrap gap-2">
            {RANGES.map((r, i) => (
              <Button
                key={r.label}
                variant={!useCustom && rangeIdx === i ? 'default' : 'outline'}
                size="sm"
                className="text-xs"
                onClick={() => {
                  setRangeIdx(i);
                  setUseCustom(false);
                }}
              >
                {r.label}
              </Button>
            ))}
            <Button
              variant={useCustom ? 'default' : 'outline'}
              size="sm"
              className="text-xs"
              onClick={() => setUseCustom(true)}
            >
              Свой период
            </Button>
          </div>

          {/* Custom date pickers */}
          {useCustom && (
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs flex-1">
                    {customFrom ? format(customFrom, 'd MMM', { locale: ru }) : 'От'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customFrom}
                    onSelect={setCustomFrom}
                    disabled={(d) => d > today}
                    className="p-3 pointer-events-auto"
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs flex-1">
                    {customTo ? format(customTo, 'd MMM', { locale: ru }) : 'До'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={customTo}
                    onSelect={setCustomTo}
                    disabled={(d) => d > today}
                    className="p-3 pointer-events-auto"
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleExport}
            disabled={exporting || (useCustom && (!customFrom || !customTo))}
          >
            {exporting ? 'Экспорт…' : 'Скачать Excel'}
          </Button>

          <p className="text-[10px] text-muted-foreground text-center">
            Ваши данные чувствительны. Экспортируйте только при необходимости.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PrepareExportModal;
