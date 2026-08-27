import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/Select';
import { TAGS } from '@/shared/config/constants';

/**
 * Part of `@/entities/message`'s public API — the `@public` tag that tells knip
 * so sits on the re-export in `../index.ts`, where knip attributes the export.
 *
 * A controlled field that features embed in their own forms
 * (`features/message-compose` does), so `value`/`onChange` is a contract the
 * entity offers, not an internal detail — see the note above the export in
 * `../index.ts`.
 */
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
