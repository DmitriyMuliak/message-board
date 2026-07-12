'use client';

import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/Select';
import { Skeleton } from '@/shared/ui/Skeleton';
import { cn } from '@/shared/lib/cn';
import { getUsersAction } from '@/features/feed-filters/api/users.action';

const ALL_USERS_VALUE = '__all__';

export interface UserSelectProps {
  /** Author id (e.g. `u_ada`), or `null` for "all users" — `FeedFilters.user` (§8). */
  value: string | null;
  onChange: (userId: string | null) => void;
  id?: string;
  className?: string;
}

export function UserSelect({ value, onChange, id, className }: UserSelectProps) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['users'],
    queryFn: () => getUsersAction(),
    staleTime: 5 * 60_000,
  });

  if (isPending) {
    return <Skeleton className={cn('h-[46px] w-full', className)} />;
  }

  const users = !isError ? (data?.users ?? []) : [];

  return (
    <Select
      value={value ?? ALL_USERS_VALUE}
      onValueChange={(next) => onChange(next === ALL_USERS_VALUE ? null : next)}
    >
      <SelectTrigger id={id} className={className} aria-label="Filter by user">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_USERS_VALUE}>All users</SelectItem>
        {users.map((user) => (
          <SelectItem key={user.id} value={user.id}>
            {user.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
