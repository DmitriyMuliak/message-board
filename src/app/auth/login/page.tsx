import { Suspense } from 'react';
import { LoginForm } from '@/features/auth';

export default function LoginPage() {
  return (
    <>
      <section className="flex flex-col border-b-[3px] border-ink bg-accent px-7 pt-8 pb-10 md:w-[43.06%] md:shrink-0 md:border-r-[3px] md:border-b-0 md:p-14">
        <span className="font-mono text-[13px] tracking-[0.12em] text-ink md:text-sm">
          ◆ DISPATCH
        </span>

        <div className="mt-9 md:mt-0 md:flex md:flex-1 md:flex-col md:justify-center">
          <h1 className="text-[clamp(52px,3.429vw+38.629px,108px)] leading-[0.95] font-bold tracking-[-0.03em] text-ink">
            Say it in
            <br />
            240.
          </h1>
          <p className="mt-6 hidden max-w-95 font-sans text-[15px] leading-[1.6] text-ink md:block">
            A short-message board for your team. Post, tag, filter, done.
          </p>
        </div>
      </section>

      <section className="flex flex-col items-center px-7 pt-8 pb-10 md:w-[56.94%] md:justify-center md:p-14">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </section>
    </>
  );
}
