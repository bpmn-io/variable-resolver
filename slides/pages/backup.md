
---
layout: default
---

# Caching

```js
class BaseVariableResolver {
  rawVariables:    CachedValue  // ← _generateRawVariables()
  parsedVariables: CachedValue  // ← fires parseVariables event
}
```

Both are invalidated on:

| Event | Trigger |
|-------|---------|
| `commandStack.changed` | any modeler edit |
| `diagram.clear` / `import.done` | new diagram loaded |
| `variables.changed` | manual invalidation from a provider |

`CachedValue` is intentionally minimal — a lazy wrapper that calls the generator exactly once until invalidated. The generator returns a `Promise`; callers always `await`.

<div class="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-sm">

External providers that load async data (API calls, file reads) should call `variableResolver.invalidateCache()` after their data arrives.

</div>

---
layout: default
---

# Extension points — `VariableProvider`

```js
import { VariableProvider } from '@bpmn-io/variable-resolver';

class MyProvider extends VariableProvider {
  getVariables(element) {
    if (is(element, 'bpmn:Process')) {
      return [
        { name: 'initiatorId', type: 'String', info: 'Set by engine on start' },
        { name: 'businessKey', type: 'String' }
      ];
    }
  }
}

MyProvider.$inject = [ 'variableResolver' ];

// Register via bpmn-js module:
export default { myProvider: [ 'type', MyProvider ] }
```

`VariableProvider.register()` calls `variableResolver.registerProvider(this)`.

`BaseVariableResolver._extractor()` iterates all registered providers and merges their output into the raw variables map before any FEEL parsing.



---
layout: default
---

# `ConnectorVariableProvider`

Special provider that understands Connector result variables from `zeebe:TaskHeaders`:

```js
// Connector headers:
// resultVariable = "connResult"
// resultExpression = "= { id: result.id, name: result.name }"

// resultVariable → adds { name: 'connResult' }  (untyped)

// resultExpression → runs getResultContext() on the expression
//   → extracts the top-level entries of the resulting Context
//   → adds { name: 'id' }, { name: 'name' }, etc.
```

Registered as `connectorVariableProvider` in `ZeebeVariableResolverModule`.

<div class="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm">

⚠️ **Known limitation:** This mirrors `ConnectorMappings` behavior but cannot be fully correct without engine runtime knowledge of which headers are actually active.
There's a TODO in the code to replace this with proper engine behavior eventually.

</div>