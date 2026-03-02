# Code Conventions

## Security Rules
- `eval()` and `new Function()` are forbidden in production paths
- Unsanitized `innerHTML` is forbidden — use `DOMPurify.sanitize()`
- `{@html}` requires sanitized input with clear sanitizer ownership

## Type Safety
- `any`, `as any`, `@ts-ignore`, `@ts-nocheck` are all forbidden
- Use `unknown` and narrow at boundaries
- Current tsconfig: strict=false, strictNullChecks=false, noImplicitAny=false
- External payloads must be validated with Zod/TypeBox

## Error Handling
- Use structured `Result<T, E>` types for domain errors
- Every async server handler must have try/catch
- No generic string errors for domain logic

## Architecture
- New files: <=500 LOC
- No circular dependencies
- Services = pure logic; Stores = reactive state; Components = presentation
- No mixed Svelte 4/5 patterns ($state vs writable)
- Global state must be centralized — no ad-hoc global stores in feature files

## Server Rules
- All server files are CommonJS (.cjs)
- DI pattern: all deps destructured from `arg` at top of handler
- `requireSafeSegment` / `safeResolve` on every user-supplied ID
- `sendJson` only — never `res.json()` / `res.send()`
- No business logic in route files — extract to service modules if handler >~20 lines
- Streaming: NDJSON via `sendSSE`

## Naming Conventions
- Client TypeScript: camelCase functions/variables, PascalCase types/classes
- Server files: snake_case file names with .cjs extension
- Svelte components: PascalCase

## Client/Server Gate
```typescript
import { isNodeServer } from 'src/ts/platform';
if (isNodeServer) {
  return globalFetch('/data/some/endpoint', { ... });
}
throw new Error('Server-only runtime is required.');
```
