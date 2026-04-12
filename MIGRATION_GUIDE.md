# Manso Gestión - Supabase Migration Guide

## Overview
This guide outlines the migration process from the mock data store to Supabase database integration.

## Files Created/Modified

### 1. Database Schema
- **`supabase-schema.sql`** - Complete SQL schema for Supabase
  - Tables: products, guests, sales, ticket_sales, events
  - Indexes for performance
  - Row Level Security (RLS) policies
  - Database functions for calculations

### 2. Supabase Client
- **`src/lib/supabase.ts`** - Supabase client configuration with TypeScript types
- **`.env.example`** - Environment variables template

### 3. New Store Implementation
- **`src/store-supabase.ts`** - React hook for Supabase integration
- **`src/store.ts`** - Cleaned up mock data (ready for removal)

### 4. Dependencies
- **`package.json`** - Added @supabase/supabase-js dependency

## Migration Steps

### Step 1: Set up Supabase Project
1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings > API
3. Copy the Project URL and anon key

### Step 2: Create Database Tables
1. Go to the Supabase SQL Editor
2. Run the contents of `supabase-schema.sql`
3. Verify all tables are created successfully

### Step 3: Configure Environment
1. Copy `.env.example` to `.env`
2. Fill in your Supabase credentials:
   ```bash
   VITE_SUPABASE_URL=your_project_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

### Step 4: Install Dependencies
```bash
pnpm install @supabase/supabase-js
```

### Step 5: Update Application Code
Replace the current store usage with the new Supabase store:

```typescript
// Before
import { useStore } from '../store'

// After
import { useSupabaseStore } from '../store-supabase'

// In component
const store = useSupabaseStore()
```

### Step 6: Update Component Imports
Update all components that use the store:

#### Home.tsx
```typescript
// Replace
const { balance, products, setStockInicial } = useStore

// With
const { balance, products, updateProduct } = useSupabaseStore()
```

#### Barra.tsx
```typescript
// Replace
const { products, balance, sellProduct, addSale, addProduct } = useStore

// With
const { products, balance, addSale, addProduct } = useSupabaseStore()
```

#### Ingresos.tsx
```typescript
// Replace
const { sales, ticketSales, ticketPrices } = useStore

// With
const { sales, ticketSales, getTicketPrices } = useSupabaseStore()
```

## Database Schema Overview

### Tables

#### `products`
- Product inventory with categories
- Stock tracking
- Price management

#### `guests`
- Guest registration
- Type classification (regular/invitado)

#### `sales`
- All product sales
- Payment method tracking
- Event association

#### `ticket_sales`
- Ticket sales for events
- Guest association
- Price tracking

#### `events`
- Event management
- Ticket price configuration
- Active event tracking

### Key Features

#### Payment Method Tracking
All sales now track payment methods:
- `efectivo` (cash)
- `tarjeta` (card)
- `transferencia` (transfer)

#### Event Management
- Multiple events support
- Active event system
- Event-specific reporting

#### Real-time Calculations
- Automatic balance calculation
- Sales by payment method
- Stock management

## Security Considerations

### Row Level Security (RLS)
Basic policies are included but should be customized based on:
- User authentication requirements
- Event access control
- Data visibility rules

### API Keys
- Use environment variables for all credentials
- Never commit `.env` files to version control
- Consider using service roles for admin operations

## Testing the Migration

### 1. Database Connection
```typescript
import { supabase } from './lib/supabase'

// Test connection
const { data, error } = await supabase.from('products').select('*')
console.log('Connection test:', data, error)
```

### 2. Data Operations
Test CRUD operations for each table:
- Create products
- Add sales
- Register guests
- Create events

### 3. Real-time Features
- Test balance calculations
- Verify payment method tracking
- Check event switching

## Performance Optimizations

### Indexes
The schema includes indexes for:
- Product categories
- Sales dates and payment methods
- Guest types
- Event status

### Functions
Database functions for:
- Balance calculation
- Sales by payment method
- Active event queries

## Troubleshooting

### Common Issues

#### CORS Errors
Ensure your Supabase project allows your development domain:
1. Go to Project Settings > API
2. Add your localhost URL to CORS settings

#### Connection Issues
- Verify environment variables are set
- Check Supabase project status
- Ensure SQL schema was applied correctly

#### Type Errors
- Run `pnpm install` to update dependencies
- Restart TypeScript server in your IDE

## Next Steps

1. **Authentication**: Implement user authentication
2. **Real-time**: Add real-time subscriptions
3. **Backup**: Set up automated backups
4. **Monitoring**: Add error tracking and analytics

## Support

For issues with:
- **Supabase**: Check [Supabase Documentation](https://supabase.com/docs)
- **Database**: Review SQL schema for any custom modifications
- **Application**: Check console logs for detailed error messages
