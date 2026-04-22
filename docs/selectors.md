# Selectors

`otter build -s <selector>` restricts a build to a subset of models. The selector grammar is
small but expressive.

## Table of Contents

- [Grammar](#grammar)
- [Methods](#methods)
- [Graph Operators](#graph-operators)
- [Composition](#composition)
- [Worked Examples](#worked-examples)

## Grammar

```
selector  := union
union     := intersection (SPACE intersection)*
intersection := atom ("," atom)*
atom      := ["+"] (METHOD ":")? VALUE ["+"]
METHOD    := "tag" | "path" | "config.materialized"
```

- Space-separated terms are **union** (logical OR).
- Comma-separated terms are **intersection** (logical AND).
- A leading `+` adds ancestors; a trailing `+` adds descendants.

## Methods

| Method                    | Matches                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------- |
| _(no method)_             | Exact model id: `dim_users`                                                         |
| `tag:<name>`              | Models whose `config.tags` array includes `<name>`                                  |
| `path:<substring>`        | Models whose file path contains `<substring>`                                       |
| `config.materialized:<m>` | Models whose `config.materialized` equals `<m>` (`view`, `table`, or `incremental`) |

## Graph Operators

| Syntax         | Meaning                                                                   |
| -------------- | ------------------------------------------------------------------------- |
| `model`        | Just the named model                                                      |
| `+model`       | The model **plus every ancestor**                                         |
| `model+`       | The model **plus every descendant**                                       |
| `+model+`      | The model plus ancestors **and** descendants                              |
| `+tag:nightly` | Every `tag:nightly` match plus its ancestors (operator applies per match) |

There is no explicit `@model` operator; use `+model+` for the same effect.

## Composition

- `a b` — union: build `a` and `b` (independently resolved).
- `a,b` — intersection: build models matched by both atoms.
- Mixed: `+dim_users tag:nightly` is a union of two atoms.

## Worked Examples

```bash
# Build just dim_users.
otter build -s dim_users

# Build dim_users and every ancestor it depends on.
otter build -s +dim_users

# Build dim_users and every descendant.
otter build -s dim_users+

# Build all models tagged nightly.
otter build -s tag:nightly

# Build every model whose path contains "staging/".
otter build -s path:staging/

# Only rebuild tables (not views, not incrementals).
otter build -s config.materialized:table

# Ancestors of fct_events AND anything tagged nightly (intersection).
otter build -s +fct_events,tag:nightly

# Ancestors of fct_events OR anything tagged nightly (union).
otter build -s +fct_events tag:nightly
```

Related: [models.md](models.md), [cli.md](cli.md#build).
