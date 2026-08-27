'use client';

import { DropdownMenu } from 'radix-ui';

import { cn } from '@/shared/lib/cn';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';

import { useSession, type CurrentUser } from '@/entities/session';
import { useLogout } from '@/features/auth';

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const currentUser = useSession();
  const logout = useLogout();

  return (
    <nav className={cn('h-[72px] border-b-[3px] border-ink bg-white', className)}>
      <div className="mx-auto flex h-full w-full max-w-[1120px] items-center justify-between px-4 lg:px-8">
        <span className="font-mono text-lg font-bold tracking-normal text-ink lg:text-[22px] lg:tracking-[-0.02em]">
          <span aria-hidden="true">◆ </span>DISPATCH
        </span>

        <div className="lg:hidden">
          <MobileMenu user={currentUser} logout={logout} />
        </div>

        <div className="hidden lg:flex items-center gap-4">
          <DesktopMenu user={currentUser} logout={logout} />
        </div>
      </div>
    </nav>
  );
}

interface MenuProps {
  user: CurrentUser;
  logout: () => void;
}

const DesktopMenu = ({ user, logout }: MenuProps) => {
  return (
    <>
      <div className="flex items-center gap-2.5">
        <Avatar name={user.name} variant="self" size={34} />
        <span className="font-mono text-sm text-muted">@{user.handle}</span>
      </div>
      <Button variant="ghost" onClick={logout}>
        LOG OUT
      </Button>
    </>
  );
};

const MobileMenu = ({ user, logout }: MenuProps) => {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Account menu for ${user.name}`}
          className="flex cursor-pointer items-center gap-2.5 border-none bg-transparent p-1 outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <Avatar name={user.name} variant="self" size={34} />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-[160px] rounded-none border-[2.5px] border-ink bg-paper p-1 shadow-brutal-4"
        >
          <DropdownMenu.Item
            onSelect={logout}
            className="cursor-pointer px-3 py-2 font-mono text-sm font-bold text-ink outline-none select-none data-[highlighted]:bg-base-soft"
          >
            LOG OUT
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
