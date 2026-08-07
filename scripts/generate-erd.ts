import { readFileSync, writeFileSync } from "node:fs";

/// Genera el diagrama entidad-relación a partir de `schema.prisma`.
///
/// Se emite como Mermaid dentro de un Markdown en vez de una imagen: GitHub lo
/// renderiza nativamente, se lee en el navegador sin abrir nada, y el diff
/// muestra qué cambió del modelo en cada commit. Una imagen generada sería
/// opaca en la revisión y se desincronizaría en silencio.
///
/// Correr con: npm run docs:erd

type Field = { name: string; type: string; attrs: string };
type Model = { name: string; table: string; fields: Field[]; doc: string };
type Relation = { from: string; to: string; label: string; many: boolean; optional: boolean };

const schema = readFileSync("prisma/schema.prisma", "utf8");

const models: Model[] = [];
const enums = new Map<string, string[]>();
const foreignKeysByModel = new Map<string, Set<string>>();

for (const match of schema.matchAll(/enum\s+(\w+)\s*\{([^}]*)\}/g)) {
  const values = match[2]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("//"));
  enums.set(match[1], values);
}

for (const match of schema.matchAll(/(\/\/\/[^\n]*\n)*model\s+(\w+)\s*\{([^}]*)\}/g)) {
  const [, , name, body] = match;

  // El comentario `///` inmediatamente anterior describe la entidad.
  const before = schema.slice(0, match.index ?? 0);
  const docLines: string[] = [];
  for (const line of before.split("\n").reverse()) {
    const trimmed = line.trim();
    if (trimmed.startsWith("///")) docLines.unshift(trimmed.replace(/^\/\/\/\s?/, ""));
    else if (trimmed === "" && docLines.length === 0) continue;
    else break;
  }

  const table = body.match(/@@map\("([^"]+)"\)/)?.[1] ?? name.toLowerCase();
  const fields: Field[] = [];

  // Solo son llaves foráneas las columnas que alguna relación declara como tal.
  const foreignKeys = new Set<string>();
  for (const rel of body.matchAll(/@relation\([^)]*fields:\s*\[([^\]]+)\]/g)) {
    for (const column of rel[1].split(",")) foreignKeys.add(column.trim());
  }
  foreignKeysByModel.set(name, foreignKeys);

  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("@@")) continue;

    const parts = trimmed.split(/\s+/);
    const [fieldName, fieldType, ...rest] = parts;
    if (!fieldType) continue;

    fields.push({ name: fieldName, type: fieldType, attrs: rest.join(" ") });
  }

  models.push({ name, table, fields, doc: docLines.join(" ") });
}

const modelNames = new Set(models.map((model) => model.name));
const relations: Relation[] = [];
const seen = new Set<string>();

for (const model of models) {
  for (const field of model.fields) {
    const base = field.type.replace(/[[\]?]/g, "");
    if (!modelNames.has(base)) continue;

    const many = field.type.endsWith("[]");
    const optional = field.type.endsWith("?");
    // Solo se dibuja el lado que declara la llave foránea, para no duplicar.
    if (many) continue;

    const key = `${model.name}->${base}:${field.name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    relations.push({ from: base, to: model.name, label: field.name, many: true, optional });
  }
}

function mermaidType(type: string): string {
  return type.replace(/[[\]?]/g, "").replace(/\W/g, "_");
}

const lines: string[] = [];
lines.push("# Modelo de datos");
lines.push("");
lines.push(
  "> Generado desde `prisma/schema.prisma` con `npm run docs:erd`. No editar a mano.",
);
lines.push("");
lines.push(
  "Multi-tenancy row-level: `Organization` es el límite de aislamiento principal " +
    "y `Hotel` el segundo. Casi toda entidad operativa lleva `hotelId` para que el " +
    "scoping sea un filtro directo y no una inferencia por relaciones.",
);
lines.push("");
lines.push("## Diagrama");
lines.push("");
lines.push("```mermaid");
lines.push("erDiagram");

for (const model of models) {
  lines.push(`    ${model.name} {`);
  for (const field of model.fields) {
    const base = field.type.replace(/[[\]?]/g, "");
    // Las relaciones se dibujan como aristas, no como columnas.
    if (modelNames.has(base)) continue;
    const flags: string[] = [];
    if (field.attrs.includes("@id")) flags.push("PK");
    else if (foreignKeysByModel.get(model.name)?.has(field.name)) flags.push("FK");
    if (field.attrs.includes("@unique")) flags.push("UK");
    lines.push(
      `        ${mermaidType(field.type)} ${field.name}${flags.length ? ` ${flags.join(",")}` : ""}`,
    );
  }
  lines.push("    }");
}

for (const relation of relations) {
  const cardinality = relation.optional ? "||--o{" : "||--|{";
  lines.push(`    ${relation.from} ${cardinality} ${relation.to} : "${relation.label}"`);
}

lines.push("```");
lines.push("");

lines.push("## Entidades");
lines.push("");
lines.push("| Modelo | Tabla | Para qué existe |");
lines.push("|---|---|---|");
for (const model of models) {
  lines.push(`| \`${model.name}\` | \`${model.table}\` | ${model.doc || "—"} |`);
}
lines.push("");

lines.push("## Enums");
lines.push("");
lines.push(
  "Todos los enums usan códigos neutrales en inglés. La traducción vive solo en " +
    "los archivos de mensajes de next-intl: agregar un idioma nunca obliga a " +
    "traducir lo ya almacenado.",
);
lines.push("");
lines.push("| Enum | Valores |");
lines.push("|---|---|");
for (const [name, values] of enums) {
  lines.push(`| \`${name}\` | ${values.map((v) => `\`${v}\``).join(", ")} |`);
}
lines.push("");

writeFileSync("docs/modelo-de-datos.md", lines.join("\n"));
console.log(
  `docs/modelo-de-datos.md generado: ${models.length} modelos, ${enums.size} enums, ${relations.length} relaciones`,
);
