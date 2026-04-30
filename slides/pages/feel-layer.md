---
layout: two-cols-header
---

# FEEL parsing — two libraries today, one tomorrow

<div class="absolute top-0 right-0 text-xs font-mono px-2 py-1 rounded-bl border border-t-0 border-r-0 border-purple-500/40 bg-purple-500/10 text-purple-400/80">feel-analyzer</div>

::left::

<div class="mr-4 mt-3">

## `@bpmn-io/lezer-feel`

**Job:** Parse FEEL and **infer the output type** by threading a variable context through a `ContextTracker` during the parse.

```js
const ctx = getResultContext(
  '= order.amount * 1.19',
  { order: { amount: 42 } }
);

getType(ctx.computedValue().value)
// → 'Number'
```

`trackVariables()` (from lezer-feel) does the type inference. `getResultContext()` in the **resolver** wraps it to snapshot the latest state on each `reduce()` — lezer doesn't expose the final context after a parse.

</div>

::right::

<div class="ml-4 mt-3">

## `@bpmn-io/feel-analyzer`

**Current job:** Walk the lezer AST and extract **which variables are consumed**, with inferred structural types.

```js
const analyzer = new FeelAnalyzer({ dialect: 'expression' });

analyzer.analyzeExpression(
  'person.name = "John" and scores[1] > 10'
).inputs
// [
//   { name: 'person', type: 'Context',
//     entries: [{ name: 'name' }] },
//   { name: 'scores', type: 'List' }
// ]
```

**Future goal:** also take over **output type inference** from lezer-feel → single parse, one library.

</div>

---
layout: default
---

# Two libraries — orthogonality

<div class="absolute top-0 right-0 text-xs font-mono px-2 py-1 rounded-bl border border-t-0 border-r-0 border-purple-500/40 bg-purple-500/10 text-purple-400/80">feel-analyzer</div>

<div class="mt-6 p-4 rounded-lg bg-teal-500/10 border border-teal-500/30">

| | `lezer-feel` | `feel-analyzer` |
|---|---|---|
| Receives variable context? | **Yes** — context needed for type guessing | **No** — expression string only |
| Currently produces | output type (via ContextTracker hack) | consumed variable names + structural types |
| Used for | `type` field on `ProcessVariable` | `usedBy` / `readFrom` |

</div>

<div class="mt-6 p-3 rounded-lg bg-slate-500/10 border border-slate-500/30 text-sm">

Both are called inside <code>getExpressionDetails(expression)</code> — the single choke-point in <code>feelUtility.js</code>.

```js
function getExpressionDetails(expression) {
  const result    = getResultContext(expression);          // lezer-feel → output type
  const { inputs } = feelAnalyzer.analyzeExpression(expression); // feel-analyzer → consumed vars
  return { unresolved, inputs };
}
```

</div>

---
layout: default
---

# `feel-analyzer` — repo & call site

<div class="absolute top-0 right-0 text-xs font-mono px-2 py-1 rounded-bl border border-t-0 border-r-0 border-purple-500/40 bg-purple-500/10 text-purple-400/80">feel-analyzer</div>

<div class="grid grid-cols-2 gap-6 mt-3 text-sm">

<div class="border border-slate-500/40 bg-slate-500/10 rounded-lg px-4 py-3">

**`feel-analyzer`  structure**
```bash {6}
src/
  feel-analyzer.ts    ← FeelAnalyzer class
  types.ts            ← InputVariable, AnalysisResult, Builtin
  index.ts            ← public exports
  analyzers/
    inputs.ts         ← all the real work
    utils.ts          ← AST helpers 
  utils/.             ← general helpers 
    create-context.ts  ← lezer ContextTracker for builtins
```

</div>

<div class="border border-teal-500/40 bg-teal-500/10 rounded-lg px-4 py-3">

**Single call site in `variable-resolver`**

```js
// feelUtility.js — instantiated once at module level
const feelAnalyzer = new FeelAnalyzer({
  dialect: 'expression',
  parserDialect: 'camunda',
  builtins: camundaBuiltins,
  reservedNameBuiltins: camundaReservedNameBuiltins
});

// called inside getExpressionDetails()
const { inputs } = feelAnalyzer.analyzeExpression(expression);
//       ↓
// buildConsumedVariables()
//       ↓
// variable.usedBy / variable.readFrom
```

Builtins from `@camunda/feel-builtins` ensure native feel functions and Camunda extensions are never reported as consumed variables.

If a function is not specified as a builtin it will be reported as a required input.

</div>

</div>
 
---
layout: default
---

# `inputs.ts` — phases inside [`analyzeForInputs`](vscode://file/Users/simon.steinruecken/git/bpmn-io/feel-analyzer/src/analyzers/inputs.ts:500)

<div class="absolute top-0 right-0 text-xs font-mono px-2 py-1 rounded-bl border border-t-0 border-r-0 border-purple-500/40 bg-purple-500/10 text-purple-400/80">feel-analyzer</div>

`analyzeForInputs(node, source, builtinNames)` is the single export — called once per expression.

<div class="grid grid-cols-3 gap-4 mt-5 text-sm">

<div v-click class="border border-teal-500/40 bg-teal-500/10 rounded-lg px-4 py-3">

**Phase 1 — [`extractInputNames`](vscode://file/Users/simon.steinruecken/git/bpmn-io/feel-analyzer/src/analyzers/inputs.ts:35)**

Single recursive walk; collects external refs into a `Set<string>`.

A name is **skipped** if it is:
- in the `localScopes` stack (context keys, `for`/`some`/`every` vars, function params)
- a known builtin
- `item` inside a filter

</div>

<div v-click="[1, 2]" class="col-span-2 rounded-lg px-4 py-3 border-l-4 border-amber-400/60 bg-slate-800/60 [&.slidev-vclick-hidden]:hidden">

<span class="text-xs font-semibold text-amber-400/70 uppercase tracking-widest">Note — key node overrides</span>

```bash

FunctionInvocation  → function name itself → input
PathExpression      → emit "a.b.c" joined
FilterExpression    → push 'item' + context keys into scope
ForExpression/QuantifiedExpression → push iteration vars into scope for body
FunctionDefinition  → push params into scope for body


```

</div>

<div v-click class="border border-purple-500/40 bg-purple-500/10 rounded-lg px-4 py-3">

**Phase 2 — [`initializeInputVariables`](vscode://file/Users/simon.steinruecken/git/bpmn-io/feel-analyzer/src/analyzers/inputs.ts:197)**

Splits each dotted string on `'.'` and builds the `InputVariable[]` tree for Contexts.

```
"person.name"
```
  ↓
```js
{
  name: 'person',
  entries: [{ name: 'name' }]
}
```

</div>

<div v-click class="border border-blue-500/40 bg-blue-500/10 rounded-lg px-4 py-3">

**Phase 3 — [`inferTypes`](vscode://file/Users/simon.steinruecken/git/bpmn-io/feel-analyzer/src/analyzers/inputs.ts:344)**

Second walk to enrich each variable's `type`:
- `FilterExpression` on a var → `'List'`
- `item.prop` inside filter → list entry
- `PathExpression` root → `'Context'`
- `Comparison` with literal → `'Number'` / `'String'` / `'Boolean'`
- `ArithmeticExpression` — propagates literal type to unknowns

</div>

<div v-click class="col-span-3 border border-slate-500/40 bg-slate-500/10 rounded-lg px-4 py-3">

**Phase 4 — Post-processing**

Entries within each variable are sorted for deterministic output; the top-level array is sorted by name.

Returns `{ inputs: string[], hasErrors: boolean }`

</div>

</div>

---
layout: two-cols-header
---

# [`feelUtility.js`](vscode://file/Users/simon.steinruecken/git/bpmn-io/variable-resolver/lib/zeebe/util/feelUtility.js:1) — expression priority & details

<div class="absolute top-0 right-0 text-xs font-mono px-2 py-1 rounded-bl border border-t-0 border-r-0 border-blue-500/40 bg-blue-500/10 text-blue-400/80">variable-resolver</div>

::left::

<div class="mr-4 mt-3 text-sm border border-blue-500/40 bg-blue-500/10 rounded-lg px-4 py-3">

**[`findExpressions`](vscode://file/Users/simon.steinruecken/git/bpmn-io/variable-resolver/lib/zeebe/util/feelUtility.js:426) — what feeds in**

For each `(variable, origin)` pair, collects candidates in priority order:

| Variable scope | Priority |
|---|---|
| **Local** (scope = origin) | `script` > `input-mapping` |
| **Global** (produced by origin) | `output-mapping` > `script` |

Filters out `null`/`undefined` values — only real expressions proceed.

</div>

::right::

<div class="ml-4 mt-3 text-sm border border-teal-500/40 bg-teal-500/10 rounded-lg px-4 py-3">

**[`getExpressionDetails`](vscode://file/Users/simon.steinruecken/git/bpmn-io/variable-resolver/lib/zeebe/util/feelUtility.js:490) — the choke-point**

Called once per expression. Runs both libraries:

```js
const result = getResultContext(expression);
// lezer-feel → unresolved variable names

const { inputs } = feelAnalyzer.analyzeExpression(expression);
// feel-analyzer → consumed InputVariable[]
```

Static values (no `=`) skip `analyzeExpression` — they produce no inputs.

Returns `{ unresolved, inputs }`.

</div>

---
layout: two-cols-header
---

# [`feelUtility.js`](vscode://file/Users/simon.steinruecken/git/bpmn-io/variable-resolver/lib/zeebe/util/feelUtility.js:1) — analysis & consumed variables

<div class="absolute top-0 right-0 text-xs font-mono px-2 py-1 rounded-bl border border-t-0 border-r-0 border-blue-500/40 bg-blue-500/10 text-blue-400/80">variable-resolver</div>

::left::

<div class="mr-4 mt-3 text-sm border border-purple-500/40 bg-purple-500/10 rounded-lg px-4 py-3">

**[`collectRequirementAnalyses`](vscode://file/Users/simon.steinruecken/git/bpmn-io/variable-resolver/lib/zeebe/util/feelUtility.js:465) — all candidates**

While only the **primary** expression is used for type resolution, **all** candidates are analyzed for consumption tracking.

Reuses the already-computed `primaryExpressionDetails` to avoid double-parsing. Secondary candidates call `getExpressionDetails` once each.

Produces `analysisResults[]` — input for `buildConsumedVariables`.

</div>

::right::

<div class="ml-4 mt-3 text-sm border border-slate-500/40 bg-slate-500/10 rounded-lg px-4 py-3">

**[`buildConsumedVariables`](vscode://file/Users/simon.steinruecken/git/bpmn-io/variable-resolver/lib/zeebe/util/feelUtility.js:1044) — merging & classifying**

Each `InputVariable` in every `analysisResult` is classified as **local** or **global**:

- **Local** — matches an input-mapping target → written to `variable.usedBy` / `variable.readFrom`, no new variable created
- **Global** — not locally provided → new consumed variable, keyed `${name}__${origin.id}`; nested paths (`a.b` + `a.c`) merged into `a: { entries: [b, c] }`

Output-mapping expressions always go into `localUsages` and never produce global consumed entries.

</div>



---
layout: default
---

#  Variable Flow

<div class="absolute top-0 right-0 text-xs font-mono px-2 py-1 rounded-bl border border-t-0 border-r-0 border-blue-500/40 bg-blue-500/10 text-blue-400/80">variable-resolver</div>

<div class="flex flex-col gap-1 mt-3 text-xs">

  <!-- Lane 1 -->
  <div class="border border-blue-500/40 bg-blue-500/10 rounded-lg px-3 py-2">
    <div class="text-[9px] font-bold opacity-50 mb-2 uppercase tracking-widest">① Extract</div>
    <div class="flex items-center gap-2 flex-wrap">
      <div class="border border-blue-400/50 rounded px-2 py-1 text-center">BPMN elements</div>
      <span class="opacity-40">→</span>
      <div class="border border-blue-400/50 rounded px-2 py-1 text-center">extract-process-variables<br/><span class="opacity-60">+ VariableProviders</span></div>
      <span class="opacity-40">→</span>
      <div class="border border-blue-400/50 rounded px-2 py-1 text-center">raw variables<br/><span class="opacity-60">name · scope · origin</span></div>
      <span class="opacity-40">→</span>
      <div class="border border-blue-400/50 rounded px-2 py-1 text-center">extractConsumed<br/>FromElements</div>
    </div>
  </div>

  <div class="text-center opacity-30">↓</div>

  <!-- Lane 2 -->
  <div class="border border-teal-500/40 bg-teal-500/10 rounded-lg px-3 py-2">
    <div class="text-[9px] font-bold opacity-50 mb-2 uppercase tracking-widest">② Resolve — feelUtility.js</div>
    <div class="flex flex-col gap-1">
      <div class="flex items-center gap-2">
        <div class="border border-teal-400/50 rounded px-2 py-1 text-center">parseVariables</div>
        <span class="opacity-40">→</span>
        <div class="border border-teal-400/50 rounded px-2 py-1 text-center">lezer-feel<br/><span class="opacity-60">type inference</span></div>
        <span class="opacity-40">→</span>
        <div class="border border-teal-400/50 rounded px-2 py-1 text-center">resolvedVariables</div>
      </div>
      <div class="flex items-center gap-2">
        <div class="border border-teal-400/50 rounded px-2 py-1 text-center">(extractConsumed)</div>
        <span class="opacity-40">→</span>
        <div class="border border-teal-400/50 rounded px-2 py-1 text-center">feel-analyzer<br/><span class="opacity-60">consumption</span></div>
        <span class="opacity-40">→</span>
        <div class="border border-teal-400/50 rounded px-2 py-1 text-center">consumedVariables<br/><span class="opacity-60">usedBy · readFrom</span></div>
      </div>
    </div>
  </div>

  <div class="text-center opacity-30">↓ both</div>

  <!-- Lane 3 -->
  <div class="border border-purple-500/40 bg-purple-500/10 rounded-lg px-3 py-2">
    <div class="text-[9px] font-bold opacity-50 mb-2 uppercase tracking-widest">③ Output</div>
    <div class="flex items-center gap-2">
      <div class="border border-purple-400/50 rounded px-2 py-1 text-center">expandHierarchicalNames<br/><span class="opacity-60">dot-notation → Context</span></div>
      <span class="opacity-40">→</span>
      <div class="border border-purple-400/50 rounded px-2 py-1 text-center">mergeVariables<br/><span class="opacity-60">dedup · union types</span></div>
      <span class="opacity-40">→</span>
      <div class="border border-purple-400/50 rounded px-2 py-1 text-center font-bold">getVariablesForElement<br/><span class="font-normal opacity-60">scope + read/write flags</span></div>
    </div>
  </div>

</div>
