Act as a Senior Software Architect and TypeScript/Svelte engineer.

Analyze the attached file `[FILE_NAME]` and decide whether it should be refactored. Do not recommend splitting it only because it is over 500 LOC.

If refactoring is justified:
1. Identify the file's current responsibilities.
2. Propose a better structure based on cohesion and single responsibility.
3. Specify which logic should stay in the file and which should move out.
4. Suggest target modules such as services, utilities, stores, or type files.
5. Preserve behavior, public exports, TypeScript safety, and Svelte reactivity.
6. Flag risks such as circular dependencies, API drift, and broken reactive flows.
7. Provide a step-by-step refactoring plan, but do not output full rewritten code.

Output format:
1. Architectural overview
2. Responsibility matrix
3. Proposed file map
4. Refactoring plan
5. Integration and risk notes
