-- Manso Gestión - Supabase Database Schema
-- Created for migration from mock data to Supabase

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Products Table
CREATE TABLE products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  price DECIMAL(10, 2) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('bebida', 'comida', 'otro')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Guests Table
CREATE TABLE guests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('invitado', 'regular')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales Table
CREATE TABLE sales (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  total DECIMAL(10, 2) NOT NULL CHECK (total > 0),
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('efectivo', 'tarjeta', 'transferencia')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ticket Sales Table
CREATE TABLE ticket_sales (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  guest_name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('regular', 'invitado')),
  price DECIMAL(10, 2) NOT NULL CHECK (price > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Events Table (for managing different events)
CREATE TABLE events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  regular_ticket_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  invited_ticket_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT false,  -- true = evento abierto (puede haber varios)
  registrations_open BOOLEAN NOT NULL DEFAULT true,
  max_capacity INTEGER,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Configuración del venue (fila única, id = 1)
CREATE TABLE venue_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  alias_pago TEXT,
  cbu_pago TEXT,
  carta_activa BOOLEAN DEFAULT false,
  current_event_id UUID REFERENCES events(id) ON DELETE SET NULL  -- evento actualmente en operación

);

-- Update sales table to include event reference
ALTER TABLE sales ADD COLUMN event_id UUID REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE ticket_sales ADD COLUMN event_id UUID REFERENCES events(id) ON DELETE CASCADE;

-- Indexes for better performance
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_sales_product_id ON sales(product_id);
CREATE INDEX idx_sales_payment_method ON sales(payment_method);
CREATE INDEX idx_sales_created_at ON sales(created_at);
CREATE INDEX idx_ticket_sales_guest_id ON ticket_sales(guest_id);
CREATE INDEX idx_ticket_sales_type ON ticket_sales(type);
CREATE INDEX idx_ticket_sales_created_at ON ticket_sales(created_at);
CREATE INDEX idx_guests_type ON guests(type);
CREATE INDEX idx_events_is_active ON events(is_active);

-- Row Level Security (RLS) Policies
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Basic policies (you can adjust these based on your auth requirements)
CREATE POLICY "Allow all operations on products" ON products FOR ALL USING (true);
CREATE POLICY "Allow all operations on guests" ON guests FOR ALL USING (true);
CREATE POLICY "Allow all operations on sales" ON sales FOR ALL USING (true);
CREATE POLICY "Allow all operations on ticket_sales" ON ticket_sales FOR ALL USING (true);
CREATE POLICY "Allow all operations on events" ON events FOR ALL USING (true);

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_guests_updated_at BEFORE UPDATE ON guests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for current active event (driven by venue_config.current_event_id)
CREATE OR REPLACE VIEW active_event AS
  SELECT e.*
  FROM events e
  JOIN venue_config vc ON vc.current_event_id = e.id
  WHERE vc.id = 1;

-- Function to get current balance (sum of all sales and ticket sales)
CREATE OR REPLACE FUNCTION get_current_balance(p_event_id UUID DEFAULT NULL)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
    v_balance DECIMAL(10, 2);
BEGIN
    SELECT COALESCE(SUM(total), 0) + COALESCE(
        (SELECT COALESCE(SUM(price), 0) 
         FROM ticket_sales 
         WHERE (p_event_id IS NULL OR event_id = p_event_id)), 0
    ) INTO v_balance
    FROM sales 
    WHERE (p_event_id IS NULL OR event_id = p_event_id);
    
    RETURN v_balance;
END;
$$ LANGUAGE plpgsql;

-- Function to get sales by payment method
CREATE OR REPLACE FUNCTION get_sales_by_payment_method(p_event_id UUID DEFAULT NULL)
RETURNS TABLE(
    payment_method VARCHAR(20),
    total_amount DECIMAL(10, 2),
    transaction_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        payment_method,
        COALESCE(SUM(total), 0) as total_amount,
        COUNT(*) as transaction_count
    FROM sales 
    WHERE (p_event_id IS NULL OR event_id = p_event_id)
    GROUP BY payment_method;
END;
$$ LANGUAGE plpgsql;
