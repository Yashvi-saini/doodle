-- Doodle game: PostgreSQL schema
-- Live game state (strokes, timers, active rooms) lives in Redis.
-- Postgres stores durable data, written once when a game ends.

-- ───────────── Enums ─────────────
CREATE TYPE visibility    AS ENUM ('public', 'unlisted', 'private');
CREATE TYPE game_status   AS ENUM ('finished', 'abandoned');
CREATE TYPE report_reason AS ENUM ('inappropriate_drawing', 'offensive_chat', 'cheating', 'spam', 'other');
CREATE TYPE report_status AS ENUM ('open', 'reviewed', 'actioned', 'dismissed');

-- Keeps updated_at correct without relying on app code
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ───────────── Users & auth ─────────────
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- uuidv7() on Postgres 18+
  username      text NOT NULL CHECK (username ~ '^[a-zA-Z0-9_]{3,20}$'),
  display_name  text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 40),
  avatar_url    text,
  is_banned     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz                                   -- soft delete
);
CREATE UNIQUE INDEX users_username_lower_uq ON users (lower(username));
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- One user can sign in with Google, Apple, or as a guest
CREATE TABLE auth_identities (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider          text NOT NULL CHECK (provider IN ('google', 'apple', 'guest')),
  provider_user_id  text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id)
);
CREATE INDEX auth_identities_user_idx ON auth_identities (user_id);

-- Denormalised totals so leaderboards don't scan every game
CREATE TABLE user_stats (
  user_id          uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  games_played     integer NOT NULL DEFAULT 0 CHECK (games_played >= 0),
  games_won        integer NOT NULL DEFAULT 0 CHECK (games_won >= 0),
  total_score      bigint  NOT NULL DEFAULT 0 CHECK (total_score >= 0),
  correct_guesses  integer NOT NULL DEFAULT 0 CHECK (correct_guesses >= 0),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_stats_leaderboard_idx ON user_stats (total_score DESC);

-- ───────────── Words ─────────────
CREATE TABLE word_packs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,50}$'),
  name         text NOT NULL,
  language     text NOT NULL DEFAULT 'en',                     -- e.g. 'en', 'hi'
  visibility   visibility NOT NULL DEFAULT 'private',
  is_official  boolean NOT NULL DEFAULT false,
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,   -- NULL for official packs
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX word_packs_creator_idx ON word_packs (created_by);
CREATE INDEX word_packs_public_idx  ON word_packs (language) WHERE visibility = 'public';
CREATE TRIGGER word_packs_updated_at BEFORE UPDATE ON word_packs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE words (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id     uuid NOT NULL REFERENCES word_packs(id) ON DELETE CASCADE,
  text        text NOT NULL CHECK (length(text) BETWEEN 1 AND 40),
  difficulty  smallint NOT NULL DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 3),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX words_pack_text_uq ON words (pack_id, lower(text));

-- ───────────── Finished games ─────────────
CREATE TABLE games (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code   text NOT NULL,                                   -- reused over time, so not unique
  host_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  pack_id     uuid REFERENCES word_packs(id) ON DELETE SET NULL,
  status      game_status NOT NULL,
  settings    jsonb NOT NULL DEFAULT '{}',                     -- rounds, draw_time_s, max_players, hints
  started_at  timestamptz NOT NULL,
  ended_at    timestamptz NOT NULL,
  CHECK (ended_at >= started_at)
);
CREATE INDEX games_started_at_idx ON games (started_at DESC);
CREATE INDEX games_host_idx       ON games (host_id);

CREATE TABLE game_players (
  game_id      uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  final_score  integer NOT NULL DEFAULT 0,
  final_rank   smallint,                                        -- NULL if they left early
  joined_at    timestamptz NOT NULL,
  left_at      timestamptz,
  PRIMARY KEY (game_id, user_id)
);
CREATE INDEX game_players_user_idx ON game_players (user_id, joined_at DESC);  -- "my match history"

CREATE TABLE rounds (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_number  smallint NOT NULL CHECK (round_number >= 1),
  turn_number   smallint NOT NULL CHECK (turn_number >= 1),
  drawer_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  word_id       uuid REFERENCES words(id) ON DELETE SET NULL,
  word_text     text NOT NULL,                                  -- snapshot in case the word is edited/deleted
  drawing_key   text,                                           -- object storage key for the replay file
  started_at    timestamptz NOT NULL,
  ended_at      timestamptz NOT NULL,
  UNIQUE (game_id, round_number, turn_number)
);
CREATE INDEX rounds_drawer_idx ON rounds (drawer_id);
CREATE INDEX rounds_word_idx   ON rounds (word_id);

-- One row per guesser per round (not every typed guess)
CREATE TABLE round_results (
  round_id       uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guessed        boolean NOT NULL,
  guess_time_ms  integer CHECK (guess_time_ms >= 0),            -- NULL if not guessed
  points         integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  PRIMARY KEY (round_id, user_id),
  CHECK (guessed OR guess_time_ms IS NULL)
);
CREATE INDEX round_results_user_idx ON round_results (user_id);

-- ───────────── Moderation ─────────────
CREATE TABLE reports (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  reported_user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  round_id          uuid REFERENCES rounds(id) ON DELETE SET NULL,
  reason            report_reason NOT NULL,
  details           text CHECK (length(details) <= 1000),
  status            report_status NOT NULL DEFAULT 'open',
  created_at        timestamptz NOT NULL DEFAULT now(),
  resolved_at       timestamptz,
  CHECK (reporter_id IS DISTINCT FROM reported_user_id)
);
CREATE INDEX reports_open_idx ON reports (created_at) WHERE status = 'open';
CREATE INDEX reports_reported_user_idx ON reports (reported_user_id);
