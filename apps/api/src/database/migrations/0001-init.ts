import type { Sequelize } from '@sequelize/core';

/**
 * Initial schema — the fourteen tables of the data model plus the single-row
 * instance_meta. Migrations are forward-only and run at startup; there is no
 * down migration by design.
 *
 * Enums are modelled as text + CHECK constraints: easy to evolve, and they
 * serialize plainly in dumps. All primary keys are random UUIDs.
 */
export const name = '0001-init';

export async function up({ context: sequelize }: { context: Sequelize }): Promise<void> {
  await sequelize.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    -- Single-row table holding the encryption key fingerprint.
    CREATE TABLE instance_meta (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      key_fingerprint  text NOT NULL,
      created_at       timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE "user" (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email         text NOT NULL,
      first_name    text,
      last_name     text,
      language      text NOT NULL DEFAULT 'en',
      last_seen_at  timestamptz,
      created_at    timestamptz NOT NULL DEFAULT now()
    );
    -- One account per email, compared case-insensitively.
    CREATE UNIQUE INDEX user_email_lower_uk ON "user" (lower(email));

    CREATE TABLE login_token (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email            text NOT NULL,
      code_hash        text NOT NULL,
      link_token_hash  text NOT NULL,
      purpose          text NOT NULL CHECK (purpose IN ('sign_in','action')),
      target           text,
      expires_at       timestamptz NOT NULL,
      attempts         integer NOT NULL DEFAULT 0,
      used_at          timestamptz,
      created_at       timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX login_token_email_idx ON login_token (lower(email));

    CREATE TABLE "session" (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      token_hash    text NOT NULL,
      persistent    boolean NOT NULL DEFAULT true,
      expires_at    timestamptz NOT NULL,
      last_used_at  timestamptz,
      created_at    timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX session_token_hash_uk ON "session" (token_hash);

    CREATE TABLE "group" (
      id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name              text NOT NULL,
      default_language  text NOT NULL DEFAULT 'en',
      created_by        uuid REFERENCES "user"(id) ON DELETE SET NULL,
      last_activity_at  timestamptz NOT NULL DEFAULT now(),
      created_at        timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE membership (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id    uuid NOT NULL REFERENCES "group"(id) ON DELETE CASCADE,
      user_id     uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      role        text NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
      created_at  timestamptz NOT NULL DEFAULT now(),
      UNIQUE (group_id, user_id)
    );

    CREATE TABLE edition (
      id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id           uuid NOT NULL REFERENCES "group"(id) ON DELETE CASCADE,
      name               text NOT NULL,
      theme              text NOT NULL DEFAULT 'generic',
      exchange_date      date,
      timezone           text,
      budget_amount      numeric(12,2),
      budget_currency    text,
      state              text NOT NULL DEFAULT 'open' CHECK (state IN ('open','drawn','archived')),
      drawn_at           timestamptz,
      chat_opened_at     timestamptz,
      no_repeat_lookback integer,
      invite_token       text,
      archived_at        timestamptz,
      created_at         timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX edition_invite_token_uk ON edition (invite_token) WHERE invite_token IS NOT NULL;
    -- At most one non-archived edition per group.
    CREATE UNIQUE INDEX edition_one_active_per_group ON edition (group_id) WHERE state <> 'archived';

    CREATE TABLE participant (
      id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      edition_id                  uuid NOT NULL REFERENCES edition(id) ON DELETE CASCADE,
      user_id                     uuid REFERENCES "user"(id) ON DELETE SET NULL,
      invited_email               text,
      invited_first_name          text,
      status                      text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','confirmed')),
      confirmed_at                timestamptz,
      draw_checked_at             timestamptz,
      alias_key                   text,
      chat_read_at                timestamptz,
      thread_read_as_santa_at     timestamptz,
      thread_read_as_recipient_at timestamptz,
      created_at                  timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX participant_edition_idx ON participant (edition_id);
    CREATE UNIQUE INDEX participant_edition_user_uk ON participant (edition_id, user_id) WHERE user_id IS NOT NULL;
    CREATE UNIQUE INDEX participant_edition_alias_uk ON participant (edition_id, alias_key) WHERE alias_key IS NOT NULL;

    -- One row per giver. No created_at/updated_at: insertion order must reveal
    -- nothing about the loop.
    CREATE TABLE assignment (
      id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      edition_id            uuid NOT NULL REFERENCES edition(id) ON DELETE CASCADE,
      giver_participant_id  uuid NOT NULL REFERENCES participant(id) ON DELETE CASCADE,
      recipient_ciphertext  bytea NOT NULL,
      nonce                 bytea NOT NULL
    );
    CREATE UNIQUE INDEX assignment_giver_uk ON assignment (giver_participant_id);
    CREATE INDEX assignment_edition_idx ON assignment (edition_id);

    CREATE TABLE wishlist (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      participant_id  uuid NOT NULL UNIQUE REFERENCES participant(id) ON DELETE CASCADE,
      state           text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','published','surprise')),
      published_at    timestamptz,
      updated_at      timestamptz NOT NULL DEFAULT now(),
      created_at      timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE wishlist_item (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      wishlist_id  uuid NOT NULL REFERENCES wishlist(id) ON DELETE CASCADE,
      position     integer NOT NULL DEFAULT 0,
      text         text NOT NULL,
      url          text,
      price        text,
      note         text,
      created_at   timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX wishlist_item_wishlist_idx ON wishlist_item (wishlist_id, position);

    CREATE TABLE chat_message (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      edition_id   uuid NOT NULL REFERENCES edition(id) ON DELETE CASCADE,
      alias_key    text,
      system_kind  text,
      body         text,
      deleted_at   timestamptz,
      created_at   timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX chat_message_edition_idx ON chat_message (edition_id, created_at);

    CREATE TABLE thread (
      id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      edition_id               uuid NOT NULL REFERENCES edition(id) ON DELETE CASCADE,
      recipient_participant_id uuid NOT NULL UNIQUE REFERENCES participant(id) ON DELETE CASCADE,
      created_at               timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX thread_edition_idx ON thread (edition_id);

    CREATE TABLE thread_message (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      thread_id   uuid NOT NULL REFERENCES thread(id) ON DELETE CASCADE,
      from_role   text NOT NULL CHECK (from_role IN ('santa','recipient')),
      body        text NOT NULL,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX thread_message_thread_idx ON thread_message (thread_id, created_at);

    CREATE TABLE email_suppression (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email_hash  text NOT NULL UNIQUE,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
  `);
}
