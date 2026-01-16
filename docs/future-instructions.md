# Future Dockerfile Instructions

This document tracks Dockerfile instructions not yet implemented in containerfile-ts that could be added in future phases.

## USER Instruction

Sets the user and optionally the group for subsequent instructions and the container runtime.

```dockerfile
USER <user>[:<group>]
USER <UID>[:<GID>]
```

**Proposed type:**

```typescript
export type UserInstruction = {
  readonly type: "USER";
  readonly user: string;
  readonly group: string | null;
};
```

## VOLUME Instruction

Creates a mount point and marks it as holding externally mounted volumes.

```dockerfile
VOLUME ["/data"]
VOLUME /data /logs
```

**Proposed type:**

```typescript
export type VolumeInstruction = {
  readonly type: "VOLUME";
  readonly paths: ReadonlyArray<string>;
};
```

## SHELL Instruction

Overrides the default shell used for the shell form of commands.

```dockerfile
SHELL ["powershell", "-command"]
SHELL ["/bin/bash", "-c"]
```

**Proposed type:**

```typescript
export type ShellInstruction = {
  readonly type: "SHELL";
  readonly command: ReadonlyArray<string>;
};
```

## Other Potential Instructions

### HEALTHCHECK

Configures container health monitoring.

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost/ || exit 1
HEALTHCHECK NONE
```

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

1. **High:** USER, VOLUME - commonly used
2. **Medium:** SHELL, HEALTHCHECK - useful for production images
3. **Low:** STOPSIGNAL, ONBUILD - less common use cases
