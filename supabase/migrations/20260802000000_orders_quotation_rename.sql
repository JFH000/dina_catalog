-- supabase/migrations/20260802000000_orders_quotation_rename.sql
alter table orders
  rename column odoo_invoice_id to odoo_quotation_id;
