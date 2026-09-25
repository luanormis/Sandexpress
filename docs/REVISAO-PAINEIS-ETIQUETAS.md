# Painéis, conta por pessoa e etiquetas

As rotas de cliente, quiosque, garçom, administração e proprietário usam fundo creme, ações laranja e texto escuro. A página pública inicial mantém seu tema. A personalização do quiosque altera somente o fundo da experiência do cliente; o formulário não altera taxas de pagamento nem a logo.

## Conta por pessoa

A abertura por QR e a abertura manual registram `party_size` na comanda. Caixa e garçom carregam a quantidade cadastrada e sugerem uma cota sobre o total original, limitada ao saldo restante. Cada recebimento registra nome, forma de pagamento e valor. A liberação do guarda-sol continua condicionada à quitação total. O cliente pode solicitar pagamento separado; a equipe confirma o recebimento.

O banco conectado possui `customers.party_size`, mas ainda não possui `orders.party_size`. Antes de publicar, aplicar `infra/20260925-account-party-size.sql`. Ela acrescenta o campo, preenche comandas abertas com a quantidade cadastrada no cliente e preserva os valores financeiros. Não cria novas tabelas nem altera permissões. As credenciais locais permitem acesso à API de dados; a aplicação da migração exige acesso ao editor SQL ou conexão PostgreSQL.

## Etiquetas

Modelo recomendado: **Pimaco A4250**, 99 × 55,8 mm, 10 etiquetas por folha A4 (2 colunas × 5 linhas). A4350 tem as mesmas dimensões e mais folhas por embalagem.

Frase: **Faça seu pedido aqui**, acima do QR. QR de 34 mm, com margem branca de quatro módulos, identificação do guarda-sol e nome do quiosque. A folha usa margem superior de 9 mm, esquerda de 4,7 mm e passo horizontal de 101,6 mm (etiqueta de 99 mm + intervalo de 2,6 mm).

Imprimir em A4, escala 100% / tamanho real, sem cabeçalho nem rodapé do navegador. Conferir primeiro em papel comum, sobrepondo à folha de etiquetas para verificar o alinhamento da impressora. O download individual também contém a frase e as dimensões da etiqueta.

Fontes: https://www.pimaco.com.br/produto/Etiqueta-inkjet-laser-A4250-com-25-folhas-Pimaco/09773 e tabela de parâmetros Pimaco em https://tagplus-downloads.s3.amazonaws.com/ajuda/Parametros_de_impressao_modelos_etiqueta_pimaco.pdf (o passo horizontal inclui o intervalo).
