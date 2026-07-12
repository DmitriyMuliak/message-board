'use client';

import { useState } from 'react';
import { Dialog } from 'radix-ui';
import { DayPicker, type ChevronProps, type DateRange } from 'react-day-picker';

import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';

export interface DateRangeValue {
  from: string | null;
  to: string | null;
}

export interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  className?: string;
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(() => ({
    from: fromDateOnlyString(value.from),
    to: fromDateOnlyString(value.to),
  }));

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setDraft({ from: fromDateOnlyString(value.from), to: fromDateOnlyString(value.to) });
    }
  }

  function handleSelect(range: DateRange | undefined) {
    setDraft(range);
    if (range?.from && range?.to) {
      onChange({ from: toDateOnlyString(range.from), to: toDateOnlyString(range.to) });
      setOpen(false);
    }
  }

  function handleClear() {
    setDraft(undefined);
    onChange({ from: null, to: null });
    setOpen(false);
  }

  const fromLabel = formatTriggerLabel(value.from);
  const toLabel = formatTriggerLabel(value.to);

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Filter by date range"
          className={cn(
            'flex w-full flex-col gap-2 rounded-none text-left outline-hidden focus-visible:outline-solid cursor-pointer',
            'focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ink',
            className,
          )}
        >
          {/* Placeholder semantics, matching the spec: sentence-case "From"/"To" in the
              faint placeholder tone until a date is picked, then the date replaces it. */}
          <span className="flex h-[46px] items-center gap-2 border-[2.5px] border-ink bg-paper px-3 font-sans text-sm text-ink">
            {fromLabel ?? <span className="text-faint">From</span>}
          </span>
          <span className="flex h-[46px] items-center gap-2 border-[2.5px] border-ink bg-paper px-3 font-sans text-sm text-ink">
            {toLabel ?? <span className="text-faint">To</span>}
          </span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-none border-[2.5px] border-ink bg-paper p-4 shadow-brutal-5">
          <DayPicker
            mode="range"
            selected={draft}
            onSelect={handleSelect}
            resetOnSelect
            classNames={dayPickerClassNames}
            components={{ Chevron }}
            fixedWeeks={true}
            showOutsideDays={true}
          />
          <div className="mt-3 flex justify-end border-t-2 border-base pt-3">
            <Button type="button" variant="ghost" onClick={handleClear}>
              CLEAR
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromDateOnlyString(value: string | null): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

const triggerDateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function formatTriggerLabel(value: string | null): string | null {
  const date = fromDateOnlyString(value);
  return date ? triggerDateFormat.format(date) : null;
}

function Chevron({ orientation }: ChevronProps) {
  const glyph =
    orientation === 'right' ? '►' : orientation === 'up' ? '▲' : orientation === 'down' ? '▼' : '◄';
  return (
    <span aria-hidden="true" className="font-mono text-[10px]">
      {glyph}
    </span>
  );
}

const NAV_BUTTON_CLASSES =
  'inline-flex h-7 w-7 items-center justify-center border-2 border-ink bg-paper text-ink cursor-pointer outline-none hover:bg-base-soft focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40';

const dayPickerClassNames = {
  root: 'font-sans text-ink',
  months: 'flex flex-col gap-2',
  month: 'relative flex flex-col gap-3',
  month_caption: 'flex h-8 items-center justify-center font-mono text-sm font-bold',
  nav: 'absolute inset-x-0 top-0 flex p-1 z-10 items-center justify-between',
  button_previous: NAV_BUTTON_CLASSES,
  button_next: NAV_BUTTON_CLASSES,
  month_grid: 'w-full border-collapse',
  weekday: 'w-9 pb-2 font-mono text-[11px] font-bold tracking-wide text-muted uppercase',
  day: 'p-0.5 text-center',
  day_button:
    'inline-flex h-8 w-8 cursor-pointer items-center justify-center font-sans text-sm text-ink outline-none hover:bg-base-soft focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ink',
  today: 'font-bold underline underline-offset-2',
  outside: 'text-faint',
  disabled: 'cursor-not-allowed text-faint opacity-50 hover:bg-transparent',
  selected: 'bg-accent font-bold hover:bg-accent',
  range_start: 'bg-accent font-bold hover:bg-accent',
  range_middle: 'bg-base-soft hover:bg-base-soft',
  range_end: 'bg-accent font-bold hover:bg-accent',
};
