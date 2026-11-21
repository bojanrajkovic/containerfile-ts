# Future Dockerfile Instructions

This document tracks Dockerfile instructions not yet implemented in containerfile-ts that could be added in future phases.

## Other Potential Instructions

### STOPSIGNAL

Sets the system call signal for container exit.

```dockerfile
STOPSIGNAL SIGTERM
STOPSIGNAL 9
```

### ONBUILD

Adds a trigger instruction for when the image is used as a base.

```dockerfile
ONBUILD RUN npm install
ONBUILD COPY . /app
```

## Type Enhancements

### Port Range Validation

The `ExposeInstruction` port range type allows `start > end` which would be semantically invalid:

```typescript
// Currently allowed but invalid
const expose: ExposeInstruction = {
  type: "EXPOSE",
  port: { start: 9000, end: 8000 }, // start > end - invalid
  protocol: "tcp",
};
```

Future enhancement options:

1. **Validation functions** - Runtime validation when constructing instructions
2. **Branded types** - Compile-time enforcement using TypeScript branded types

```typescript
// Branded type approach
type ValidPortRange = {
  readonly start: number;
  readonly end: number;
  readonly __brand: "ValidPortRange";
};

function portRange(start: number, end: number): ValidPortRange {
  if (start > end) throw new Error("start must be <= end");
  return { start, end } as ValidPortRange;
}
```

## Priority

1. **Low:** STOPSIGNAL, ONBUILD - less common use cases
