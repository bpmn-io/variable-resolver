# Variable Resolver Performance Results

## Baseline (no optimizations)

| Benchmark | Duration (ms) | What it stresses |
|---|---|---|
| parseVariables 500 + 50% dupes | 4.4 | _parseVariables duplicate merging |
| parseVariables 2000 + 50% dupes | 50.4 | _parseVariables duplicate merging |
| parseVariables 5000 + 50% dupes | 326.9 | _parseVariables duplicate merging |
| scopeFilter nested 500 | 8.0 | getVariablesForElement parent lookup |
| scopeFilter nested 2000 | 33.3 | getVariablesForElement parent lookup |
| scopeFilter nested 5000 | 107.9 | getVariablesForElement parent lookup |
| extractor 50 providers sync | 1.3 | _extractor Promise overhead |
| extractor 200 providers sync | 11.4 | _extractor Promise overhead |
| FEEL nested IO mappings | 12.0 | filterForScope + resolveReferences |
| repeated 10x 2000 vars | 120.9 (avg 12.1) | full pipeline |

## Optimization 1: Map for O(1) duplicate lookup in _parseVariables

Replaces `mergedVariables.find()` O(n) linear scan with Map keyed by `name\0scope.id`.

| Benchmark | Before (ms) | After (ms) | Speedup |
|---|---|---|---|
| parseVariables 500 + 50% dupes | 4.4 | 1.3 | 3.4x |
| parseVariables 2000 + 50% dupes | 50.4 | 3.1 | 16.3x |
| parseVariables 5000 + 50% dupes | 326.9 | 9.4 | **34.8x** |
| scopeFilter nested 500 | 8.0 | 7.5 | ~1x |
| scopeFilter nested 2000 | 33.3 | 20.8 | 1.6x |
| scopeFilter nested 5000 | 107.9 | 53.8 | 2.0x |
| extractor 50 providers sync | 1.3 | 0.5 | 2.6x |
| extractor 200 providers sync | 11.4 | 1.6 | 7.1x |
| FEEL nested IO mappings | 12.0 | 9.4 | 1.3x |
| repeated 10x 2000 vars | 120.9 | 11.0 | **11.0x** |

## Optimization 2: Set + single-pass for scope filtering in getVariablesForElement

Replaces two-pass `filter()` with a single loop. Replaces `parents.find()` O(m) per variable
with `parentIds.has()` O(1) using a Set of parent IDs.

| Benchmark | Before (ms) | After (ms) | Speedup |
|---|---|---|---|
| scopeFilter nested 500 | 7.5 | 5.7 | 1.3x |
| scopeFilter nested 2000 | 20.8 | 19.8 | ~1x |
| scopeFilter nested 5000 | 53.8 | 48.8 | 1.1x |
| FEEL nested IO mappings | 9.4 | 8.9 | ~1x |
| repeated 10x 2000 vars | 11.0 | 10.0 | 1.1x |

## Optimization 3: Set for scope lookups in FEEL resolution (filterForScope + resolveReferences)

Replaces `validScopes.find()` with `validScopeIds.has()` in filterForScope.
Replaces `variablesToResolve.find()` with Set.has() in resolveReferences.

| Benchmark | Before (ms) | After (ms) | Speedup |
|---|---|---|---|
| scopeFilter nested 500 | 5.7 | 6.1 | ~1x |
| scopeFilter nested 2000 | 19.8 | 18.7 | 1.1x |
| scopeFilter nested 5000 | 48.8 | 44.5 | 1.1x |
| FEEL nested IO mappings | 8.9 | 8.9 | ~1x |
| repeated 10x 2000 vars | 10.0 | 9.0 | 1.1x |

## Optimization 4: Skip Promise creation for synchronous providers in _extractor

Avoids creating a Promise per (element, provider) pair when getVariables returns
synchronously. Only awaits Promise.all when async providers are present.

| Benchmark | Before (ms) | After (ms) | Speedup |
|---|---|---|---|
| extractor 50 providers sync | 0.6 | 0.6 | ~1x |
| extractor 200 providers sync | 1.7 | 1.6 | ~1x |
| repeated 10x 2000 vars | 9.0 | 8.9 | ~1x |

Note: The extractor benchmarks already show dramatic improvement from baseline
(11.4 → 1.6ms) due to reduced _parseVariables overhead in opt 1. The sync
fast-path itself reduces microtask scheduling overhead which mainly shows
with many elements × many providers in real diagrams.
