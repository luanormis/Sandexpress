Exit code: 0
Wall time: 0.8 seconds
Output:
export type VeraMenuItem = {
  code: string;
  name: string;
  category: string;
  description: string | null;
  price: number;
  image: string;
};

const IMAGE_ROOT = "/ready-menu/vera";

function items(category: string, image: string, rows: Array<[string, string, number, string?]>): VeraMenuItem[] {
  return rows.map(([code, name, price, description]) => ({
    code,
    name,
    category,
    description: description || null,
    price,
    image: `${IMAGE_ROOT}/${image}`,
  }));
}

export const VERA_MENU: VeraMenuItem[] = [
  ...items("CafÃ© da manhÃ£", "cafe-da-manha.webp", [
    ["001", "PÃ£o na chapa", 10], ["002", "CafÃ©", 10], ["003", "CafÃ© com leite", 12],
    ["004", "Chocolate quente", 12], ["005", "PÃ£o com ovo", 10], ["006", "Misto quente", 24],
    ["007", "Bauru", 26], ["008", "Salada de frutas", 25, "Com leite condensado ou suco de laranja"],
  ]),
  ...items("PorÃ§Ãµes frias", "saladas-entradas.webp", [
    ["009", "Salame com provolone", 95], ["010", "Salame", 70], ["011", "Provolone", 70],
    ["012", "Salgadinho", 12, "Fandangos ou Cheetos"],
  ]),
  ...items("Entradas", "saladas-entradas.webp", [
    ["013", "Bruschetta", 60, "Acompanha 8 torradas"],
    ["014", "Antepasto de berinjela", 60, "Acompanha 8 torradas"],
    ["015", "Mini sanduÃ­che natural", 50],
  ]),
  ...items("PorÃ§Ãµes quentes", "porcoes-quentes.webp", [
    ["016", "PastÃ©is de carne e queijo", 110, "16 unidades"], ["017", "PastÃ©is especiais", 130, "16 unidades, atÃ© 4 sabores"],
    ["018", "Fritas", 90], ["019", "Polenta", 90], ["020", "Mandioca", 90],
    ["021", "Bolinho de bacalhau", 110, "12 unidades"], ["022", "Fritas maluca", 130, "Com bacon e parmesÃ£o"],
    ["023", "Calabresa acebolada", 130], ["024", "Calabresa com fritas", 160], ["025", "ContrafilÃ© com fritas", 210],
    ["026", "ContrafilÃ© acebolado", 180], ["027", "Frango a passarinho com fritas", 170], ["028", "Isca de frango empanado", 130],
    ["029", "Isca de frango com fritas", 170], ["030", "TilÃ¡pia", 199], ["031", "CaÃ§Ã£o", 170],
    ["032", "Pescada", 170], ["033", "Porquinho", 170], ["034", "Lula Ã  dorÃª", 190],
    ["035", "CamarÃ£o paulista ou empanado", 190], ["036", "Cebola empanada", 90],
  ]),
  ...items("Saladas", "saladas-entradas.webp", [
    ["037", "Salada simples", 25, "Tomate, cebola e alface"],
    ["038", "Salada completa", 70, "Alface, tomate, cebola, pepino e palmito"],
  ]),
  ...items("Pratos", "pratos-executivos.webp", [
    ["039", "ContrafilÃ© Ã  parmegiana", 58, "Arroz e fritas"], ["040", "ContrafilÃ© executivo", 55, "Arroz, feijÃ£o e fritas"],
    ["041", "ContrafilÃ© a cavalo", 55, "ContrafilÃ©, ovo, arroz e feijÃ£o"], ["042", "FilÃ© de frango Ã  parmegiana", 55, "Arroz e fritas"],
    ["043", "FilÃ© de frango com fritas", 50, "Arroz, feijÃ£o e fritas"], ["044", "FilÃ© de frango com purÃª", 50, "Arroz e feijÃ£o"],
    ["045", "FilÃ© de peixe com fritas", 50, "Arroz e feijÃ£o"], ["046", "FilÃ© de peixe com purÃª", 50, "Arroz e feijÃ£o"],
    ["047", "FilÃ© de peixe ao molho de camarÃ£o", 60, "Arroz e legumes na manteiga"],
  ]),
  ...items("PastÃ©is", "pasteis.webp", [
    ["048", "Pastel de alho e Ã³leo", 22, "Mussarela e alho frito"], ["049", "Pastel de bauru", 22, "Mussarela e presunto"],
    ["050", "Pastel de brÃ³colis", 25, "BrÃ³colis, mussarela e alho frito"], ["051", "Pastel de calabresa", 22],
    ["052", "Pastel de calabresa com catupiry", 25], ["053", "Pastel de calabresa com 2 queijos", 28],
    ["054", "Pastel de camarÃ£o", 25], ["055", "Pastel de camarÃ£o com mussarela", 26],
    ["056", "Pastel de camarÃ£o com catupiry", 26], ["057", "Pastel de camarÃ£o com 2 queijos", 28],
    ["058", "Pastel de carne", 22], ["059", "Pastel de carne com ovo", 25], ["060", "Pastel de carne com azeitonas", 25],
    ["061", "Pastel de carne com queijo", 25], ["062", "Pastel de carne com catupiry", 25], ["063", "Pastel de carne com calabresa", 25],
    ["064", "Pastel de carne especial", 28, "Carne, alho, azeitonas, queijo e ovo"], ["065", "Pastel de carne seca", 25],
    ["066", "Pastel de carne seca com mussarela", 26], ["067", "Pastel de carne seca com catupiry", 26],
    ["068", "Pastel de carne seca com 2 queijos", 28], ["069", "Pastel CCC", 28, "Carne, calabresa e catupiry"],
    ["070", "Pastel de chocolate", 22], ["071", "Pastel CQC", 28, "Carne, queijo e calabresa"],
    ["072", "Pastel catupresunto", 25, "Mussarela, catupiry e presunto"], ["073", "Pastel de frango", 22],
    ["074", "Pastel de frango com mussarela", 24], ["075", "Pastel de frango com catupiry", 24],
    ["076", "Pastel de frango com 2 queijos", 26], ["077", "Pastel frangalho", 28, "Frango, mussarela e alho"],
    ["078", "Pastel Kuffer", 28, "Pizza com catupiry"], ["079", "Pastel marguerita", 22],
    ["080", "Pastel de pizza", 22, "Mussarela, tomate e orÃ©gano"], ["081", "Pastel Ã  portuguesa", 28, "Mussarela, presunto, palmito, ovo e azeitonas"],
    ["082", "Pastel de queijo", 22], ["083", "Pastel vegetariano", 28, "Mussarela, brÃ³colis, tomate seco, palmito e alho frito"],
    ["084", "Pastel de 2 queijos", 25, "Mussarela e catupiry"], ["085", "Pastel de 3 queijos", 28, "Mussarela, catupiry e cheddar"],
  ]),
  ...items("Lanches", "lanches-combos.webp", [
    ["086", "Churrasco com queijo e fritas", 38], ["087", "X-Lanche com fritas e salada", 40, "Escolha X-Salada, X-Bacon, X-Egg ou X-Calabresa"],
  ]),
  ...items("Combos", "lanches-combos.webp", [
    ["088", "Combo 01", 230, "Isca de peixe e fritas"], ["089", "Combo 02", 160, "Fritas, polenta e mandioca"],
    ["090", "Combo 03", 280, "Calabresa, frango e fritas"], ["091", "Combo 04", 480, "CamarÃ£o, pescada, lula, fritas e cebola empanada"],
  ]),
];

export const VERA_MENU_TEMPLATE_TAG = "menu-template:vera";


