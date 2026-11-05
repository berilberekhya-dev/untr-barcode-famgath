import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const events = sqliteTable('events', {
  id: integer('id').primaryKey(), title: text('title').notNull(), date: text('date').notNull(),
  venue: text('venue').notNull(), targetWinners: integer('target_winners').notNull(),
  registrationOpen: integer('registration_open', { mode: 'boolean' }).notNull(),
  demo: integer('demo', { mode: 'boolean' }).notNull(),
});
export const registrations = sqliteTable('registrations', {
  id: text('id').primaryKey(), nrp: text('nrp').notNull().unique(), fullName: text('full_name').notNull(),
  partySize: integer('party_size').notNull(), createdAt: integer('created_at').notNull(),
  requestKey: text('request_key').notNull().unique(),
});
export const draws = sqliteTable('draws', {
  id: text('id').primaryKey(), registrationId: text('registration_id').notNull().unique().references(() => registrations.id),
  slot: integer('slot').notNull(), nrp: text('nrp').notNull(), fullName: text('full_name').notNull(),
  status: text('status', { enum: ['confirmed', 'forfeited'] }).notNull(),
  reason: text('reason').notNull(), createdAt: integer('created_at').notNull(),
  revealAt: integer('reveal_at').notNull(), receivedAt: integer('received_at'),
  requestKey: text('request_key').notNull().unique(),
});
