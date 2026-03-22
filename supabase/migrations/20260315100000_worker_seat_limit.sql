ALTER TABLE companies ADD COLUMN IF NOT EXISTS worker_seat_limit integer NOT NULL DEFAULT 0;
