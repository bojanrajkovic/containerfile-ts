# Code Style and Conventions

## Architectural Pattern: FCIS (Functional Core, Imperative Shell)

All production code in `src/` is **Functional Core** - pure functions with no side effects:
- All types, factory functions, and rendering logic are pure
- No I/O operations in production code
- Immutable data structures (readonly fields)

Test code in `tests/` is **Imperative Shell** - performs I/O:
- File reading, dynamic imports, etc.

**Every file must have a pattern comment:**
```typescript
// pattern: Functional Core
// or
// pattern: Imperative Shell
```

## TypeScript Style Guide

### Types vs Interfaces
- **Use `type` over `interface`** for all data structures
- Only use `interface` for class contracts (rare in this project)

### Type Syntax
- **Use `ReadonlyArray<T>`** for array parameters (not `Array<T>` or `T[]`)
- **Use `Array<T>`** syntax for mutable arrays (not `T[]`)
- **Use `null` for absent values**, not `undefined`
- **All object fields are `readonly`** for immutability

### Example
```typescript
type MyType = {
  readonly field: string;
  readonly items: ReadonlyArray<string>;  // For parameters
  readonly mutableItems: Array<number>;   // For mutable arrays
  readonly optional: string | null;        // Not string | undefined
};
```

## Naming Conventions
- **Types**: PascalCase (e.g., `FromInstruction`, `CopyOptions`)
- **Functions**: camelCase (e.g., `from()`, `render()`)
- **Variables**: camelCase
- **Constants**: camelCase (not SCREAMING_SNAKE_CASE)

## TypeScript Configuration
The project uses **extremely strict TypeScript** settings:
- `strict: true`
- `noUncheckedIndexedAccess: true`
- `noPropertyAccessFromIndexSignature: true`
- `noImplicitAny: true`
- `strictNullChecks: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noImplicitReturns: true`
- `noFallthroughCasesInSwitch: true`

## Type System Patterns

### Discriminated Unions
All instruction types use discriminated unions with a `type` field for exhaustive pattern matching:

```typescript
type Instruction =
  | FromInstruction
  | RunInstruction
  | CopyInstruction
  // ... etc
```

### Factory Functions
- Use optional parameters via option objects (not individual optional params)
- Return readonly types
- No side effects

```typescript
export function from(image: string, options?: FromOptions): FromInstruction {
  return {
    type: 'from',
    image,
    as: options?.as ?? null,
    platform: options?.platform ?? null,
  };
}
```

## File Organization
- One type definition per file when logical
- Export all public API from `src/index.ts`
- Keep related functionality together
- Separate pure logic (types, factories, rendering) from I/O (tests)

## Comments and Documentation
- Use TSDoc comments for public API
- Add comments for non-obvious business logic
- Don't add comments for self-evident code
- Don't add pattern comments to every file (already mandated)
