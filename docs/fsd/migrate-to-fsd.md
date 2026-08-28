# Migrate to FSD

A practical guide for teams migrating an existing application to Feature-Sliced Design.

**Do not treat FSD migration as a rewrite.** Migrate incrementally, feature by feature, while keeping the application working throughout the process.

## 1. Start with the boundaries, not the folders

Do not begin by moving every component into `shared`, `entities`, `features`, and `widgets`.

First identify the boundaries in the existing code:

- **Entity** — domain object and its reusable domain UI.
- **Feature** — something the user can do.
- **Widget** — a composition block that combines entities/features.
- **View** — page-level composition.
- **Shared** — genuinely reusable, domain-agnostic code.
- **App** — Next.js/RSC composition and application infrastructure.

A useful question when classifying code is:

> **If I remove this slice, does a user capability disappear, or does only a piece of composition disappear?**

If a capability disappears, it is likely a **feature**.
If only a composition block disappears, it is likely a **widget**.

Do not create a widget just because a component is visually large. A widget should have a reason to exist.

## 2. Migrate incrementally

Avoid a "big bang" migration.

A safer approach is:

1. Choose one bounded feature or user flow.
2. Identify its entities, features, composition and shared dependencies.
3. Create the FSD slices.
4. Move the implementation behind public APIs.
5. Update consumers gradually.
6. Delete the old implementation.
7. Repeat.

During migration, it is completely acceptable for old and FSD code to coexist.

The goal is not to make the entire repository FSD-compliant on day one. The goal is to make the **new and migrated code follow the architecture consistently**.

## 3. Establish the dependency direction early

The most important architectural rule is:

```text
app → views → widgets → features → entities → shared
```

A layer may import from any layer strictly below it.

For example:

```text
views → features     ✅
views → entities     ✅
widgets → features   ✅
widgets → entities   ✅
features → entities  ✅

features → widgets   ❌
feature A → feature B ❌
entity → feature     ❌
widget A → widget B  ❌
```

There is **no requirement** that every dependency goes through the immediately lower layer.

For example, a view may legitimately use a feature directly:

```ts
import { Composer } from '@/features/message-compose';
import { useFeedFilters } from '@/features/feed-filters';
```

Do not introduce widgets merely to make the dependency chain look symmetrical.

## 4. Define public APIs immediately

Each slice should expose an explicit public API:

```text
features/message-edit/
├── ui/
├── model/
├── api/
├── lib/
└── index.ts
```

Consumers import only from the slice root:

```ts
import { MessageEditor } from '@/features/message-edit';
```

Never:

```ts
import { MessageEditor } from '@/features/message-edit/ui/MessageEditor';
```

The internal folder structure is an implementation detail.

This is especially important during migration: **do not reproduce the old import graph inside the new FSD structure.**

## 5. Do not turn `shared` into a dumping ground

One of the easiest ways to create "FSD-shaped spaghetti" is to move everything reusable into `shared`.

Before putting something there, ask:

> **Could this code exist without knowing anything about our domain?**

Good candidates:

```text
shared/ui/Button
shared/lib/date
shared/api/http-client
shared/config
```

Bad candidates:

```text
shared/ui/MessageCard
shared/lib/message-permissions
shared/api/message-api
```

If it knows about a business domain, it probably belongs in an entity or feature.

**Reusable does not automatically mean shared.**

## 6. Be conservative with widgets

Widgets are often overused during FSD migrations.

A component does **not** need to become a widget just because it is:

- large;
- visually important;
- reused internally;
- rendered on a page.

A widget is useful when:

1. sibling slices need to be composed together;
2. the composition is reused by multiple views;
3. a view has grown enough that the composition deserves a name of its own.

Otherwise, keep the component inside the view.

Avoid creating structures like:

```text
views/feed
  ↓
widgets/feed-content
  ↓
widgets/message-list
  ↓
features/message...
```

when those widgets only forward props and add no meaningful composition.

**One extra folder is not architecture.**

## 7. Move behaviour with the capability

When extracting a feature, move its behaviour together with its UI.

For example, a message editor should own:

- form state;
- validation;
- mutation;
- saving/error state;
- the editor UI.

The widget that uses it should own only composition state:

```ts
const [isEditing, setIsEditing] = useState(false);
```

The widget decides **whether** the editor is displayed.

The feature decides **how** editing works.

Avoid extracting only a "dumb component" into `features/` while leaving its actual logic in a page or widget.

## 8. Let state follow ownership

FSD does not prescribe `useState`, Context, Zustand, Redux, etc.

Instead, ask:

> **Who owns this state?**

Typical ownership:

| State                           | Owner                            |
| ------------------------------- | -------------------------------- |
| Form values / validation        | Feature                          |
| Mutation state                  | Feature                          |
| Which child is displayed        | Widget                           |
| Local UI arrangement            | Widget                           |
| Page-specific composition state | View                             |
| Server data                     | Query/cache layer                |
| URL filters                     | URL                              |
| Truly global state              | Appropriate global/context layer |

A widget may hold local state and pass it to a feature. That is valid because props do not create an architectural dependency.

The important distinction is **ownership**, not the React primitive being used.

## 9. Extract entities before features when the domain is unclear

For an existing feature, first identify the domain objects it works with.

For example:

```text
message
session
order
product
user
```

Then separate:

```text
entities/message
    domain model + reusable domain UI

features/message-edit
    editing capability

features/message-delete
    deletion capability

widgets/message-card
    composition of the above
```

This prevents a common migration mistake where a large existing component becomes a single giant feature containing the entire domain.

## 10. Migrate tests together with the slice

Tests should move with the code they test.

For example:

```text
features/message-edit/
├── ui/
│   └── MessageEditor.tsx
├── model/
├── api/
├── MessageEditor.test.tsx
├── MessageEditor.testkit.ts
└── index.ts
```

Only test infrastructure that belongs to no particular slice should remain in:

```text
tests/
```

Do not use the migration as a reason to rewrite all tests. Move them first; improve their structure later.

## 11. Use the architecture checks as your migration guardrail

Once the FSD boundaries are introduced, enforce them automatically.

Architecture rules should catch things such as:

- invalid layer dependencies;
- sibling slice imports;
- imports bypassing public APIs;
- production code importing tests;
- `shared` depending on domain code;
- unauthorized access to `server/`.

Use lint/CI as the safety net so that migrated code does not gradually drift back into the old architecture.

For larger refactors, use the architecture audit tooling as an additional sanity check.

## 12. A recommended migration order

For a large existing application, a practical sequence is:

```text
1. Define the target layers
        ↓
2. Add/enforce dependency rules
        ↓
3. Pick one bounded user flow
        ↓
4. Identify entities
        ↓
5. Extract capabilities into features
        ↓
6. Extract only necessary composition into widgets
        ↓
7. Move page composition into views
        ↓
8. Clean up shared dependencies
        ↓
9. Move tests with the slices
        ↓
10. Remove the old implementation
```

Do this repeatedly rather than attempting to migrate the entire application at once.

## 13. The most common migration mistakes

### ❌ "Let's move everything into folders first"

Folders alone do not create architecture.

### ❌ "Every component should be a widget"

This creates unnecessary wrappers and makes the dependency graph harder to understand.

### ❌ "Everything reusable goes to shared"

`shared` is not a generic trash can for code nobody knows where to put.

### ❌ "Views can only import widgets"

Views may import any lower layer directly.

### ❌ "Widgets must be stateless"

Widgets may own local composition state.

### ❌ "All state must live in model"

FSD defines dependency boundaries, not React state-management rules.

### ❌ "We need to migrate everything before merging"

Incremental migration is safer. Mixed architecture during migration is acceptable.

### ❌ "Let's create abstractions before we have a real boundary"

Prefer extracting boundaries from existing domain and user capabilities. Do not invent layers, wrappers or generic abstractions just to satisfy the folder structure.

## Definition of Done

A migrated area is considered FSD-compliant when:

- its responsibilities are split into appropriate layers;
- dependencies point only downward;
- sibling slices do not depend on each other;
- consumers use slice public APIs;
- domain-specific code is not hidden in `shared`;
- features own their capabilities and behaviour;
- widgets own composition rather than business capabilities;
- tests live with the code they test;
- architecture checks pass.

**The goal is not to make the folder tree look like FSD.**

The goal is to make **dependencies, ownership and business capabilities explicit**.
