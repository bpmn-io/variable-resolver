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
