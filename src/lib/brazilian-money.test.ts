import { formatBrazilianMoneyInput, maskBrazilianMoneyInput, parseBrazilianMoneyInput } from "./brazilian-money";

describe("Brazilian money input", () => {
  it("formats values with comma and two fixed decimals", () => {
    expect(formatBrazilianMoneyInput(12.5)).toBe("12,50");
    expect(formatBrazilianMoneyInput(1234.56)).toBe("1.234,56");
  });

  it("masks typed digits as cents", () => {
    expect(maskBrazilianMoneyInput("1")).toBe("0,01");
    expect(maskBrazilianMoneyInput("1250")).toBe("12,50");
    expect(maskBrazilianMoneyInput("R$ 1.234,56")).toBe("1.234,56");
  });

  it("parses Brazilian values without floating point residue", () => {
    expect(parseBrazilianMoneyInput("1.234,56")).toBe(1234.56);
    expect(parseBrazilianMoneyInput("0,01")).toBe(0.01);
    expect(parseBrazilianMoneyInput("")).toBeNull();
  });
});
