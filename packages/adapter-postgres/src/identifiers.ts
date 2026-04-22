export function quote(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export function qualify(ref: { schema: string; name: string }): string {
  return `${quote(ref.schema)}.${quote(ref.name)}`;
}
