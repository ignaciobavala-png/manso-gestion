alter table ticket_registrations
  add column if not exists price_per_ticket decimal(10,2);
