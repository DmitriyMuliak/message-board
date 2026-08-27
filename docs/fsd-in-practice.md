# FSD in practice — how to classify a slice

The rules are in [`lint-rules.md`](./architecture/lint-rules.md), and all seven are lint errors, so this document
does not restate them. It answers the questions the rules leave open — the ones a linter cannot
decide for you:

- Is this thing a **feature** or a **widget**?
- May a `view` import a feature **directly**, without a widget in between?
- Where does **state** live, and may a widget hold it?

Every claim below is checkable against the code in this repo.

---

## 1. Widget vs feature

**A feature is a user capability.** What someone can _do_. It owns the logic of that action: the
mutation, the validation, the control that fires it.

**A widget is a composition block.** What appears on the page as one piece. It owns assembly, not new
behaviour.

### The test that decides it

Delete the slice and ask what disappeared.

- Delete `features/message-delete` → **a capability is gone.** Nobody can delete a message.
- Delete `widgets/message-card` → **nothing is gone.** The entity card, the edit feature and the
  delete feature are all still there. You would just have to stitch them together somewhere else.

That is the whole difference. A widget adds nothing that was not already there.

### The structural reason widgets exist at all

A slice may not import a sibling slice on its own layer (rule 2). So a card that needs
`entities/message`, `entities/session`, `features/message-edit` and `features/message-delete` **at
the same time** has nowhere to live except a layer above all four. That is precisely why
[`widgets/message-card`](../src/widgets/message-card/ui/MessageCardWithActions.tsx) exists — it is not
a stylistic choice, it is the only legal place for that composition.

### This repo's slices

| Slice                               | Kind        | Why                                                                 |
| ----------------------------------- | ----------- | ------------------------------------------------------------------- |
| `features/message-compose`          | capability  | "post a message" — owns the mutation and the composer               |
| `features/message-edit` / `-delete` | capability  | "change it" / "remove it"                                           |
| `features/feed-filters`             | capability  | "narrow the feed"                                                   |
| `features/auth`                     | capability  | "log in" / "log out"                                                |
| `widgets/message-card`              | composition | stitches two entities and two features, adds no new capability      |
| `widgets/header`                    | composition | `entities/session` + `useLogout` from `features/auth` + `shared/ui` |
| `entities/message/ui/MessageCard`   | domain UI   | a dumb card — it can do nothing on its own                          |

---

## 2. May a view import a feature directly?

**Yes. Hooks included.**

The dependency rule is "a layer may import from any layer **strictly below** it" — not "from the next
one down". There is no mandatory `views → widgets → features` chain. `views → features`,
`views → entities`, `views → shared` are all legal.

The code already does it — [`views/feed/ui/FeedView.tsx`](../src/views/feed/ui/FeedView.tsx):

```ts
import { serializeFilters, useMessagesInfinite, type FeedFilters } from '@/entities/message';
import { FilterBar, MobileFilterBar, useFeedFilters } from '@/features/feed-filters';
import { Composer } from '@/features/message-compose';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
```

A view takes both a component and a **hook** (`useFeedFilters`) straight from a feature, skipping
`widgets` entirely — and `pnpm lint-check` passes. That is not an interpretation; it is
`import-fsd/no-denied-layers` confirming it.

The only condition on the hook is rule 3: it must be in the slice's public API.
[`features/feed-filters/index.ts`](../src/features/feed-filters/index.ts) exports `useFeedFilters`. A
barrel may promise anything — components, hooks, types, schemas. What it promises is
[a decision, not a dump](./inner/ARCHITECTURE.md#public-api-decisions).

### So when is a widget actually needed?

Three cases, and only three:

1. **Sibling slices must be combined.** Structural — there is no way around it.
2. **The block is used by two or more views.**
3. **A view has outgrown itself** and the block has a name of its own.

None of those? Keep the component in `views/<slice>/ui/`. This repo does: `MessageList`,
`LoadMoreButton`, `FeedEmpty`, `FeedError` and `FeedSkeleton` all live in
[`views/feed/ui/`](../src/views/feed/ui/), not in `widgets`. This is the single most common mistake
when adopting FSD — a widget per block, and a layer of single-use wrappers whose only contribution is
one more hop in the import graph.

### The mirror image — what is forbidden

|                                |                                                      |
| ------------------------------ | ---------------------------------------------------- |
| `feature` → `widget` / `views` | upward                                               |
| `widget` → `widget`            | sibling                                              |
| `feature` → `feature`          | sibling                                              |
| `entity` → `feature`           | upward — this was the violation the refactor removed |

The sibling ban has a visible consequence. `features/message-edit` may not call `useFeedFilters()`,
because `feed-filters` is its sibling. So the filter set is passed down as a prop — `MessageList` →
`widgets/message-card` → both mutation hooks. That prop-drilling is not sloppiness; it is what rule 2
looks like from the inside. The widget is the seam, so the widget carries the shared value.

---

## 3. Where state lives

**FSD constrains the direction of imports, not which React primitives a layer may use.** There is no
"widgets are stateless" rule and no "state only in `model/`" rule. Every layer is free to use
`useState`, `useReducer`, refs and context.

### `useState` in a widget, passed into a feature

[`MessageCardWithActions`](../src/widgets/message-card/ui/MessageCardWithActions.tsx) does exactly
that, and it is the canonical shape:

```ts
const [deleteConfirming, setDeleteConfirming] = useState(false);
const [isEditing, setIsEditing] = useState(false);
```

`isEditing` decides which child renders — `MessageCard` from `entities` or `MessageEditor` from
`features/message-edit` — and the editor receives `isSaving`, `onSave`, `onCancel` as props. The
widget holds the state and hands it to a feature's component. Legal: the import points down
(widget → feature), and props are not imports.

### The real question is not "may I" but "whose state is it"

| State                                                                                           | Owner                                 |
| ----------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Arrangement** — which child is showing, is a panel open, a local confirm mode, focus handling | the widget                            |
| **Capability behaviour** — form field values, validation, a mutation's pending/error            | the feature; the widget must not know |

Both sides are in place here. `isEditing` and `deleteConfirming` are arrangement, held by the widget.
The editor's form state belongs to the feature —
[`MessageEditor`](../src/features/message-edit/ui/MessageEditor.tsx) sets up its own `useForm`, and
the widget knows nothing about fields; it receives a finished `content` in `onSave`.

**The smell to watch for:** a widget that starts holding a feature's field values, or duplicating its
validation. That means the feature has been hollowed out into a dumb view and its logic leaked
upward. What breaks the architecture is not `useState` — it is that.

### What is forbidden here

A feature may not reach into a widget's state. If `features/message-edit` imported a context declared
in `widgets/message-card`, that is an upward import and the linter fails.

So when two sibling features need shared state, the widget owns it and passes it **down** — which is
the same mechanism as the `filters` prop in §2.

### Subscribing to a store from a widget

Allowed, as long as the store is declared **below**:

| Where the store lives                   | May a widget subscribe                                                                                                                                                        |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entities/*/model/`                     | yes                                                                                                                                                                           |
| `features/*/model/`                     | yes — including several features at once, which is the widget's job                                                                                                           |
| `shared/`                               | technically yes, but only for something genuinely generic (theme, toasts). A store holding domain data in `shared` means `shared` knows the domain — rule 5 is already broken |
| in the widget itself, read by a feature | no — upward                                                                                                                                                                   |
| in another widget                       | no — sibling                                                                                                                                                                  |

Both legal cases already exist: `useSession()` from
[`entities/session`](../src/entities/session/model/SessionProvider.tsx) is a widget subscribing to an
entity's context (both `Header` and `message-card` do it), and `useToast()` from `shared/ui/Toaster`
is the generic, domain-free case.

### But this repo has no store at all

No zustand, no redux, no jotai, no mobx. Exactly two `createContext` calls: session and toaster.

That is the most useful part of the answer. "Where do I subscribe to the store" barely comes up here,
because state was deliberately placed so that no global client state remains:

- **Filters** live in the URL.
- **Server data** lives in the TanStack Query cache.
- **Local arrangement** lives in `useState`, in the component it belongs to.
- **Global context** survives only where it is genuinely global and effectively immutable: who is
  logged in, and the toast queue.

Keep the table above for teams that will bring Zustand into their own project. But the lesson worth
stating out loud is the other one: **most "where should the store live" questions dissolve when there
is no store.**

Choosing between `useState`, context and an external store in the first place is a separate question
from which layer owns it — that one is in [`store/README.md`](./store/README.md).

### One practical caveat

`MessageCardWithActions` calls `useSession()` and two mutation hooks **per row**. With roughly fifteen
mounted rows that is fifteen context subscriptions and thirty `useMutation` instances. Here it costs
nothing — the session does not change after login and `useMutation` is cheap.

The rule is still worth knowing: **a subscription in a widget that renders N times is N
subscriptions.** If the value changes often, push the subscription down to the leaf that actually
needs it, or lift it into the view and pass it as a prop.
