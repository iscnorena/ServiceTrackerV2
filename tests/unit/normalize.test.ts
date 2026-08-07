import { describe, expect, it } from "vitest";
import { generateQrSlug, normalizeSupplyName } from "@/lib/normalize";

describe("normalizeSupplyName", () => {
  it("une variantes de captura: mayúsculas, acentos y espacios de más", () => {
    // Es exactamente lo que hace útil el reporte corporativo cruzado: cada hotel
    // teclea el mismo insumo a su manera.
    const variants = ["Pilas AA", "PILAS AA", "pilas  aa", "  Pilas AA  "];
    const normalized = new Set(variants.map(normalizeSupplyName));
    expect(normalized.size).toBe(1);
    expect([...normalized][0]).toBe("pilas aa");
  });

  it("quita acentos", () => {
    expect(normalizeSupplyName("Foco Baño")).toBe(normalizeSupplyName("foco bano"));
    expect(normalizeSupplyName("Batería")).toBe("bateria");
  });

  it("NO une sinónimos distintos, y eso es esperado", () => {
    // La agrupación es una aproximación por texto, no semántica. El reporte lo
    // advierte en pantalla justamente por este caso (sección 4.5).
    expect(normalizeSupplyName("Toallas de baño")).not.toBe(
      normalizeSupplyName("Toallas grandes"),
    );
    expect(normalizeSupplyName("Pilas AA")).not.toBe(normalizeSupplyName("Baterías AA"));
  });
});

describe("generateQrSlug", () => {
  it("respeta la longitud pedida", () => {
    expect(generateQrSlug()).toHaveLength(10);
    expect(generateQrSlug(6)).toHaveLength(6);
  });

  it("evita caracteres ambiguos al teclear desde el PDF impreso", () => {
    // Sin 0/O ni 1/l/I: la URL se imprime debajo del QR como respaldo y alguien
    // la va a escribir a mano desde el celular.
    const sample = Array.from({ length: 200 }, () => generateQrSlug()).join("");
    expect(sample).not.toMatch(/[01loi]/);
  });

  it("no repite slugs en un lote razonable", () => {
    const slugs = new Set(Array.from({ length: 1000 }, () => generateQrSlug()));
    expect(slugs.size).toBe(1000);
  });
});
