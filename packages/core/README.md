# @otter/core

Shared interfaces, config loader, SQL/ref/source recording context, DAG builder and topo-sorter,
compile pipeline, DAG runner, node selectors, and state store. All other packages depend on this
one; it has no runtime deps.

## Key exports

```ts
// Config
defineConfig(config: Config): Config
loadConfig(cwd: string): Promise<Config>

// Model authoring
sql`...`                         // tagged template → SqlFragment
ref(name: string): string        // records DAG edge; returns quoted identifier
source(src: string, stream: string): string  // records source dep; returns raw table name

// Compile + manifest
compileProject(config, cwd): Promise<Manifest>
writeManifest(path, manifest): Promise<void>
readManifest(path): Promise<Manifest>

// DAG
buildDag(nodes: DagNode[]): Dag
toposort(dag: Dag): string[]

// Runner
runBuild(opts: RunBuildOpts): Promise<{ results: RunResults; emitter: OtterEmitter }>

// Selectors
parseSelector(input: string): SelectorAst
evaluateSelector(ast: SelectorAst, dag: Dag): Set<string>

// Events
class OtterEmitter extends EventTarget
jsonlAppender(path, emitter): () => Promise<void>

// Source / adapter resolution (dynamic import)
resolveSource(kind: string): Promise<{ createSource }>
resolveAdapter(kind: string): Promise<{ createAdapter }>

// State (bun:sqlite cursor store for API sources)
openState(path: string): StateStore
```
