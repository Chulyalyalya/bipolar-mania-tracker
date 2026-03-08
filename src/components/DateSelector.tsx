import { useSelectedDate } from '@/contexts/DateContext';
import { addDays, format, isToday, isFuture } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

const DateSelector = () => {
  const { selectedDate, setSelectedDate } = useSelectedDate();
  const atToday = isToday(selectedDate) || isFuture(selectedDate);
  const today = new Date();

  return (
    <div className="flex items-center justify-center gap-1.5 px-4 py-2.5 border-b border-border/20 bg-background">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-xl"
        onClick={() => { console.log('DATE_CHANGE', 'prev'); setSelectedDate(addDays(selectedDate, -1)); }}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="text-[11px] text-muted-foreground rounded-xl"
        onClick={() => setSelectedDate(new Date())}
      >
        Сегодня
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="text-sm font-medium rounded-2xl border-border/30 bg-card/40 backdrop-blur-sm hover:bg-card/60"
          >
            {format(selectedDate, 'd MMMM yyyy', { locale: ru })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 rounded-2xl border-border/30" align="center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(d) => d && setSelectedDate(d)}
            disabled={(d) => d > today}
            className="p-3 pointer-events-auto"
            initialFocus
          />
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-xl"
        disabled={atToday}
        onClick={() => {
          if (!atToday) setSelectedDate(addDays(selectedDate, 1));
        }}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default DateSelector;
