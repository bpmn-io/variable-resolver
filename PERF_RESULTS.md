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
