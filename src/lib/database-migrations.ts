export const sqliteMigration = [
  `CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY CHECK (id = 1), title TEXT NOT NULL, date TEXT NOT NULL DEFAULT '',
    venue TEXT NOT NULL DEFAULT '', target_winners INTEGER NOT NULL CHECK(target_winners > 0),
    registration_open INTEGER NOT NULL DEFAULT 1, demo INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS registrations (
    id TEXT PRIMARY KEY, nrp TEXT NOT NULL UNIQUE, full_name TEXT NOT NULL,
    party_size INTEGER NOT NULL CHECK(party_size > 0), created_at INTEGER NOT NULL,
    request_key TEXT NOT NULL UNIQUE
  )`,
  `CREATE TABLE IF NOT EXISTS draws (
    id TEXT PRIMARY KEY, registration_id TEXT NOT NULL UNIQUE REFERENCES registrations(id),
    slot INTEGER NOT NULL CHECK(slot > 0), nrp TEXT NOT NULL, full_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending','confirmed','forfeited')),
    reason TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, reveal_at INTEGER NOT NULL,
    received_at INTEGER, request_key TEXT NOT NULL UNIQUE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS one_pending_draw ON draws(status) WHERE status = 'pending'`,
  `CREATE UNIQUE INDEX IF NOT EXISTS one_winner_per_slot ON draws(slot) WHERE status IN ('pending','confirmed')`,
  `INSERT OR IGNORE INTO events(id,title,date,venue,target_winners,registration_open,demo)
   VALUES(1,'Family Gathering United Tractors Palembang','2026-11-14','Palembang',20,1,0)`,
  `CREATE TABLE IF NOT EXISTS app_migrations (id TEXT PRIMARY KEY)`,
  `UPDATE events SET date='2026-11-14' WHERE NOT EXISTS (SELECT 1 FROM app_migrations WHERE id='space-auto-winners-v2')`,
  `UPDATE draws SET status='confirmed' WHERE status='pending'`,
  `INSERT OR IGNORE INTO app_migrations(id) VALUES('space-auto-winners-v2')`,
  `CREATE TABLE IF NOT EXISTS attendance_roster (
    id TEXT PRIMARY KEY, nrp TEXT NOT NULL UNIQUE, full_name TEXT NOT NULL, company TEXT NOT NULL,
    planned_size INTEGER NOT NULL CHECK(planned_size>0), source TEXT NOT NULL CHECK(source IN ('excel','uts')),
    draw_enabled INTEGER NOT NULL, attendance_note TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS registration_details (
    registration_id TEXT PRIMARY KEY REFERENCES registrations(id), planned_size INTEGER NOT NULL,
    company TEXT NOT NULL, acknowledged_extra INTEGER NOT NULL DEFAULT 0, extra_coupons INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS coupon_transfers (
    id TEXT PRIMARY KEY, donor_id TEXT NOT NULL REFERENCES registrations(id), recipient_id TEXT NOT NULL REFERENCES registrations(id),
    quantity INTEGER NOT NULL CHECK(quantity>0), created_at INTEGER NOT NULL, request_key TEXT NOT NULL UNIQUE
  )`,
  `CREATE TABLE IF NOT EXISTS prize_sessions (
    id TEXT PRIMARY KEY, prize_name TEXT NOT NULL, prize_image TEXT NOT NULL DEFAULT '',
    size INTEGER NOT NULL CHECK(size BETWEEN 1 AND 5), base_slot INTEGER NOT NULL, created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS prize_requests (
    request_key TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, session_id TEXT NOT NULL REFERENCES prize_sessions(id), created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS prize_draws (
    id TEXT PRIMARY KEY, roster_id TEXT NOT NULL UNIQUE REFERENCES attendance_roster(id),
    session_id TEXT NOT NULL REFERENCES prize_sessions(id), request_key TEXT NOT NULL REFERENCES prize_requests(request_key),
    position INTEGER NOT NULL, slot INTEGER NOT NULL, nrp TEXT NOT NULL, full_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('confirmed','forfeited')), created_at INTEGER NOT NULL, reveal_at INTEGER NOT NULL,
    received_at INTEGER, reel_names TEXT NOT NULL, reel_index INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS prize_position_filled ON prize_draws(session_id,position) WHERE status='confirmed'`,
  `CREATE TABLE IF NOT EXISTS display_controls (id INTEGER PRIMARY KEY CHECK(id=1), show_winners INTEGER NOT NULL DEFAULT 0)`,
  `INSERT OR IGNORE INTO display_controls(id,show_winners) VALUES(1,0)`,
  `CREATE TABLE IF NOT EXISTS projector_audio (id INTEGER PRIMARY KEY CHECK(id=1), muted INTEGER NOT NULL DEFAULT 0 CHECK(muted IN (0,1)))`,
  `INSERT OR IGNORE INTO projector_audio(id,muted) VALUES(1,0)`,
  `CREATE TABLE IF NOT EXISTS projector_audio_levels (
    id INTEGER PRIMARY KEY CHECK(id=1), standby INTEGER NOT NULL CHECK(standby BETWEEN 0 AND 100),
    rolling INTEGER NOT NULL CHECK(rolling BETWEEN 0 AND 100), drum INTEGER NOT NULL CHECK(drum BETWEEN 0 AND 100),
    brass INTEGER NOT NULL CHECK(brass BETWEEN 0 AND 100)
  )`,
  `INSERT OR IGNORE INTO projector_audio_levels(id,standby,rolling,drum,brass) VALUES(1,50,10,90,100)`,
  `CREATE TABLE IF NOT EXISTS roster_seating (nrp TEXT PRIMARY KEY REFERENCES attendance_roster(nrp), table_number TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS registration_seating (registration_id TEXT PRIMARY KEY REFERENCES registrations(id), table_number TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS draw_only_roster (nrp TEXT PRIMARY KEY REFERENCES attendance_roster(nrp))`,
  `CREATE TABLE IF NOT EXISTS prize_catalog (
    slot INTEGER PRIMARY KEY CHECK(slot>0), name TEXT NOT NULL, grand INTEGER NOT NULL CHECK(grand IN (0,1))
  )`,
  `CREATE TABLE IF NOT EXISTS prize_session_catalog (session_id TEXT PRIMARY KEY REFERENCES prize_sessions(id))`,
];
