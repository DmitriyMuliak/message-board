# React Hook Form — validation modes, `isValid`, and `watch`

Two things that behave differently from how they read, and cost an afternoon each when you meet them
for the first time.

## Validation modes

| `mode`               | When a field validates            | `isValid` before submit                |
| -------------------- | --------------------------------- | -------------------------------------- |
| `onSubmit` (default) | only on submit                    | **always `false`**                     |
| `onBlur`             | when a field loses focus          | true once every touched field is clean |
| `onChange`           | on every keystroke                | updated live                           |
| `onTouched`          | after first touch, then on change | updated after interaction              |
| `all`                | on blur _and_ change              | updated live                           |

`reValidateMode` controls when a field is checked **again** — after the user fixes an error, for
instance.

## How `formState.isValid` actually behaves

This is the part that surprises people:

- Its value depends on `mode`. Under `onSubmit` it stays **`false` until a submit happens** — even if
  every field is filled in correctly.
- Under `onBlur`/`onChange` it becomes `true` once the validated fields are clean, and can flip back
  to `false` when new errors appear.

So `const { isValid } = form.formState` is not one behaviour; it is two.

### The same code, two different forms

```ts
// A: validates only on submit
const form = useForm<SendToAnalyzeFEType>({
  resolver: localizedValibotResolver(dynamicSchema, tv),
  mode: 'onSubmit',
  defaultValues: { cvText: '', jobText: '', jobFile: [], cvFile: [] },
});

// B: validates on blur
const form = useForm<ContactSchemaFEType>({
  resolver: localizedValibotResolver(ContactSchemaFE, tv),
  mode: 'onBlur',
  defaultValues: { name: '', email: '', message: '', files: [], recaptchaToken: null },
});
```

**Form A (`onSubmit`)** — nothing is validated until Send is pressed. `isValid` is `false` the whole
time, so a button wired to `disabled={!isValid}` **never enables**. Good when you do not want to nag
the user before they have tried.

**Form B (`onBlur`)** — a field validates when it loses focus, `isValid` can become `true` before any
submit. Good when you want errors shown as soon as the user is done with a field.

## Disabling the submit button

Three options, with different first impressions for the user:

```ts
// 1. Blocked until everything is valid — requires mode 'onChange' | 'onBlur'
const isFormInvalid = !formState.isValid;

// 2. Enabled at first, blocked only on a real error
const isFormInvalid = Object.keys(formState.errors).length > 0;

// 3. The compromise: only starts blocking after the first interaction
const isFormInvalid =
  Object.keys(formState.errors).length > 0 && (formState.isDirty || formState.isSubmitted);
```

Option 2 works because `errors` is empty until something has been validated — so it reads as "valid"
at the start and the button is live immediately.

> **This repo takes a different position entirely:** submit stays **enabled** when the form is
> invalid, because a disabled button is out of the tab order and explains nothing — the user needs
> telling _why_. Disabling is reserved for genuine no-ops, like a save with nothing changed. See
> [`inner/ARCHITECTURE.md` → Conventions](../inner/ARCHITECTURE.md#conventions). The options above
> are still worth knowing; just be deliberate about which problem you are solving.

## `form.watch('files')` vs `useWatch({ control, name: 'files' })`

They look interchangeable and are not.

**`form.watch('files')`**

- A method on the `useForm` instance. Returns the value at the moment you call it.
- **Does not create a subscription by itself.** For the component to re-render on change you must
  call it during render.
- Right for a one-off read, or from non-React code.

**`useWatch({ control, name: 'files' })`**

- A hook. Subscribes the component and re-renders whenever `files` changes.
- Declarative, and better for deriving UI state.
- Needs `control` — from `useForm` or `useFormContext`.

In practice: if the component should update automatically when the field changes, use **`useWatch`**.
If you just need the current value once, use **`form.watch`**.

The performance angle is worth noting too: `useWatch` subscribes at the field level, so only that
component re-renders. Calling `watch()` in render subscribes the **whole form component** to every
change, which is how a large form ends up re-rendering on every keystroke.

---

Related: [Forms that work before JavaScript loads](./progressive-enhancement.md)
