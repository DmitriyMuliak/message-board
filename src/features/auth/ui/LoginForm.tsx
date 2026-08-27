'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/shared/ui/Button';
import { loginAction } from '../api/login.action';
import { Input } from '@/shared/ui/Input';
import { useToast } from '@/shared/ui/Toaster';

export function LoginForm({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await loginAction(values);

      if (result.success) {
        onSuccess?.();
        const from = searchParams.get('from');
        const isSafeRedirect = from && from.startsWith('/') && !from.startsWith('//');
        router.push(isSafeRedirect ? from : '/');
        router.refresh();
        return;
      }

      if (result.code === 'INVALID_CREDENTIALS') {
        addToast({
          message: 'Incorrect email or password.',
          variant: 'error',
        });
        return;
      }

      throw new Error(result.error);
    } catch (_error) {
      addToast({
        message: 'Something went wrong. Please try again.',
        variant: 'error',
      });
    }
  });

  return (
    <div className="w-full max-w-[380px]">
      <h1 className="text-[26px] font-bold tracking-[-0.02em] text-ink md:text-3xl">Log in</h1>
      <p className="mt-1.5 hidden font-sans text-[13px] text-muted md:block">
        Use a seeded account to continue.
      </p>

      <form
        data-testid="login-form"
        onSubmit={onSubmit}
        noValidate
        className="mt-8 flex flex-col gap-5"
      >
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="ada@dispatch.dev"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button
          type="submit"
          variant="accent"
          shadow={5}
          loading={isSubmitting}
          disabled={isSubmitting}
          className="mt-3 h-14 w-full text-base"
        >
          {isSubmitting ? 'LOGGING IN…' : 'LOG IN →'}
        </Button>
      </form>
    </div>
  );
}

const loginFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required.')
    .pipe(z.email('Enter a valid email address.')),
  password: z.string().min(1, 'Password is required.'),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;
