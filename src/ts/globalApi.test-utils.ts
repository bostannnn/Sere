type SaveDbRuntimeTestHooks = {
  resetSaveDbRuntimeForTests: () => void;
  isSaveDbRuntimeInitializedForTests: () => boolean;
  getSaveDbRuntimeStartCountForTests: () => number;
};

const SAVE_DB_RUNTIME_TEST_HOOKS_KEY = "__RISU_SAVE_DB_RUNTIME_TEST_HOOKS__";

function getSaveDbHooks(): SaveDbRuntimeTestHooks {
  const hooks = (globalThis as typeof globalThis & {
    [SAVE_DB_RUNTIME_TEST_HOOKS_KEY]?: SaveDbRuntimeTestHooks;
  })[SAVE_DB_RUNTIME_TEST_HOOKS_KEY];
  if (!hooks) {
    throw new Error("globalApi test hooks are unavailable. Import globalApi.svelte first.");
  }
  return hooks;
}

export function resetSaveDbRuntimeForTests() {
  getSaveDbHooks().resetSaveDbRuntimeForTests();
}

export function isSaveDbRuntimeInitializedForTests() {
  return getSaveDbHooks().isSaveDbRuntimeInitializedForTests();
}

export function getSaveDbRuntimeStartCountForTests() {
  return getSaveDbHooks().getSaveDbRuntimeStartCountForTests();
}
