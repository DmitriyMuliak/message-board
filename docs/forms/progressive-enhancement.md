# Forms that work before JavaScript loads

To get real progressive enhancement — a form that submits even if hydration has not finished or the
bundle failed — you **must** use the `action` attribute. That puts it in direct conflict with React
Hook Form, which wants to `preventDefault()` and validate on the client first.

Here is how to have both.

## The conflict

1. **The HTML/React `action` attribute** wants to POST native `FormData` to the server.
2. **RHF's `onSubmit`** wants to cancel the default, validate, and only then do something.

## The hybrid

Pass **both**: `action` as the no-JS fallback, `onSubmit` to take over once JS is running.

```tsx
'use client';

import { useActionState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { valibotResolver } from '@hookform/resolvers/valibot';
import { loginAction } from '@/actions/auth';
import { LoginSchema, type LoginInput } from '@/schema/auth';
import { toast } from 'sonner';

const initialState = { message: '', errors: {} };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  const {
    register,
    handleSubmit,
    formState: { errors: formErrors },
    setError,
  } = useForm<LoginInput>({
    resolver: valibotResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
    // 'onTouched' or 'onChange' gives better UX here,
    // because we are intercepting submit anyway
    mode: 'onTouched',
  });

  // Fold server-side errors back into the form
  useEffect(() => {
    if (state?.errors) {
      Object.entries(state.errors).forEach(([key, message]) => {
        setError(key as keyof LoginInput, { type: 'server', message: message as string });
      });
    }
    if (state?.message && !state.success) {
      toast.error(state.message);
    }
  }, [state, setError]);

  const onValidSubmit = (data: LoginInput) => {
    // Runs only if client validation passed. RHF gives us a JSON object,
    // so we build FormData by hand with the keys the backend expects.
    const formData = new FormData();
    formData.append('email', data.email);
    formData.append('password', data.password);

    // calling the action through the hook wraps it in startTransition
    formAction(formData);
  };

  return (
    <form
      // 1. no-JS fallback: the browser POSTs natively
      action={formAction}
      // 2. with JS: RHF intercepts, preventDefaults, validates,
      //    and only then calls onValidSubmit
      onSubmit={(evt) => handleSubmit(onValidSubmit)(evt)}
    >
      <Input
        // register() adds name="email" during SSR, which is what
        // makes the native POST work at all
        {...register('email')}
        placeholder="email@example.com"
        disabled={isPending}
        autoComplete="email"
      />
      {formErrors.email && <p role="alert">{formErrors.email.message}</p>}

      <Input
        {...register('password')}
        type="password"
        disabled={isPending}
        autoComplete="current-password"
      />
      {formErrors.password && <p role="alert">{formErrors.password.message}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending && <Spinner />}
        Sign in
      </Button>
    </form>
  );
}
```

### Why it works

**JS off.** The browser ignores `onSubmit`. Enter or a click fires the `action` attribute, data goes
up as `FormData`, `useActionState` handles it server-side, and the page re-renders with new state.

The load-bearing detail: `register('email')` emits `name="email"` **during SSR**, so the inputs
already carry the names the native POST needs. Without `register` (or a manual `name`), the no-JS
path silently sends nothing.

**JS on.** `onSubmit` fires → RHF calls `preventDefault()`, cancelling the native action → RHF
validates → on failure it shows errors and no request goes out; on success `onValidSubmit` calls
`formAction(formData)` explicitly.

---

## Adding `next-safe-action`

Raw Server Actions leave you writing the same boilerplate in every one: `try/catch`, `schema.parse`,
an auth check, and a hand-shaped `{ success, error, data }` response. `next-safe-action` makes that
declarative. For production it is worth having.

### 1. The client — infrastructure layer

```ts
// src/lib/safe-action.ts
import { createSafeActionClient } from 'next-safe-action';
import { valibotAdapter } from 'next-safe-action/adapters/valibot';

export const actionClient = createSafeActionClient({
  validationAdapter: valibotAdapter(),

  // one place to stop 500s reaching the client raw
  handleServerError(e) {
    console.error('Action error:', e);
    return 'Something went wrong. Please try again later.';
  },
});

// auth middleware
export const authActionClient = actionClient.use(async ({ next }) => {
  // const { data: { user } } = await supabase.auth.getUser();
  // if (!user) throw new Error('Unauthorized');
  return next({ ctx: { userId: 'user_123' } });
});
```

### 2. The action — business logic only

```ts
// src/actions/auth.ts
'use server';

import { actionClient } from '@/lib/safe-action';
import { LoginSchema } from '@/schema/auth';

// .schema() validates first; on failure the action body never runs
export const loginAction = actionClient
  .schema(LoginSchema)
  .action(async ({ parsedInput: { email, password } }) => {
    if (password !== 'secret') {
      throw new Error('Invalid credentials'); // caught by handleServerError
    }
    return { success: true, userId: '123' };
  });
```

### 3. The UI — adapting the result shape

`next-safe-action` returns `{ data, serverError, validationErrors }`, which needs mapping onto RHF:

```tsx
const [state, formAction, isPending] = useActionState(loginAction, null);

useEffect(() => {
  // 1. validation errors rejected server-side
  if (state?.validationErrors) {
    Object.entries(state.validationErrors).forEach(([key, errs]) => {
      const message = Array.isArray(errs) ? errs[0] : errs;
      if (message) setError(key as keyof LoginInput, { message: message as string });
    });
  }

  // 2. business/server errors
  if (state?.serverError) toast.error(state.serverError);

  // 3. success
  if (state?.data?.success) toast.success('Welcome back');
}, [state, setError]);
```

**The friction point:** `next-safe-action` expects JSON by default, while `useActionState` on a form
hands it `FormData`. To keep graceful degradation you need a small shim between them — or use the
library's own `useAction` hook and give up the no-JS path. Decide which of the two you actually need;
you cannot have both for free.

---

## Argument binding

`.bind()` creates a version of a function with arguments already fixed. In Server Actions it is how
you pass an id **without** a hidden input.

React expects an action passed to `action` or `useActionState` to look like
`(prevState, formData) => newState`. But you often need a `productId` the component already has.

**Without binding — the hidden-input anti-pattern:**

```tsx
async function deleteProduct(prevState: any, formData: FormData) {
  const id = formData.get('id');
  // …
}

<form action={deleteProduct}>
  <input type="hidden" name="id" value={product.id} /> {/* ❌ editable in DevTools */}
  <button type="submit">Delete</button>
</form>;
```

**With binding:**

```tsx
// note the signature — id comes first
async function deleteProduct(id: string, prevState: any, formData: FormData) {
  await db.delete(id);
}

export function ProductItem({ id }: { id: string }) {
  // null is the `this` context, irrelevant for Server Actions
  const deleteThisProduct = deleteProduct.bind(null, id);

  return (
    <form action={deleteThisProduct}>
      <button type="submit">Delete</button>
    </form>
  );
}
```

The id never enters the DOM, so it cannot be edited before submission. In plain React 19 this is the
main mechanism for passing context — id, slug, type — into a server function.

> Binding hides the value from the DOM; it does **not** authorize anything. The action still has to
> check that the caller may delete that id. See how this repo handles that in
> [`inner/ARCHITECTURE.md` → Permissions](../inner/ARCHITECTURE.md#permissions).

---

Related: [React Hook Form — validation modes](./react-hook-form.md) ·
[Cancelling a Server Action](../nextjs/aborting-server-actions.md)
