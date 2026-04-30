---
layout: default
---

# Hints

<div class="space-y-3 text-sm mt-2">

<div class="p-3 rounded-lg border border-red-500/30 bg-red-500/10">

**Static strings vs FEEL expressions**
Properties like `zeebe:TaskDefinition.type` accept either a plain string `"my-type"` or `= someVar` (`feel:optional)`.
`getExpressionDetails` guards this: no leading `=` → not FEEL → no further details.

</div>

<div class="p-3 rounded-lg border border-red-500/30 bg-red-500/10">

**Circular dependencies**
`resolveReferences` does a best-effort topological sort but does **not** detect cycles.
Circular deps → both variables end up with deps absent from scope → fall back to `type: 'Any'`.

</div>

<div class="p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10">

**`toOptimizedFormat` expects an array**
Variables passed to `getResultContext` must already be in object-keyed form. The conversion from provider array format happens exactly once, at the start of `resolveReferences`. Don't pass raw arrays.

</div>

<div class="p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10">

**`getElementNamesToRemove` cursor semantics**
Used by `getVariablesForElement(element, moddleElement)` to hide "future" mappings while a user edits a specific row in the properties panel. Relies on array index order — sensitive to `inputParameters`/`outputParameters` ordering.

</div>

<div class="p-3 rounded-lg border border-slate-500/30 bg-slate-500/10">

**`collectRequirementAnalyses` may re-parse**
For secondary expression candidates (non-primary), a second lezer parse happens. Max two parses per variable per origin — acceptable but worth knowing when profiling.

</div>

</div>


---
layout: default
---

# Thanks & Good Luck

<div class="mt-6 space-y-2 text-sm">

[github.com/bpmn-io/variable-resolver](https://github.com/bpmn-io/variable-resolver)

[github.com/bpmn-io/feel-analyzer](https://github.com/bpmn-io/feel-analyzer)

[github.com/bpmn-io/lezer-feel](https://github.com/bpmn-io/lezer-feel)

</div>
