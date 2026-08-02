-- supabase/migrations/20260801000000_orders_status_invoice.sql
alter table orders
  add column status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  add column odoo_invoice_id integer,
  add column accepted_at timestamptz,
  add column rejected_at timestamptz;

create policy "Owners can view their catalogs' orders"
  on orders for select
  using (
    catalog_id in (select id from catalogs where owner_id = auth.uid())
  );

create policy "Owners can update their catalogs' orders"
  on orders for update
  using (
    catalog_id in (select id from catalogs where owner_id = auth.uid())
  );
