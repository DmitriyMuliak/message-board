# Why a flex item refuses to shrink — `min-width: auto`

A classic flex bug, and the one-line fix most people apply without knowing what it does.

## The rule behind it

Browsers give every flex item `min-width: auto` by default. That means **an item cannot become
narrower than its own content**. Not narrower than its declared width — narrower than the intrinsic
minimum of what is inside it.

## What it looked like

A layout with a `<main>` as a flex item:

```tsx
<div className="flex-1 flex w-full ...">
  {children} {/* ← this is <main>, a flex item */}
</div>
```

When a table with `min-width: 520px` appeared inside, the browser computed: "the minimum content size
of `<main>` is 520px plus padding = 630px". So `<main>` stretched to 630px on a 390px viewport.

Everything below inherited the problem:

```
<main>                    → 630px  ❌
  .shell                  → 630px
    .report-mock          → 598px   (overflow: hidden, but already wide itself)
      .table-wrap         → 522px   (overflow: auto — but the table is 520px, so it fits!)
        .table            → 520px   ← min-width
```

Because `.report-mock` had itself stretched to 598px, the wrapper inside it was 522px, and the 520px
table fitted without overflowing. **No scrollbar appeared** — the last column simply ran off the
viewport and vanished.

### Why `overflow: hidden` did not save it

`overflow: hidden` clips content, but it does not change the element's own size. The mock was already
598px wide on its own, so there was nothing left to clip.

## The fix

One class:

```tsx
<main className="min-w-0">
```

`min-width: 0` cancels `min-width: auto`. The flex item can now shrink to zero, so `<main>` stays at
390px regardless of how wide its content is.

The hierarchy then behaves:

```
<main>                    → 390px  ✅
  .shell                  → 358px
    .report-mock          → 324px  (overflow: hidden — now actually clips)
      .table-wrap         → 250px  (overflow: auto)
        .table            → 520px  ← overflows the wrapper
                                   → horizontal scrollbar appears  ✅
```

## The takeaway

`min-w-0` on flex items is the standard remedy, and most developers carry it as a superstition until
they hit exactly this situation. The rule to remember: **a flex item that contains something with an
intrinsic minimum width will refuse to shrink unless you tell it it may.** The same applies on the
cross axis with `min-height: 0`.
