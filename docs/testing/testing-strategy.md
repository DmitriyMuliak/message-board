# Frontend Testing Strategy

## Purpose

Frontend tests should provide confidence in application behavior while keeping the test suite fast, maintainable, and reliable.

Tests should be written at the **lowest level that can effectively verify the behavior**. Avoid testing implementation details when the behavior can be verified through a higher-level interface.

The main testing levels are:

- **Unit tests** — verify isolated logic.
- **Integration tests** — verify interaction between multiple frontend parts.
- **End-to-End (E2E) tests** — verify critical user flows across the application.

---

## Testing Levels

### Unit Tests

Unit tests verify a single unit of logic in isolation.

Use unit tests for:

- Business rules
- Pure functions
- Data transformations
- Parsers and formatters
- Validation logic
- Reducers
- Complex algorithms
- Isolated utilities
- Other logic where integration with the UI is not required

Example:

```ts
describe('calculateTotal', () => {
  it('applies the discount to the total', () => {
    expect(calculateTotal(items, discount)).toBe(120);
  });
});
```

Unit tests should generally avoid rendering React components or mocking unrelated dependencies.

Do **not** create unit tests simply to increase coverage for trivial UI components.

For example, testing that a button renders with a particular CSS class usually provides little value unless that class itself represents meaningful behavior.

**Goal:** verify that isolated logic behaves correctly.

---

### Integration Tests

Integration tests verify that multiple parts of the frontend work correctly together.

This should be the primary testing layer for complex frontend applications.

Typical integration scenarios include:

- Component + component interaction
- Component + state management
- Component + API
- Form + validation + state
- Multiple widgets working together
- User interactions spanning multiple components
- Page-level flows with mocked backend dependencies

Example:

```ts
const page = new CheckoutPageDriver();

page.address.fill({
  country: 'US',
  city: 'New York',
});

page.shipping.select('express');
page.payment.select('card');

await page.submit();

expect(page.summary).toShowTotal('$120');
```

Integration tests should exercise the **real application code and component interactions** while isolating external systems where appropriate.

For example, backend APIs can be controlled through a test harness:

```ts
harness.api.shipping.mockOptions(...);
harness.api.payment.mockSuccess();
harness.api.user.mock(...);
```

This allows the test to verify realistic frontend behavior without depending on external services.

### TestKit, Driver and Harness

For complex widgets and pages, tests should use a dedicated TestKit abstraction where appropriate.

A typical structure is:

```text
Test
 │
 └── Page / Widget TestKit
       │
       ├── Driver
       │     └── selectors + user actions
       │
       └── Harness
             └── API and environment control
```

A **Driver** exposes user-facing interactions and stable selectors.

A **Harness** controls external dependencies such as APIs or browser-specific infrastructure.

A **TestKit** provides the public testing interface of a component or widget.

Example:

```ts
checkout.address.fill(...);
checkout.shipping.select(...);
checkout.payment.submit();
```

Tests should interact with the component through its TestKit rather than depending on internal DOM structure or implementation details.

**Goal:** verify that frontend components and features work correctly as a system.

---

### End-to-End Tests

E2E tests verify critical application flows from the user's perspective.

They should focus on **high-value business journeys**, rather than attempting to cover every possible state or edge case.

Typical examples:

- Authentication
- Checkout
- Payment
- Account creation
- Critical purchase flows
- Critical navigation flows
- Other business-critical journeys

Example:

```text
User
 ↓
Login
 ↓
Product
 ↓
Cart
 ↓
Checkout
 ↓
Payment
 ↓
Order confirmation
```

E2E tests should use a real browser and, where appropriate, real application infrastructure.

Because E2E tests are slower and more expensive to maintain, avoid duplicating large numbers of scenarios already covered by integration tests.

**Goal:** verify that critical user journeys work across the application as a whole.

---

# Choosing the Right Test Level

Use the following rule when deciding where a test belongs:

| Question                                                                    | Test Type       |
| --------------------------------------------------------------------------- | --------------- |
| Can this behavior be verified without React or the DOM?                     | **Unit**        |
| Does the behavior depend on interaction between multiple frontend parts?    | **Integration** |
| Does the behavior represent a critical user journey across the application? | **E2E**         |

Think in terms of the **contract being protected**:

```text
Function → Function
        ↓
      Unit

Component → Component
Component → Store
Component → API
Widget → Widget
        ↓
   Integration

User → Page → Application → Backend
        ↓
       E2E
```

Always prefer the simplest test level that provides sufficient confidence.

---

# Recommended Test Distribution

There is no universal percentage that every frontend application should follow.

The commonly referenced `70% Unit / 20% Integration / 10% E2E` model should be treated only as a guideline, not a company requirement.

For complex frontend applications, a reasonable starting point is:

```text
Unit          40–60%
Integration   30–50%
E2E            5–10%
```

These percentages describe the approximate **testing effort and suite composition**, not a mandatory number of test cases.

The exact distribution should depend on the application architecture and risk profile.

For example, a complex frontend with many independent widgets and significant client-side interactions may benefit from a higher proportion of integration tests and fewer unit tests.

The priority should be **test value and confidence**, not achieving a particular percentage.

---

# General Principles

### Test behavior, not implementation

Prefer:

```ts
expect(page.summary).toShowTotal('$120');
```

over assertions about internal component state or implementation details.

### Prefer real application code

Integration tests should use real components, state management, routing, and business logic whenever practical.

Mock external dependencies rather than mocking the internal implementation of the feature being tested.

### Avoid test duplication

If a scenario is already thoroughly covered by an integration test, do not automatically duplicate the same scenario as an E2E test.

E2E should provide additional confidence at the application/system level.

### Keep E2E focused

Use E2E tests for critical paths and cross-system behavior.

Do not use E2E tests as a replacement for unit or integration tests.

### Optimize for signal

A smaller suite with meaningful behavioral coverage is preferable to a large suite that primarily verifies implementation details.

Code coverage is useful as a diagnostic metric, but high coverage alone does not indicate high test quality.

---

## Summary

```text
Unit
→ Isolated logic

Integration
→ Frontend parts working together

E2E
→ Critical user journeys
```

The preferred strategy is to build a strong foundation of unit and integration tests, with a smaller set of reliable E2E tests protecting the most critical business flows.

For complex frontend applications, **integration tests should be treated as a first-class testing layer**, not merely as a supplement to unit and E2E tests.
