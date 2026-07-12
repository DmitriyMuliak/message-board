import { SessionProvider } from '@/features/auth/ui/SessionProvider';
import { requireSession } from '@/server/require-session';
import { getUserById } from '@/server/users-service';
import { Header } from '@/widgets/header';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  const currentUser = getUserById(session.userId);
  if (!currentUser) {
    throw new Error(`Invariant violation: session references unknown user "${session.userId}".`);
  }

  return (
    <SessionProvider currentUser={currentUser}>
      <div className="flex min-h-screen flex-col">
        <Header />
        {children}
      </div>
    </SessionProvider>
  );
}
