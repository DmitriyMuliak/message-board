import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/Select';
import { TAGS } from '@/shared/config/constants';

export interface TagSelectProps {
  value: string;
  onChange: (value: (typeof TAGS)[number]) => void;
  disabled?: boolean;
}

export function TagSelect({ value, onChange, disabled }: TagSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as (typeof TAGS)[number])}
      disabled={disabled}
    >
      <SelectTrigger
        aria-label="Tag"
        className="h-[38px] w-auto gap-1.5 border-[2px] px-3 font-mono text-xs font-bold tracking-wide uppercase"
      >
        <span className="hidden md:inline">TAG:</span>
        <SelectValue>{value}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {TAGS.map((t) => (
          <SelectItem key={t} value={t}>
            {t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
