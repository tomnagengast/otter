export type SelectorAst =
  | { kind: "atom"; method?: string; value: string; ancestors: boolean; descendants: boolean }
  | { kind: "union"; parts: SelectorAst[] }
  | { kind: "intersection"; parts: SelectorAst[] };

export function parseSelector(input: string): SelectorAst {
  const unions = input.split(/\s+/).filter(Boolean);
  const unionParts: SelectorAst[] = unions.map((u) => {
    const ints = u.split(",").filter(Boolean).map(parseAtom);
    if (ints.length === 1) return ints[0] as SelectorAst;
    return { kind: "intersection" as const, parts: ints };
  });
  if (unionParts.length === 1) return unionParts[0] as SelectorAst;
  return { kind: "union", parts: unionParts };
}

function parseAtom(atom: string): SelectorAst {
  let s = atom;
  let ancestors = false;
  let descendants = false;
  if (s.startsWith("+")) {
    ancestors = true;
    s = s.slice(1);
  }
  if (s.endsWith("+")) {
    descendants = true;
    s = s.slice(0, -1);
  }
  const colon = s.indexOf(":");
  if (colon >= 0) {
    return {
      kind: "atom",
      method: s.slice(0, colon),
      value: s.slice(colon + 1),
      ancestors,
      descendants,
    };
  }
  return { kind: "atom", value: s, ancestors, descendants };
}
