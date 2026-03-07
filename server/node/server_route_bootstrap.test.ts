import { describe, expect, it, vi } from "vitest";
import { registerServerRoutes } from "./server_route_bootstrap.cjs";

describe("registerServerRoutes", () => {
  it("passes applyStateCommands through to memory route registration", () => {
    const registerSystemRoutes = vi.fn();
    const registerProxyRoutes = vi.fn();
    const registerIntegrationRoutes = vi.fn();
    const registerMemoryRoutes = vi.fn();
    const registerHypaV3TraceRoutes = vi.fn();
    const registerHypaV3ManualRoutes = vi.fn();
    const registerHypaV3ResummaryRoutes = vi.fn();
    const registerLLMRoutes = vi.fn();
    const registerContentRoutes = vi.fn();
    const registerAuthRoutes = vi.fn();
    const registerStateRoutes = vi.fn();
    const registerSyncRoutes = vi.fn();
    const registerRagRoutes = vi.fn();
    const applyStateCommands = vi.fn();

    registerServerRoutes({
      registerSystemRoutes,
      registerProxyRoutes,
      registerIntegrationRoutes,
      registerMemoryRoutes,
      registerHypaV3TraceRoutes,
      registerHypaV3ManualRoutes,
      registerHypaV3ResummaryRoutes,
      registerLLMRoutes,
      registerContentRoutes,
      registerAuthRoutes,
      registerStateRoutes,
      registerSyncRoutes,
      registerRagRoutes,
      app: {},
      applyStateCommands,
    });

    expect(registerMemoryRoutes).toHaveBeenCalledTimes(1);
    const memoryArg = registerMemoryRoutes.mock.calls[0]?.[0] as {
      applyStateCommands?: unknown;
    };
    expect(memoryArg?.applyStateCommands).toBe(applyStateCommands);
  });
});
