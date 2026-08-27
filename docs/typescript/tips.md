# TypeScript techniques

Three things worth knowing that come up repeatedly: making structurally identical types
incompatible, parsing strings at the type level, and working around partial type argument inference.

---

## 1. Branded types (nominal typing)

TypeScript is structural: two `string`s are the same type, so nothing stops you passing a user id
where an analysis id is expected. Branding makes them incompatible **at compile time** with no
runtime cost.

```ts
declare const brand: unique symbol;
type Brand<T, TBrand extends string> = T & { readonly [brand]: TBrand };

// a general-purpose Id
export type Id<T extends string> = Brand<string, T>;
```

Applied to generated database row types:

```ts
import { Database } from './database.types';

type RawAnalysis = Database['public']['Tables']['cv_analyzes']['Row'];

export interface CvAnalysis extends Omit<RawAnalysis, 'id' | 'user_id' | 'resume_id'> {
  id: Id<'cv_analyzes'>;
  user_id: Id<'users'>;
  resume_id: Id<'resumes'>;
}
```

Now the compiler enforces the distinction:

```ts
const analysisId = 'abc-123' as Id<'cv_analyzes'>;
const userId = 'user-999' as Id<'users'>;

function getAnalysis(id: Id<'cv_analyzes'>) {
  /* … */
}

getAnalysis(analysisId); // ✅
getAnalysis(userId); // ❌ Id<'users'> is not assignable to Id<'cv_analyzes'>
```

And it flows through the query layer:

```ts
const { data } = await supabase.from('cv_analyzes').select('*').returns<CvAnalysis[]>();
```

The cost is the cast at the boundary — `as Id<'…'>` — which is the point: branding puts one explicit
line where the untrusted string becomes a trusted id, instead of nothing anywhere.

---

## 2. Parsing a string at the type level

How does `select('id, name')` know the shape of what comes back? The SDK literally slices the string
apart with recursive template literal types. Here is a simplified version of the machinery.

### Split

Turn `'a, b, c'` into `['a', 'b', 'c']`:

```ts
type Trim<T extends string> = T extends ` ${infer Rest}` | `${infer Rest} ` ? Trim<Rest> : T;

type Split<S extends string> = S extends `${infer T},${infer U}`
  ? [Trim<T>, ...Split<U>]
  : [Trim<S>];

type Result = Split<'id,  status, created_at'>;
// ["id", "status", "created_at"]
```

### Validate against the object's keys

```ts
type ValidateKeys<T, Keys extends string[]> = {
  [K in keyof Keys]: Keys[K] extends keyof T
    ? Keys[K]
    : `Error: column '${Keys[K]}' does not exist`;
};

type CvRow = { id: string; status: string; created_at: string };
type Check = ValidateKeys<CvRow, Split<'id, sda'>>;
// ["id", "Error: column 'sda' does not exist"]
```

Note the trick in the failure branch: instead of `never`, it produces a **string describing the
problem**, which surfaces in the editor as a readable message rather than an inscrutable mismatch.

### Build the result object

```ts
type ParseSelect<T, S extends string> =
  Split<S> extends infer K
    ? K extends string[]
      ? { [P in K[number]]: P extends keyof T ? T[P] : never }
      : never
    : never;

type MyResult = ParseSelect<CvRow, 'id, status'>;
// { id: string; status: string }
```

Use this sparingly. Recursive template literal types are expensive to check and hostile to debug; a
library can justify them, application code usually cannot.

---

## 3. Partial type argument inference

The problem: you want to fix one generic explicitly and let the other be inferred.

```ts
const createError = <TCode extends string, TData>(code: TCode, payload: TData) => {
  return { code, payload, timestamp: Date.now() };
};

// works, but you had to spell out both
createError<'QUEUE_FULL', { size: number }>('QUEUE_FULL', { size: 10 });

// ❌ not allowed — TS expects either all type arguments or none
createError<'QUEUE_FULL'>('QUEUE_FULL', { size: 10 });
```

TypeScript is all-or-nothing here: pass **one** type argument explicitly and inference is switched off
for the rest. Four ways around it, in the order you should reach for them.

### a. Mapped types — the answer 90% of the time

You usually do not need to write the type argument at all. Tie the arguments together through
`keyof`, and the literal is inferred:

```ts
type ActionPayloads = {
  ANALYZE: { file: File };
  LOG_OUT: undefined;
};

function dispatch<K extends keyof ActionPayloads>(type: K, payload: ActionPayloads[K]) {
  // …
}

dispatch('ANALYZE', { file: new File([], 'cv.pdf') }); // ✅ payload type known
dispatch('ANALYZE', { foo: 'bar' }); // ❌
```

TS sees the literal `'ANALYZE'`, narrows `K` to it, and derives the second argument. No explicit
generics, no duplication.

### b. One object argument

If both types should be inferred from values, put them in the same container so inference happens
once:

```ts
function handleError<TCode extends string, TData>(config: { code: TCode; data: TData }) {
  return config;
}

handleError({ code: 'QUEUE_FULL', data: { size: 10 } }); // both inferred
```

### c. Currying — for builders and factories

The pattern libraries use (`zod`, `redux-toolkit`): first call fixes the key, second uses it.

```ts
const createAction =
  <Code extends string>(code: Code) =>
  (payload: PayloadMap[Code]) => {
    /* … */
  };

createAction('ANALYZE_CV')({ cvId: '123' }); // ✅ payload type derived
createAction('UNKNOWN')({}); // ❌ not in PayloadMap
```

Perfect inference; the `()()` syntax is the price.

### d. Discriminated union — cleanest for action-shaped things

For Server Actions or Redux-like events, take a single object:

```ts
type Action = { type: 'ANALYZE'; payload: { file: File } } | { type: 'RESET'; payload?: never };

function dispatch(action: Action) {
  /* … */
}

dispatch({ type: 'ANALYZE', payload: { file } }); // autocomplete after `type`
```

> There is also the "dummy class" hack — a class existing only so one generic goes to the constructor
> and another to a method. Currying is simpler; do not bother.

### The rule

- Building a **builder or factory** → currying.
- An ordinary function call → **mapped types**. It lets you write `handleError('QUEUE_FULL', { … })`
  with no extra parentheses and no duplicated generics.
- A set of variants → discriminated union.
