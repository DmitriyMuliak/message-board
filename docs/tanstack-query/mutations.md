# Mutations and optimistic updates

`useQuery` and `useSWR` are for **reading**. Writes go through a separate mechanism in both
libraries, and the reason to use it rather than calling the API client in an `onClick` is cache
invalidation.

## TanStack Query — `useMutation`

The point: after a successful write, tell the library that a key is stale, and every component
showing that data refreshes itself.

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api';

const CreateUserButton = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (newUser: { name: string }) => apiService.post('/users', newUser),

    onSuccess: () => {
      // invalidate the list — React Query refetches it automatically
      queryClient.invalidateQueries({ queryKey: ['/users'] });
    },

    onError: (error) => {
      console.error('Something went wrong', error);
    },
  });

  return (
    <button
      onClick={() => mutation.mutate({ name: 'Ivan' })}
      disabled={mutation.isPending} // loading state, for free
    >
      {mutation.isPending ? 'Creating…' : 'Create user'}
    </button>
  );
};
```

## SWR — `useSWRMutation`

Same idea, bound to a key. The signature differs, so mutations need their own fetcher.

```tsx
import useSWRMutation from 'swr/mutation';
import { apiService } from '@/services/api';

// `arg` is whatever you pass to trigger()
async function sendPostRequest(url: string, { arg }: { arg: { name: string } }) {
  return apiService.post(url, arg);
}

const CreateUserButton = () => {
  const { trigger, isMutating } = useSWRMutation('/users', sendPostRequest);

  return (
    <button onClick={() => trigger({ name: 'Ivan' })} disabled={isMutating}>
      {isMutating ? 'Saving…' : 'Save'}
    </button>
  );
};
```

SWR revalidates the `/users` key automatically on success, if some `useSWR('/users')` is mounted.

## Why not just call `apiService.post()` in the handler?

You can. You lose three things:

1. **Lifecycle management.** No hand-rolled `isLoading` / `isError` state — the hook gives you
   `isPending`, `error`, `data`.
2. **Cache invalidation.** This is the big one. Add a record and the old list is wrong. Without a
   library you manually call a refresh function or, worse, `window.location.reload()`. With one you
   write `invalidateQueries` and every consumer updates itself.
3. **Optimistic updates.** Below.

---

## Optimistic UI

The library does not know what the new data looks like or where it goes. You write the instruction:
_"while we wait for the server, put this object into the list cache."_

The core of it is **direct cache manipulation**.

### TanStack Query

`onMutate` runs **before** the request goes out.

```ts
// features/users/useCreateUser.ts
export const useCreateUser = () => {
  const queryClient = useQueryClient();
  const queryKey = ['/users'];

  return useMutation({
    mutationFn: (newUser: Omit<User, 'id'>) => apiService.post<User>('/users', newUser),

    onMutate: async (newUser) => {
      // a. cancel in-flight refetches so a landing response cannot clobber our write
      await queryClient.cancelQueries({ queryKey });

      // b. snapshot, for rollback
      const previousUsers = queryClient.getQueryData<User[]>(queryKey);

      // c. write the optimistic row
      queryClient.setQueryData<User[]>(queryKey, (old = []) => [
        ...old,
        { id: Math.random(), ...newUser, isOptimistic: true },
      ]);

      return { previousUsers }; // becomes `context` below
    },

    // restore the snapshot wholesale on failure
    onError: (err, newUser, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(queryKey, context.previousUsers);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
};
```

Those three steps — cancel, snapshot, write — are not optional. Skip the cancel and a refetch that
lands mid-write overwrites your optimistic row; skip the snapshot and you have nothing to roll back
to.

> A better id than `Math.random()`: let the **client** generate the real id and have the server echo
> it back. Then the optimistic row and the server row share a key, `onSuccess` swaps in place with no
> remount, and the POST becomes idempotent. See
> [`architecture/data-layer.md`](../architecture/data-layer.md).

### SWR

Simpler, less flexible — `optimisticData`:

```ts
const { mutate } = useSWRConfig();

const handleCreateUser = async (newUser: { name: string }) => {
  const tempUser = { id: Date.now(), name: newUser.name };

  await mutate('/users', apiService.post('/users', newUser), {
    // what the user sees immediately, while the promise is in flight
    optimisticData: (currentUsers = []) => [...currentUsers, tempUser],

    // refetch afterwards? false keeps whatever the POST returned
    revalidate: false,

    // roll back automatically if the POST fails
    rollbackOnError: true,
  });
};
```

## Avoiding the extra GET

You control this. Two defensible strategies:

**Maximum speed — no refetch.** The server returns the created object from `POST /users`. You write
that into the cache in `onSuccess` (or SWR's `populateCache`) and skip `invalidateQueries` in
`onSettled`. React Query replaces the optimistic row with the real response and no GET goes out.

**Reliability — refetch anyway.** Keep the `invalidateQueries`. Database triggers may have fired,
`updatedAt` may have moved, someone else may have added a row concurrently. The user does not notice,
because their own item is already on screen.

Default to the second unless the extra request actually costs you something.

---

Related: [Setting up the client](./setup.md) · [Reading query state](./query-states.md) ·
[Polling](./polling.md)
