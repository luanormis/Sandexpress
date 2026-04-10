# Documentação para Etiqueta com QR Code

Layout e especificações para imprimir etiqueta com QR code ao redor de cada guarda-sol.

## 📐 Dimensões Recomendadas

- **Formato**: A4 (210mm x 297mm)
- **Etiquetas por página**: 6-8
- **Tamanho etiqueta**: ~60mm x 100mm
- **QR code**: 45x45mm (sem margem)

## 🎨 Layout (Frente)

```
┌─────────────────────────────────┐
│                                 │
│        SANDEXPRESS             │
│                                 │
│  ┌──────────────────────────┐  │
│  │                          │  │
│  │ [QR CODE 45x45mm]        │  │
│  │                          │  │
│  └──────────────────────────┘  │
│                                 │
│      Mesa / Guarda-Sol         │
│           #42                  │
│                                 │
│   Scan para fazer pedido       │
│                                 │
└─────────────────────────────────┘
```

## 🔗 QR Code Content

Cada QR code deve apontar para:

```
https://sandexpress.app/u/{umbrella_id}

Exemplo:
https://sandexpress.app/u/550e8400-e29b-41d4-a716-446655440000
```

## 📋 Dados no QR (JSON alternativo)

```json
{
  "vendor_id": "550e8400-e29b-41d4-a716-446655440001",
  "umbrella_number": 42,
  "qr_url": "https://sandexpress.app/u/550e8400-e29b-41d4-a716-446655440000",
  "location": "Área Externa - Primeira Fileira",
  "created_at": "2026-04-10T10:30:00Z"
}
```

## 🖨️ Formato para Impressão

### Opção 1: Canva (Designer Online)
1. Acesse [canva.com](https://canva.com)
2. Criar design → "Label" ou tamanho customizado
3. Adicionar:
   - Logo SandExpress (já envie)
   - QR code (gerar em [qr-server.com](https://qr-server.com))
   - Número da mesa
   - Instruções
4. Exportar PDF → Imprimir

### Opção 2: Google Docs
1. Inserir → Tabela (3x2 ou 4x2)
2. Em cada célula:
   - Inserir imagem (QR code)
   - Adicionar numero e texto
3. Imprimir

### Opção 3: Programático (Node.js)

```bash
npm install qrcode
```

```typescript
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import fs from 'fs';

async function generateUmbrellasLabels(umbrellas) {
  const doc = new PDFDocument({ size: 'A4', margin: 20 });
  const stream = fs.createWriteStream('labels.pdf');
  doc.pipe(stream);

  let y = 20;
  for (const umbrella of umbrellas) {
    // Gerar QR
    const qrImage = await QRCode.toDataURL(umbrella.qr_url, {
      width: 200,
      margin: 0,
    });

    // Adicionar ao PDF
    doc.fontSize(14).text('SANDEXPRESS', 50, y);
    doc.image(qrImage, 80, y + 30, { width: 100 });
    doc.fontSize(16).text(`Mesa ${umbrella.number}`, 50, y + 150);
    doc.fontSize(10).text('Scan para fazer pedido', 50, y + 180);

    y += 220;
    if (y > 600) {
      doc.addPage();
      y = 20;
    }
  }

  doc.end();
}
```

## 🏷️ Materiais Recomendados

| Item | Especificação |
|------|---|
| Papel | Papel couche 150g ou etiqueta adhesiva |
| Cor | Colorido (RGB) |
| Proteção | Laminação fosca (opcional, +durável) |
| Adesivo | Permanente ou temporário |
| Tamanho | A4 ou A5 (cortado em 6-8 peças) |

## 📦 Impressão Comercial

**Gráfica recomendada**: Solicite:
- **Tipo**: Etiqueta com QR code
- **Formato**: A4 / 6 etiquetas por folha
- **Quantidade**: 120 etiquetas (1 bloco por quiosque)
- **Acabamento**: Corte e furação (se pendurar)

Orçamento estimado: R$ 50-150 por quiosque

## ✅ Script para Gerar URLs

```sql
-- Gerar URLs dos QR codes para impressão
SELECT 
  u.number,
  u.id,
  'https://sandexpress.app/u/' || u.id as qr_url,
  'https://qr-server.com/api/qr?url=' || 'https%3A%2F%2Fsandexpress.app%2Fu%2F' || u.id as qr_image_url
FROM umbrellas u
WHERE u.vendor_id = '550e8400-e29b-41d4-a716-446655440001'
ORDER BY u.number;
```

## 🔄 Próximo Passo

- [ ] Enviar logo SandExpress
- [ ] Definir cores do quiosque
- [ ] Gerar QR codes
- [ ] Enviar para gráfica
- [ ] Instalar etiquetas nos guarda-sóis
