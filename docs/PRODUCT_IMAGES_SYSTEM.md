# 🖼️ Sistema de Imagens de Produtos Premium

## Visão Geral

SandExpress agora oferece um sistema robusto de gerenciamento de imagens de produtos com:

- **Galera Padrão Gratuita**: Biblioteca de imagens de alta qualidade disponível para todos os vendors (plano Free)
- **Imagens Personalizadas Premium**: Vendors no Plano Plus podem fazer upload de fotos exclusivas de seus produtos
- **Gerenciamento Inteligente**: Interface intuitiva para selecionar ou fazer upload de imagens

## Arquitetura

### Banco de Dados

#### Tabela `product_images`
Galeria padrão de imagens categorizada:
```sql
- id: UUID (chave primária)
- category: string (Bebidas, Petiscos, Pratos Principais, Sobremesas, Combos)
- title: string (nome da imagem)
- image_url: string (URL da imagem)
- description: string (descrição opcional)
- plan_type: 'free' | 'plus' (qual plano pode usar)
- created_at: timestamp
```

**Índices:**
- `product_images_category_idx` em `category`
- `product_images_plan_type_idx` em `plan_type`

#### Tabela `vendor_plans`
Configuração de planos e quotas por vendor:
```sql
- id: UUID (chave primária)
- vendor_id: UUID (FK para vendors)
- plan_type: 'free' | 'plus'
- can_upload_images: boolean
- max_custom_images: number
- custom_images_used: number
- custom_theme: string (JSON para customização futura)
- created_at: timestamp
- updated_at: timestamp
```

**Índices:**
- `vendor_plans_vendor_id_idx` em `vendor_id`

#### Atualizações na Tabela `products`
```sql
- is_default_image: boolean (true = usando imagem da galeria padrão)
- image_plan_type: 'free' | 'plus' (qual plano exigido para esta imagem)
```

### Componentes Frontend

#### `ProductImageManager.tsx`
Seletor de imagens dentro de cada produto:
- Lista imagens padrão (Free)
- Botão de upload para Plus
- Confirmação visual da imagem selecionada
- Contador de uso do plano Plus

Props:
```typescript
interface ProductImageManagerProps {
  product: Product;
  onImageSelected: (imageUrl: string) => void;
  isPlusUser: boolean;
}
```

#### `VendorProductsPage.tsx` (`/vendor/products`)
Dashboard de gerenciamento de produtos do vendor:
- Lista todos os produtos do vendor
- Faz upload de nova imagem (se Plus)
- Mostra status do plano atual
- Exibe quota de imagens personalizadas usadas

#### `VendorPlanPage.tsx` (`/vendor/plans`)
Gepage de visualização e upgrade de planos:
- Mostra Plano Free atual
- Oferece upgrade para Plus (R$ 29/mês)
- Exibe quota de imagens personalizadas
- Mostra progresso de uso

### API Endpoints

#### `GET /api/products/gallery`
Retorna galeria de imagens disponíveis.

**Parâmetros Query:**
- `category` (opcional): Filtrar por categoria
- `planType` (default: 'free'): 'free' ou 'plus'

**Resposta:**
```json
{
  "success": true,
  "data": {
    "images": [...],
    "byCategory": {
      "Bebidas": [...],
      "Petiscos": [...]
    },
    "total": 35
  }
}
```

#### `POST /api/products/[id]/upload-image`
Faz upload de imagem personalizada para um produto (Plus only).

**Headers:**
- `Authorization: Bearer <token>`

**Body (FormData):**
- `file`: File (a imagem)
- `vendorId`: string (UUID do vendor)

**Resposta:**
```json
{
  "success": true,
  "imageUrl": "https://...",
  "remainingUploads": 47
}
```

**Erros:**
- `400`: File/vendorId/auth missing
- `403`: Plano não é Plus ou quota excedida
- `404`: Plano não encontrado
- `500`: Erro de upload

### Fluxo de Uso

#### Para Vendors Free
1. Acessa `/vendor/products`
2. Clica em "Editar Imagem" em um produto
3. ProductImageManager mostra apenas imagens da galeria Free
4. Seleciona uma imagem da galeria
5. Imagem é atualizada com `is_default_image=true` e `image_plan_type='free'`

#### Para Vendors Plus
1. Acessa `/vendor/products`
2. Clica em "Editar Imagem" em um produto
3. ProductImageManager mostra:
   - Imagens da galeria Free
   - Imagens da galeria Plus
   - Botão de upload para imagens personalizadas
4. Pode fazer upload de foto exclusiva
5. Sistema verifica quota e atualiza contador

#### Para Fazer Upgrade
1. Acessa `/vendor/plans`
2. Vê comparação Free vs Plus
3. Clica "Fazer Upgrade Agora"
4. Sistema atualiza `vendor_plans.plan_type = 'plus'`
5. Ativa `can_upload_images = true`
6. Define `max_custom_images = 100`

## Dados Seed

### Categorias de Imagens
- **Bebidas**: 7 imagens (5 Free, 2 Plus)
- **Petiscos**: 7 imagens (5 Free, 2 Plus)
- **Pratos Principais**: 7 imagens (5 Free, 2 Plus)
- **Sobremesas**: 7 imagens (5 Free, 2 Plus)
- **Combos**: 5 imagens (3 Free, 2 Plus)

**Total**: 33 imagens padrão

Execute:
```bash
psql -U <usuario> -d <database> -f infra/seed-product-images.sql
```

## Configuração de Quota

| Plano | Imagens Personalizadas | Pode Fazer Upload |
|-------|----------------------|-------------------|
| Free  | 0                    | Não               |
| Plus  | 100                  | Sim               |

Quartas podem ser ajustadas na tabela `vendor_plans`.

## Lógica de Seleção de Imagem

Para cada produto, o sistema prioriza:
1. **Imagem Personalizada (Plus)** - se `image_plan_type='plus'` e vendor é Plus
2. **Imagem Padrão Gratuita** - se `image_plan_type='free'` ou `is_default_image=true`
3. **Imagem Padrão de Categoria** - Fallback automático

## Segurança

- Uploads são validados contra quota do vendor no endpoint
- Apenas vendors Plus podem fazer upload
- Imagens são armazenadas em pasta segregada por vendor
- Arquivo `database.types.ts` atualizado com tipos corretos

## Próximas Melhorias

- [ ] Editor de imagem (crop, filter) no frontend
- [ ] Análise de uso de quota em dashboard
- [ ] Exportação de relatório de imagens por categoria
- [ ] Integração com payment para automatizar upgrade do Plus
- [ ] Sincronização de imagens entre múltiplos produtos
- [ ] Analytics de cliques em produtos por tipo de imagem
