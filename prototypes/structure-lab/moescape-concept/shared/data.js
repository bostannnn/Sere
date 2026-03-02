(function initStructureLabData(global) {
  const characters = [
    { id: 'char-1', name: 'Eva Salazar', archetype: 'Industrial Noir', updatedAt: '12m ago', avatar: './assets/char.png' },
    { id: 'char-2', name: 'Richard Vale', archetype: 'Gothic Chronicle', updatedAt: '41m ago', avatar: './assets/char.png' },
    { id: 'char-3', name: 'John Mercer', archetype: 'Urban Occult', updatedAt: '2h ago', avatar: './assets/char.png' },
    { id: 'char-4', name: 'Mara Ilyin', archetype: 'Political Intrigue', updatedAt: '6h ago', avatar: './assets/char.png' },
    { id: 'char-5', name: 'Kira Sloan', archetype: 'Cyber Mystery', updatedAt: '1d ago', avatar: './assets/char.png' },
  ];

  const chatTemplates = [
    ['Warehouse Session', 'Bassline-driven scene progression with tight sensory cues.'],
    ['Late Night Debrief', 'Character dynamic review and continuity correction.'],
    ['Rulebook Sync', 'RAG-backed rules retrieval and citation checks.'],
    ['Memory Pass', 'Manual summary and selective resummarization.'],
    ['Conflict Escalation', 'Fast turn cadence with unresolved thread setup.'],
    ['Character Pivot', 'Tone shift and personality boundary test.'],
  ];

  let c = 1;
  const chats = characters.flatMap((character, idx) => {
    const count = 3 + (idx % 3);
    return Array.from({ length: count }).map((_, i) => {
      const t = chatTemplates[(idx + i) % chatTemplates.length];
      const id = `chat-${c++}`;
      return {
        id,
        characterId: character.id,
        title: `${t[0]} #${i + 1}`,
        preview: t[1],
        turns: 22 + ((idx * 7 + i * 3) % 60),
        unread: (idx + i) % 3,
        updatedAt: ['4m ago', '16m ago', '58m ago', '3h ago', '8h ago', '1d ago'][(idx + i) % 6],
      };
    });
  });

  const tools = [
    'Tokenizer', 'Prompt Diff', 'Embedding Probe', 'Parser Trace', 'Subtitle Cleaner',
    'Image Translation', 'MCP Inspector', 'Inlay Assets', 'Memory Re-summarizer',
  ].map((name, idx) => ({
    id: `tool-${idx + 1}`,
    name,
    status: ['ready', 'ready', 'busy', 'ready', 'error'][idx % 5],
    updatedAt: ['3m ago', '22m ago', '1h ago', '5h ago'][idx % 4],
  }));

  const rulebooks = [
    'Thousand Year Old Vampire.pdf',
    'VTM Revised Core.pdf',
    'Delta Green Handler Guide.pdf',
    'Mothership Warden Ops.pdf',
    'Blades In The Dark SRD.pdf',
  ].map((name, idx) => ({
    id: `book-${idx + 1}`,
    name,
    pages: 90 + idx * 44,
    state: ['embedded', 'embedding', 'queued', 'failed', 'embedded'][idx],
    updatedAt: ['5m ago', '19m ago', '52m ago', '2h ago', '1d ago'][idx],
  }));

  const settings = [
    { id: 's1', name: 'Models', summary: 'Provider routing, fallback, max tokens.' },
    { id: 's2', name: 'Display', summary: 'Density, panels, typography scale.' },
    { id: 's3', name: 'Memory', summary: 'Auto-summary, resummary, retrieval thresholds.' },
    { id: 's4', name: 'RAG', summary: 'TopK, min score, budget, embedding model.' },
  ];

  global.StructureLabData = { characters, chats, tools, rulebooks, settings };
})(window);
