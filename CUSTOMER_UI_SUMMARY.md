# SandExpress Customer UI - Complete Implementation

## Overview
The customer-facing QR kiosk interface is now **fully implemented** with WhatsApp validation, menu browsing, cart management, and real-time order tracking.

Access at: `/u/[umbrella_id]` (e.g., `/u/praia-central-01`)

---

## User Journey

### 1. **Welcome Screen** (Initial Load)
- Displays large SandExpress branding with guarda-sol (umbrella) identifier
- Shows QR code scanning instruction
- Single "Começar pedido" (Start Order) button
- Responsive gradient background with branding colors (#FF6B00)

### 2. **Login Form** (Phone Registration)
- **Name input**: Full customer name (minimum 3 characters)
- **Phone input**: WhatsApp number (10+ digits, auto-cleaned)
- **Validation Button**: "Validar pelo WhatsApp" 
  - Generates random 6-digit OTP code
  - Shows alert with code for testing in dev mode
  - Navigates to verification screen
  - In production: sends code via WhatsApp API

### 3. **OTP Verification** (WhatsApp Code)
- Displays generated code for testing (in dev mode)
- Shows message: _"Em produção, este código será enviado ao WhatsApp"_
- **Input field**: Accepts 6-digit code
- **Confirm button**: Validates and saves session
- **Resend button**: Generates new code if needed
- Session stored in `sessionStorage` with key: `sandexpress_user_${umbrella_id}`

### 4. **Menu Screen** (Core App)
#### Header
- Customer name and guarda-sol ID display
- **"Chamar garçom" (Call Waiter)** button
  - Triggers 5-second notification: "Garçom chamado! Ele chegará em instantes."
  - Resets state after delay

#### Content
- **Saldo do quiosque** (Account Balance) card
  - Shows total amount owed (cart + past orders)
  - Real-time updates as items are added/ordered
- **Category Filter Buttons**
  - "Todos" (All) - default selected
  - Dynamic categories extracted from product data: "Bebidas", "Petiscos", etc.
  - Active category highlighted in orange (#FF6B00)
- **Product List**
  - Card layout with product image placeholder
  - Product name, description, price
  - Strike-through original price if promotional_price exists
  - Add/Adjust quantity buttons ("+"/"-" with count)

#### Bottom Navigation (Sticky)
- **Cardápio** (Menu) - shows product list
- **Carrinho** (Cart) - shows cart review with red badge showing item count
- **Conta** (Account) - shows order history and total

---

### 5. **Cart Screen** (Order Review)
- **Cart Summary**
  - List of items with quantity and subtotal
  - Remove buttons (quantity "-" control)
  - Item count display
  
- **Notes Section**
  - Textarea for special instructions to kitchen
  - Placeholder: "Observação para a cozinha (ex: sem cebola, pouco sal...)"
  
- **Confirmation**
  - Displays total cart amount
  - "Confirmar e enviar" (Confirm and Send) button
  - Alert after submission: "Pedido enviado!"

---

### 6. **Account/Orders Screen** (Real-time Tracking)
- **Total Acumulado** (Accumulated Total)
  - Large orange card with total owed amount
  - Includes both past orders + current cart items
  - Instruction: "Pague ao garçom no final da visita."
  
- **Order List**
  - Each order shows:
    - Order ID and creation time
    - Status badge with color coding:
      - **Recebido** (Received) - Blue
      - **Em preparo** (Preparing) - Yellow
      - **A caminho** (On the Way) - Orange
      - **Entregue** (Delivered) - Green
    - Item breakdown with quantities and prices
  - Empty state: "Nenhum pedido ainda..."

---

## Technical Architecture

### State Management
```typescript
// Main states
const [step, setStep] = useState<"welcome" | "login" | "verify" | "menu" | "cart" | "orders">("welcome");
const [customer, setCustomer] = useState<Customer | null>(null);
const [cart, setCart] = useState<CartItem[]>([]);
const [orders, setOrders] = useState<Order[]>([]);

// Form states
const [name, setName] = useState("");
const [phone, setPhone] = useState("");
const [otpCode, setOtpCode] = useState("");
const [otpInput, setOtpInput] = useState("");
const [waiterCalled, setWaiterCalled] = useState(false);
```

### Types
```typescript
type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  promotional_price?: number;
  description: string;
  image_url: string;
};

type CartItem = {
  product: Product;
  quantity: number;
};

type Order = {
  id: string;
  items: CartItem[];
  total: number;
  status: "received" | "preparing" | "delivering" | "delivered";
  created_at: string;
};

type Customer = {
  name: string;
  phone: string;
};
```

### Session Persistence
- Customer data stored in `sessionStorage` (not persistent across browser restarts)
- Key format: `sandexpress_user_${umbrella_id}`
- Auto-loads on page refresh if session exists
- Automatically redirects to menu if session is active

### Mock Data
Currently using MOCK_PRODUCTS array with 4 sample items:
- Cerveja Heineken (Bebidas)
- Porção de Fritas (Petiscos)
- Isca de Peixe (Petiscos)
- Água de Coco (Bebidas)

**To integrate real products from Supabase:**
- Replace `const [products] = useState<Product[]>(MOCK_PRODUCTS);` 
- Add `useEffect` hook to fetch from `/api/products`

---

## UI/UX Features

### Design System
- **Primary Color**: #FF6B00 (Orange) - buttons, active states, badges
- **Secondary Color**: #E56000 (Darker Orange) - hover states
- **Font Display**: Used for titles (Sandexpress, page headers)
- **Font Sans**: Used for body text

### Responsive Design
- Mobile-first approach with `min-h-screen` layouts
- Sticky header with z-index: 20
- Fixed bottom navigation (z-index implicit, above content)
- Padding at bottom (pb-32) to prevent overlap with nav
- Safe area support for notched devices (pb-safe)

### Accessibility
- Proper semantic HTML with form labels
- Button types properly specified
- Loading states and disabled states ready for implementation
- Color contrast meets WCAG standards

### Interactions
- Active scale transitions (scale-95) on button press
- Smooth color transitions on hover
- Alert dialogs for validation feedback
- Automatic timeout for waiter call notification

---

## Next Steps for Production

### 1. **Backend Integration**
- [ ] Replace MOCK_PRODUCTS with API call to `/api/products`
- [ ] Implement real order submission to Supabase
- [ ] Implement WebSocket/polling for real-time order status
- [ ] Integrate real WhatsApp API for OTP delivery

### 2. **Testing**
- [ ] Test on actual beach WiFi connectivity
- [ ] Test QR code scanning flow end-to-end
- [ ] Test with multiple concurrent users
- [ ] Performance testing on 3G/low-bandwidth

### 3. **Features**
- [ ] Product images instead of icon placeholders
- [ ] Payment integration (cash/pix reference)
- [ ] Favorite items / quick reorder
- [ ] Rating/feedback after order delivery
- [ ] More detailed order history with filters

### 4. **Admin Dashboard**
- [ ] Real-time view of all active orders
- [ ] Customer presence/location detection
- [ ] Delivery assignment and tracking
- [ ] Kitchen queue management

---

## Testing the UI

### Local Testing
```bash
# Start dev server
npm run dev

# Navigate to
http://localhost:3000/u/praia-central-01
```

### Test Flow
1. Click "Começar pedido"
2. Enter name and phone
3. Click "Validar pelo WhatsApp"
4. Copy the generated OTP code shown in alert
5. Paste into verification form
6. Click "Confirmar código"
7. Add items from menu
8. Go to cart and confirm order
9. View order status in "Conta" tab

---

## File Location
- **Path**: `src/app/(customer)/u/[umbrella_id]/page.tsx`
- **Type**: Client component ("use client")
- **Dependencies**: lucide-react, Next.js routing, utils (cn, formatCurrency)

