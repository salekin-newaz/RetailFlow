-- =======================================================
-- RetailFlow Supabase Database Initialization Script
-- Secure, Deadlock-free, and RLS Recursion-safe Schema
-- =======================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. SHOPS TABLE
create table public.shops (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    owner_name text,
    address text,
    phone text,
    created_at timestamp with time zone default now()
);

-- 2. PROFILES TABLE
create table public.profiles (
    id uuid references auth.users on delete cascade primary key,
    full_name text not null,
    role text check (role in ('owner', 'cashier', 'viewer')) not null,
    shop_id uuid references public.shops on delete cascade not null,
    created_at timestamp with time zone default now()
);

-- Enable RLS on shops and profiles
alter table public.shops enable row level security;
alter table public.profiles enable row level security;

-- 3. PRODUCTS TABLE
create table public.products (
    id uuid default gen_random_uuid() primary key,
    shop_id uuid references public.shops on delete cascade not null,
    product_code text not null,
    name text not null,
    category text,
    cost_price decimal(12,2) not null check (cost_price >= 0),
    selling_price decimal(12,2) not null check (selling_price >= 0),
    stock decimal(12,2) default 0 check (stock >= 0),
    unit_type text check (unit_type in ('pcs', 'kg', 'liter', 'dozen', 'packet', 'bag', 'bottle', 'box')) not null,
    low_stock_threshold integer default 10,
    created_at timestamp with time zone default now(),
    unique (shop_id, product_code)
);

-- 4. SUPPLIERS TABLE
create table public.suppliers (
    id uuid default gen_random_uuid() primary key,
    shop_id uuid references public.shops on delete cascade not null,
    name text not null,
    phone text,
    address text,
    notes text,
    created_at timestamp with time zone default now()
);

-- 5. PURCHASES TABLE
create table public.purchases (
    id uuid default gen_random_uuid() primary key,
    shop_id uuid references public.shops on delete cascade not null,
    product_id uuid references public.products on delete cascade not null,
    supplier_id uuid references public.suppliers on delete set null,
    quantity decimal(12,2) not null check (quantity > 0),
    cost_per_unit decimal(12,2) not null check (cost_per_unit >= 0),
    total_cost decimal(12,2) not null check (total_cost >= 0),
    purchase_date date not null,
    notes text,
    created_at timestamp with time zone default now()
);

-- 6. CUSTOMERS TABLE
create table public.customers (
    id uuid default gen_random_uuid() primary key,
    shop_id uuid references public.shops on delete cascade not null,
    name text not null,
    phone text,
    total_due decimal(12,2) default 0,
    created_at timestamp with time zone default now()
);

-- 7. SALES TABLE
create table public.sales (
    id uuid default gen_random_uuid() primary key,
    shop_id uuid references public.shops on delete cascade not null,
    invoice_no text not null,
    product_id uuid references public.products on delete cascade not null,
    customer_id uuid references public.customers on delete set null,
    quantity decimal(12,2) not null check (quantity > 0),
    unit_price decimal(12,2) not null check (unit_price >= 0),
    discount_amount decimal(12,2) default 0 check (discount_amount >= 0),
    total_revenue decimal(12,2) not null check (total_revenue >= 0),
    estimated_profit decimal(12,2) not null,
    is_credit boolean default false,
    amount_paid decimal(12,2) default 0 check (amount_paid >= 0),
    seasonal_offer text,
    sale_date date not null,
    created_at timestamp with time zone default now()
);

-- 8. EXPENSES TABLE
create table public.expenses (
    id uuid default gen_random_uuid() primary key,
    shop_id uuid references public.shops on delete cascade not null,
    category text check (category in ('Rent', 'Electricity', 'Salary', 'Transport', 'Supplies', 'Maintenance', 'Other')) not null,
    amount decimal(12,2) not null check (amount > 0),
    note text,
    expense_date date not null,
    created_at timestamp with time zone default now()
);

-- 9. RETURNS TABLE
create table public.returns (
    id uuid default gen_random_uuid() primary key,
    shop_id uuid references public.shops on delete cascade not null,
    type text check (type in ('sales_return', 'purchase_return')) not null,
    product_id uuid references public.products on delete cascade not null,
    quantity decimal(12,2) not null check (quantity > 0),
    amount decimal(12,2) not null check (amount >= 0),
    reason text,
    return_date date not null,
    created_at timestamp with time zone default now()
);

-- 10. PAYMENTS TABLE (For Outstanding Due Collections log)
create table public.payments (
    id uuid default gen_random_uuid() primary key,
    shop_id uuid references public.shops on delete cascade not null,
    customer_id uuid references public.customers on delete cascade not null,
    amount decimal(12,2) not null check (amount > 0),
    payment_date date not null,
    note text,
    created_at timestamp with time zone default now()
);

-- 11. INVITATIONS TABLE (For shop roles pre-assignment)
create table public.invitations (
    id uuid default gen_random_uuid() primary key,
    shop_id uuid references public.shops on delete cascade not null,
    email text not null,
    role text check (role in ('owner', 'cashier', 'viewer')) not null,
    created_at timestamp with time zone default now(),
    unique (shop_id, email)
);

-- Enable RLS on all operational tables
alter table public.products enable row level security;
alter table public.suppliers enable row level security;
alter table public.purchases enable row level security;
alter table public.customers enable row level security;
alter table public.sales enable row level security;
alter table public.expenses enable row level security;
alter table public.returns enable row level security;
alter table public.payments enable row level security;
alter table public.invitations enable row level security;

-- =======================================================
-- 12. RLS UTILITIES & SECURITY FUNCTIONS
-- =======================================================
create or replace function public.get_user_shop_id()
returns uuid security definer as $$
begin
    return (select shop_id from public.profiles where id = auth.uid());
end;
$$ language plpgsql;

create or replace function public.get_user_role()
returns text security definer as $$
begin
    return (select role from public.profiles where id = auth.uid());
end;
$$ language plpgsql;

-- =======================================================
-- 13. ROW LEVEL SECURITY POLICIES
-- =======================================================

-- PROFILES policies
create policy "Select Profiles own" on public.profiles for select using (auth.uid() = id);
create policy "Insert Profiles self" on public.profiles for insert with check (auth.uid() = id);
create policy "Update Profiles self" on public.profiles for update using (auth.uid() = id);
create policy "Select Profiles Shop" on public.profiles for select using (shop_id = public.get_user_shop_id());

-- SHOPS policies
-- Fix: Allow select for authenticated users who do not have a profile yet (onboarding deadlock fix)
create policy "Select Shops Link" on public.shops for select using (
    id = public.get_user_shop_id()
    or
    not exists (select 1 from public.profiles where id = auth.uid())
);
create policy "Insert Shops Authenticated" on public.shops for insert with check (true);
create policy "Update Shops Owner" on public.shops for update using (id = public.get_user_shop_id() and public.get_user_role() = 'owner');

-- PRODUCTS policies
create policy "Select Products" on public.products for select using (shop_id = public.get_user_shop_id());
create policy "Insert Products Owner" on public.products for insert with check (shop_id = public.get_user_shop_id() and public.get_user_role() = 'owner');
create policy "Update Products" on public.products for update using (shop_id = public.get_user_shop_id());
create policy "Delete Products Owner" on public.products for delete using (shop_id = public.get_user_shop_id() and public.get_user_role() = 'owner');

-- SUPPLIERS policies
-- Fix: Allow cashiers to select suppliers for purchases
create policy "Select Suppliers" on public.suppliers for select using (
    shop_id = public.get_user_shop_id() 
    and 
    public.get_user_role() in ('owner', 'cashier')
);
create policy "Insert Suppliers Owner" on public.suppliers for insert with check (shop_id = public.get_user_shop_id() and public.get_user_role() = 'owner');
create policy "Delete Suppliers Owner" on public.suppliers for delete using (shop_id = public.get_user_shop_id() and public.get_user_role() = 'owner');

-- PURCHASES policies
create policy "Select Purchases" on public.purchases for select using (shop_id = public.get_user_shop_id());
create policy "Insert Purchases Owner/Cashier" on public.purchases for insert with check (shop_id = public.get_user_shop_id() and public.get_user_role() in ('owner', 'cashier'));
create policy "Delete Purchases Owner" on public.purchases for delete using (shop_id = public.get_user_shop_id() and public.get_user_role() = 'owner');

-- CUSTOMERS policies
create policy "Select Customers" on public.customers for select using (shop_id = public.get_user_shop_id());
create policy "Insert Customers" on public.customers for insert with check (shop_id = public.get_user_shop_id() and public.get_user_role() in ('owner', 'cashier'));
create policy "Update Customers" on public.customers for update using (shop_id = public.get_user_shop_id());
create policy "Delete Customers Owner" on public.customers for delete using (shop_id = public.get_user_shop_id() and public.get_user_role() = 'owner');

-- SALES policies
create policy "Select Sales" on public.sales for select using (shop_id = public.get_user_shop_id());
create policy "Insert Sales Owner/Cashier" on public.sales for insert with check (shop_id = public.get_user_shop_id() and public.get_user_role() in ('owner', 'cashier'));
create policy "Delete Sales Owner" on public.sales for delete using (shop_id = public.get_user_shop_id() and public.get_user_role() = 'owner');

-- EXPENSES policies
create policy "Select Expenses Owner" on public.expenses for select using (shop_id = public.get_user_shop_id() and public.get_user_role() = 'owner');
create policy "Insert Expenses Owner" on public.expenses for insert with check (shop_id = public.get_user_shop_id() and public.get_user_role() = 'owner');
create policy "Delete Expenses Owner" on public.expenses for delete using (shop_id = public.get_user_shop_id() and public.get_user_role() = 'owner');

-- RETURNS policies
create policy "Select Returns Owner" on public.returns for select using (shop_id = public.get_user_shop_id() and public.get_user_role() = 'owner');
create policy "Insert Returns Owner" on public.returns for insert with check (shop_id = public.get_user_shop_id() and public.get_user_role() = 'owner');
create policy "Delete Returns Owner" on public.returns for delete using (shop_id = public.get_user_shop_id() and public.get_user_role() = 'owner');

-- PAYMENTS policies
create policy "Select Payments" on public.payments for select using (shop_id = public.get_user_shop_id());
create policy "Insert Payments Owner/Cashier" on public.payments for insert with check (shop_id = public.get_user_shop_id() and public.get_user_role() in ('owner', 'cashier'));
create policy "Delete Payments Owner" on public.payments for delete using (shop_id = public.get_user_shop_id() and public.get_user_role() = 'owner');

-- INVITATIONS policies
create policy "Select Invitations" on public.invitations for select using (true);
create policy "Insert Invitations Owner" on public.invitations for insert with check (shop_id = public.get_user_shop_id() and public.get_user_role() = 'owner');
create policy "Delete Invitations Owner" on public.invitations for delete using (shop_id = public.get_user_shop_id() and public.get_user_role() = 'owner');
