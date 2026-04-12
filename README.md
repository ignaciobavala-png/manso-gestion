# Manso Gestión - Sistema de Gestión Interna para Manso Club

Aplicación web de gestión interna desarrollada con React, TypeScript y Tailwind CSS v4 para la administración de eventos del Manso Club.

## 🎯 Estado Actual del Proyecto

### **Estructura del Proyecto**
```
src/
├── components/
│   └── BottomNav.tsx          # Navegación inferior con 4 pestañas
├── pages/
│   ├── Main.tsx              # Pantalla principal con 3 secciones
│   ├── Home.tsx              # Panel de control (Balance + Stock)
│   ├── Entradas.tsx          # Gestión de invitados (QR + Comodines)
│   └── Barra.tsx             # Ventas de productos (Grilla + Botones)
├── store.ts                  # Store de Zustand con tipos TypeScript
├── App.tsx                   # Componente principal con navegación
├── main.tsx                  # Punto de entrada de la aplicación
└── index.css                # Estilos globales con Tailwind v4
```

### **🚀 Funcionalidades Implementadas**

#### **1. Pantalla Principal (Main.tsx)**
- **3 tarjetas de navegación grandes:**
  - 📊 **Panel de Control** - Balance y configuración de stock inicial
  - 🎫 **Entradas** - Registro de invitados y escaneo QR
  - 🍺 **Barra** - Ventas y gestión de productos
- **Header con:**
  - Título "Manso Gestión"
  - Indicador "Vivo" con punto parpadeante
  - Balance total visible
- **Resumen rápido** con estadísticas del evento
- **Instrucciones** paso a paso de uso

#### **2. Panel de Control (Home.tsx)**
- **Balance Total** destacado con color verde vibrante
- **Configuración de Stock Inicial:**
  - Lista de productos (Fernet, Gin, Cerveza, Vino, Whisky, Pizza, Hamburguesa)
  - Inputs numéricos con botones +/- para ajustar stock
  - Precios visibles por producto
- **Estadísticas rápidas:**
  - Cantidad de productos
  - Stock total
  - Valor total del stock

#### **3. Gestión de Entradas (Entradas.tsx)**
- **Simulador de QR Scanner:**
  - Animación de escaneo
  - Feedback visual de éxito
  - Botón "Escanear QR"
- **Registro de Comodines:**
  - Botón "Agregar Comodín"
  - Lista de invitados registrados
  - Diferenciación entre comodines y regulares
- **Lista de últimos 10 invitados** con:
  - Nombre y timestamp
  - Tipo (comodín/regular)
  - Iconos diferenciados

#### **4. Barra de Ventas (Barra.tsx)**
- **Grilla de productos** organizada por categorías:
  - **Bebidas:** Fernet, Gin, Cerveza, Vino, Whisky
  - **Comida:** Pizza, Hamburguesa
- **Botones de venta rápida:**
  - "Vender 1" - Venta unitaria
  - "Vender 2" - Venta doble
  - "Personalizar" - Cantidad específica
- **Control de stock** con indicadores visuales:
  - Verde: Stock suficiente
  - Ámbar: Stock bajo (<10)
- **Ventas recientes** con historial
- **Estadísticas en tiempo real**

#### **5. Navegación (BottomNav.tsx)**
- **4 pestañas fijas en la parte inferior:**
  - 🏠 **Principal** - Pantalla principal
  - 📊 **Control** - Panel de control
  - 🎫 **Entradas** - Gestión de invitados
  - 🍺 **Barra** - Ventas de productos
- **Indicador visual** de página activa
- **Diseño mobile-first** con touch targets adecuados

### **🎨 Estilo Visual**
- **Paleta de colores:** Esquema de grises con acentos verdes
- **Fondo principal:** `gray-900` (#111827)
- **Tarjetas:** `gray-800` con bordes `gray-700`
- **Acentos:** `emerald-400` (verde) para elementos activos
- **Tipografía:** Inter (similar a San Francisco)
- **Bordes:** `rounded-3xl` para tarjetas, `rounded-2xl` para elementos internos
- **Efectos:** `backdrop-blur-sm` en headers, animaciones sutiles

### **🛠️ Tecnologías Utilizadas**
- **React 19** con TypeScript
- **Tailwind CSS v4** (mobile-first, container queries)
- **Vite** como bundler
- **Store de Zustand** (simulado - listo para implementación real)
- **Diseño responsive** (mobile-first, breakpoints: sm:640px, md:768px, lg:1024px)

### **📱 Características Técnicas**
- **Mobile-first design** - Optimizado para dispositivos móviles
- **Touch-friendly** - Botones mínimos de 44px
- **Type-safe** - Tipos TypeScript completos
- **Performance** - Lazy loading listo para implementar
- **Accesibilidad** - Contraste WCAG compliant

### **🔧 Store de Zustand (store.ts)**
```typescript
interface Product {
  id: string
  name: string
  stock: number
  price: number
  category: 'bebida' | 'comida' | 'otro'
}

interface Guest {
  id: string
  name: string
  timestamp: string
  type: 'comodín' | 'regular'
}

interface Sale {
  id: string
  productId: string
  productName: string
  quantity: number
  total: number
  timestamp: string
}

// Funciones disponibles:
- setStockInicial(productId, stock)
- addGuest(guest)
- sellProduct(productId, quantity)
- addSale(sale)
- updateBalance(amount)
```

### **🚦 Estado de Desarrollo**
- ✅ **Estructura completa** de navegación
- ✅ **UI/UX completa** de las 4 pantallas principales
- ✅ **Store configurado** con tipos TypeScript
- ✅ **Estilos optimizados** para visibilidad
- ✅ **Diseño responsive** mobile-first
- ⚠️ **Store simulado** - Listo para conectar con backend
- ⚠️ **Navegación básica** - Lista para React Router DOM
- ⚠️ **Funcionalidad mock** - Datos de demostración

### **📋 Próximos Pasos Recomendados**
1. **Instalar React Router DOM** para navegación completa
2. **Implementar Zustand real** con persistencia
3. **Conectar con backend** (API REST o Firebase)
4. **Agregar autenticación** para usuarios
5. **Implementar scanner QR real** con cámara
6. **Agregar reporting** y analytics
7. **Testing** con Jest/React Testing Library

### **🚀 Cómo Ejecutar**
```bash
# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm run dev

# Construir para producción
npm run build

# Ejecutar linter
npm run lint
```

### **🎯 Objetivo del Proyecto**
Sistema de gestión interna para eventos del Manso Club que permite:
- Controlar stock inicial de productos
- Registrar invitados mediante QR
- Gestionar ventas en tiempo real
- Monitorear balance y estadísticas
- Operar desde dispositivos móviles en el evento

---

**Última actualización:** 12 de abril de 2026  
**Estado:** UI/UX completa, lista para integración backend  
**Responsable:** Equipo de desarrollo Manso Club

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
