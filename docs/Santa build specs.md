# Santa: build spec

Oct 3, 2026 · @Jean-Christophe Cuveler

Santa is an open-source web app for recurring secret gift exchanges: a lasting group, one edition per year, a draw nobody can see, and one wishlist per person per edition. This is the complete brief for building v1. Every screen is described in the companion doc, [Santa: screens](https://claude.ai/artifact/CdxQGNZMsxEQhZS23J4ZEF), whose screen IDs (S01 to S36) and email IDs (E1 to E8) match this spec.

## Product and scope

A web app (installable as a PWA) for gift exchanges that repeat, where each person secretly gives to one other person. The product is generic; Secret Santa is one theme.

- **First real use**: a family of 14, one draw per year at Christmas. Everyone has their own email address.
- **Hosted instance**: santa.totophe.com, where anyone can create a group.
- **Self-hosting**: a Docker image published from the repo, configured by environment variables.
- **Repo and licence**: github.com/totophe/santa, MIT.
- **Languages**: English (default), French, Dutch, German, Spanish.

Four principles decide every open question:

1. **A pairing is known to the giver only.** Not to admins, not to instance admins, not after the exchange.
2. **The group lasts, the edition is one round.** Nobody recreates a group or retypes a list from scratch.
3. **Email is the only notification, and only when action is needed.** Messages never trigger an email.
4. **Small.** Any feature must be explainable to a non-technical family member in one sentence.

## Vocabulary

Use these words in code, UI and docs. Never use "event": people confuse it with the party itself.

| Term | Meaning |
| --- | --- |
| Group (FR: Groupe) | The lasting set of people, shown by its own name, for example "Famille Cuvelier". |
| Edition (FR: Édition) | One round of the exchange inside a group, for example "Noël 2026". |
| Draw (FR: Tirage) | The moment inside an edition when recipients are assigned. |
| Member | A person who belongs to a group. |
| Participant | A member taking part in one edition. |
| Giver | The participant who gives. The recipient only ever sees them as "your Secret Santa" (theme wording). |
| Recipient | The participant a giver drew. |
| Wishlist | One list per participant per edition. |
| Alias | The random pseudonym and avatar a participant gets for one edition's group chat. |
| Group admin | A member who manages the group and its editions. |
| Instance admin | A person listed in the server configuration who can remove groups. |

## Roles and permissions

Nobody, in any role, can see a pairing other than their own recipient.

| Action | Who |
| --- | --- |
| Create a group | Any signed-in user, if the instance allows it (`GROUP_CREATION`) |
| See a group | Its members |
| See an edition | Its participants and the group's admins |
| Edit group name and language, manage admins, remove members, delete the group | Group admins |
| Start an edition, edit its settings, choose participants, invite, run the draw | Group admins |
| Remove a participant, resend an email, open the chat early, archive the edition | Group admins |
| Delete a group chat message | Group admins |
| Read a private thread | Its two parties only |
| See who is behind an alias | Nobody |
| List groups with counts, delete a group | Instance admins |

- **First admin**: the creator of the group.
- **Changing admins**: any admin can promote a member or demote another admin.
- **At least one admin**: the last admin cannot be demoted, leave or delete their account without naming a successor.
- **Admin outside an edition**: an admin who is not a participant still manages the edition and can read and delete group chat messages. They have no draw card, wishlist, alias or right to post.
- **Instance admins**: a fixed list of emails in `INSTANCE_ADMINS`. They see group names, counts and dates, never group content.

## Edition lifecycle and participants

An edition moves through four stages, always in this order.

1. **Open.** Participants are invited and confirm. Wishlists can be written. The participant list is editable.
2. **Drawn.** An admin runs the draw. Entries close, each participant is emailed "your draw is ready", and private threads open.
3. **Chat open.** When every participant has checked their draw, the group chat opens and everyone gets one email. This is a flag on a drawn edition, not a separate state.
4. **Archived.** 14 days after the exchange date, or when an admin archives it. Everything becomes read-only.

### Edition rules

- **Fields**: name (max 40 characters, no URLs, prefilled from the theme and year), exchange date, timezone (default: the creator's browser), budget amount and currency (optional), theme (default: the previous edition's).
- **No deadlines**: there is no sign-up deadline and no scheduled draw. The draw is a manual admin action.
- **Draw unlock**: the draw button is enabled when every participant is confirmed and there are at least 3.
- **One at a time**: a group has at most one non-archived edition. "Start a new edition" appears when there is none.
- **First edition**: creating a group creates its first edition in the same form.
- **Later editions**: the form lists all group members, ticked by default. The admin unticks those who skip. An unticked member gets no email for that edition and does not see it.
- **Editable until the draw**: admins can add or remove participants, and new people can join by link. After the draw nobody can be added.

### Participant statuses

Every participant sees the full participant list with each person's status and wishlist state. This is how the group knows whom to chase.

1. **Invited.** Added by an admin (a ticked member or a typed email) and emailed.
2. **Confirmed.** Email verified and participation accepted for this edition. Joining by invite link and completing sign-in counts. An existing member taps "I'm in" in the email or in the app.
3. **Draw checked.** Has completed their first reveal.

- **One-way**: "draw checked" never reverts, including when a departure changes that person's recipient.
- **Declining**: "Not this year" removes the person from the edition, not from the group.
- **Admin actions on a participant**: resend their pending email, remove from the edition, make or unmake admin.

## Accounts, sign-in and invitations

Sign-in is by email only: one email carries a 6-digit code and a magic link, and either one signs the person in.

### Sign-in

- **Code first**: the UI asks for the code by default. On iOS a magic link opens in Safari, not in the installed app, so the link is the fallback.
- **Validity**: 15 minutes, single use, 5 attempts per code.
- **Session**: 6 months, rolling. A "Shared device" checkbox at sign-in makes the session end with the browser.
- **Cookie**: httpOnly, Secure, SameSite=Lax. The server stores only a hash of the session token.
- **Account creation**: on first successful sign-in. One account per email, compared case-insensitively.
- **No enumeration**: the sign-in form answers the same way whether or not the address has an account.
- **Action links**: buttons in edition emails ("I'm in", "Open my draw") carry a single-use token valid 7 days that signs the person in and lands on the target. After that, the link asks for a normal sign-in and then lands on the target.

### Profile

- **First name or nickname**: required, max 30 characters, no URLs. This is the name shown everywhere ("Mamy" is fine).
- **Last name**: optional.
- **Language**: EN, FR, NL, DE or ES. Default: browser language, else the group's language, else English.
- **Nothing else**: no birthdate, no photo upload.

### Invitations

- **Invite link**: a random token, separate from the group's ID, shown as a link and a QR code. Admins can regenerate it, which revokes the old one. It stops working once the draw has run.
- **Join page**: before sign-in it shows only the group name and edition name. Members and wishlists appear after the email is verified.
- **Joining by link**: adds the person to the group and to the open edition as confirmed.
- **Typed invitations**: an admin enters a first name and an email. This creates an "invited" participant shown under that first name, and sends the invitation email.
- **Invitation email**: fixed text in the group's default language. The only variables are the inviter's first name and the edition name. It carries an unsubscribe link.
- **Cap**: 50 members per group.

## The draw

The draw arranges all participants in one single loop: each gives to the next, and the last gives to the first.

### Algorithm

- **Single loop**: shuffle the participants with a cryptographically secure random source, then link them in a circle. Nobody draws themselves and there are no mutual pairs.
- **No exclusions** in v1 (no couple or household rules).
- **No-repeat, soft**: avoid giving someone a recipient they had in the group's last 3 editions. Try up to 200 random loops for a lookback of 3, then 2, then 1, then accept any loop.
- **Relaxation is reported**: store the lookback achieved on the edition. When it is lower than the history allows, show admins "the no-repeat rule was relaxed this year", with no detail.
- **Minimum**: 3 participants.

### Storage

- **One row per giver**: the giver's participant ID in clear, the recipient's participant ID encrypted with AES-256-GCM under the instance key.
- **Lookup**: to find a recipient's giver, decrypt the edition's rows in memory. There are 50 at most.
- **Shuffled inserts**: insert the rows in random order in one statement, with no per-row timestamps. In a single loop, insertion order would spell out the chain.
- **Key**: `ENCRYPTION_KEY`, 32 bytes, kept outside the database. Store a fingerprint of the key at first start and refuse to start when it does not match.
- **Uses of decryption**: the giver's own reveal, routing a private thread, the departure repair, and the no-repeat rule. Nothing else.

### Reveal

- **Email**: "your draw is ready", with no name.
- **Button**: the draw card shows "Press and hold to reveal". While held, a fill animation runs for about 1 second. Then the recipient's first name appears and stays for as long as the press lasts.
- **Hiding**: hide the name on `pointerup`, `pointercancel`, `pointerleave`, window blur and `visibilitychange`.
- **Touch details**: `user-select: none`, `-webkit-touch-callout: none` and `touch-action: none` on the button, and suppress the context menu.
- **Keyboard and motion**: holding Space or Enter does the same. With `prefers-reduced-motion`, show progress without movement.
- **Fetch on completion**: the name is requested from the server only when the hold completes. It is never preloaded, cached by the service worker, or put in a URL, page title or local storage.
- **First reveal**: sets the status to "draw checked" and plays the theme's reveal animation once.
- **Who is signed in**: the card shows "Signed in as \<first name>" beside the button.
- **Nowhere else**: no other screen prints the recipient's name as the giver's recipient. The giver opens that person's wishlist from the list everyone can browse.

### When someone leaves after the draw

- **Repair**: the leaver's giver takes over the leaver's recipient. Update that one row and delete the leaver's row in one transaction.
- **One person is told**: only the inheriting giver is emailed "your draw has changed". Their status stays "draw checked", and their card shows a "changed" notice until their next reveal.
- **Admin confirmation**: the dialog says "1 assignment will change" and nothing more.
- **Threads**: the thread where the leaver was the recipient is deleted. The leaver's former recipient keeps their thread, and the new giver inherits it with its history.
- **Small groups**: if fewer than 3 participants remain, warn the admin that pairings become guessable.

## Wishlists

Each participant has one wishlist per edition, in one of three states: draft, published, or "Surprise me!".

| State | Who sees what |
| --- | --- |
| Draft | The owner sees and edits the items. Others see "No list yet". |
| Published | Every participant of the edition can read the items. |
| Surprise me! | Others see a card saying this person wants a surprise. Items, if any, are kept hidden as a draft. |

- **Empty state**: three choices. "Create my list", "Import from a previous edition" (hidden when there is none), "Surprise me!".
- **Item**: text (required, max 200 characters), and optionally a link, a price as free text (max 40) and a note (max 500).
- **Order is priority**: items are reordered by hand, most wanted first. There is no priority field.
- **Paste several**: a text box turns each non-empty line into an item. This is how people move over from a spreadsheet.
- **Import**: the person picks one of their own lists from any earlier edition, in any group, and ticks the items to copy into the draft. Items are unticked by default. Copies keep no link to the source.
- **Publishing**: needs at least one item. After publishing, edits go live at once. A published list that loses its last item returns to draft.
- **Surprise me!**: one tap, reversible. Switching back restores the draft, which must be published again.
- **What readers see**: items in order with the date each was added, and "last updated" on the list. No per-reader tracking.
- **No reservations**: nothing marks an item as bought or taken.
- **When**: a wishlist can be written as soon as the participant is confirmed, before the draw.
- **Status icon**: the participant list shows published, surprise, or not yet for each person.
- **Reminder**: participants with neither a published list nor "Surprise me!" get at most two emails per edition: 3 days after the draw, and 14 days before the exchange date.
- **Archive**: read-only, and still available to its owner as an import source.
- **Model**: a `wishlist` table linked to the participant, with items under it, so that reusable lists can be added later without migrating data.

## Chat and private threads

Messages are a fun extra, not a communication channel: they never trigger an email or a push notification.

### Common rules

- **Unread badges** in the app only.
- **No presence**: no typing, online or read indicators.
- **Content**: plain text, max 1,000 characters. Links are clickable with `rel="noopener nofollow"`.
- **Transport**: polling every 15 seconds while the screen is open is enough.

### Group chat, one per edition

- **Locked until everyone knows**: the chat opens when every participant has checked their draw. The locked screen shows the participant statuses, so people can chase the last ones.
- **Opening**: one email to all participants. An admin can open the chat early.
- **Alias**: each participant gets a random pseudonym and avatar from the theme, unique in the edition, assigned when the draw runs. They see their own alias.
- **Payloads**: messages carry an alias key, never a participant or user ID. The alias-to-participant mapping is stored in clear and never sent to any client or admin.
- **Moderation**: admins can delete any message, which then shows as "message removed".
- **System messages**: chat opened, admin added, admin removed.

### Private thread, one per recipient

- **Parties**: the recipient and whoever is currently their giver. It opens at the draw.
- **Recipient's side**: reached from their own wishlist page, titled with the theme's wording ("Your Secret Santa").
- **Giver's side**: reached from the draw card as "Message the person you drew". The thread screen never shows the recipient's name.
- **Neutral wording**: nothing about the giver hints at gender or identity, in any language.
- **One-tap questions**: the giver can send preset questions ("Sweet or savoury?", "Surprise or practical?", "What size do you wear?", "Any colour to avoid?"), and the recipient gets one-tap answers where they make sense. Free text is always available.
- **Payloads**: messages carry a role (`santa` or `recipient`), never the other party's ID. The author is not stored.
- **Giver change**: after a departure repair, the new giver sees the whole history.

## Emails

The app sends eight emails and nothing else. No email ever contains a recipient's name, a giver's name, an alias or the text of a message.

| ID | Email | Sent to | Trigger | Contains |
| --- | --- | --- | --- | --- |
| E1 | Sign-in | The address entered | Sign-in request | 6-digit code, magic link, 15-minute validity |
| E2 | Invitation | A typed address | Admin sends a typed invitation | Inviter's first name, edition name, "Join" button, unsubscribe link |
| E3 | New edition | Each ticked member | Admin starts an edition | Edition name, exchange date, budget, "I'm in" and "Not this year" buttons |
| E4 | Draw is ready | Each participant | The draw runs | "Open my draw" button |
| E5 | Draw has changed | The one inheriting giver | Departure repair | "Open my draw" button |
| E6 | Chat is open | Each participant | Everyone has checked, or an admin opens it | "Everyone knows who they are giving to", "Open the chat" button |
| E7 | Wishlist reminder | Participants with no published list and no "Surprise me!" | 3 days after the draw; 14 days before the exchange | "Write my list" button |
| E8 | Inactivity warning | Group admins | 30 days before auto-deletion | Group name, "Keep this group" button |

- **Language**: the recipient's language. E2 uses the group's default language.
- **Format**: HTML with a plain-text alternative. Edition emails carry the edition's theme header.
- **Resend**: an admin can resend E2, E3 or E4 to one participant, once per day per participant.
- **Suppression**: an address that used the unsubscribe link in E2 is never sent E2 again.
- **No tracking**: no pixels, no link redirection.
- **Sender**: `MAIL_FROM`, through the SMTP server in the environment variables.

## Themes and languages

A theme overrides whole strings, never single words: injected words break gender and articles in French, German and Dutch.

### Languages

- **Files**: `locales/en.json`, `fr.json`, `nl.json`, `de.json`, `es.json` at the repo root, flat keys, ICU MessageFormat for plurals and variables.
- **Source of truth**: English. CI fails on a missing or orphan key in any language. At runtime a missing string falls back to English.
- **No concatenation**: every sentence is one key.
- **Contributing**: `CONTRIBUTING.md` explains how to add a language in three steps: copy `en.json`, translate, add the code to the language list.

### Themes

- **Choice**: per edition. v1 ships `generic` and `santa`.
- **Folder**: `themes/<name>/` holds `theme.json` (label, palette as CSS custom properties, default edition name pattern), illustrations as SVG, the reveal animation, the alias list, and `locales/<lang>.json`.
- **Overrides**: a theme's locale file redefines complete message keys, for example the thread title "Your Secret Santa" where the generic theme says "Your secret giver".
- **Lookup order**: theme string in the user's language, then generic string in the user's language, then theme string in English, then generic string in English.
- **Aliases**: at least 60 per theme, each a key with an avatar SVG and a fixed translated name per language ("Grumpy Elf", "Lutin Grognon"). No generated adjective-plus-noun combinations.
- **Locked after the draw**: the theme cannot change once aliases are in use.

## Secrecy rules

These are invariants. Each one has an automated test, and a change that breaks one is a bug whatever else it achieves.

1. **One endpoint reveals.** The only response that contains a recipient is the reveal endpoint, and only the caller's own recipient.
2. **Per-viewer responses.** Every response is built from an explicit DTO for that viewer. Database entities are never serialized directly.
3. **The name stays out of everything else.** Never in a URL, page title, email, log line, error report, cache or local storage.
4. **Chat carries aliases.** Group chat payloads contain alias keys, never participant or user IDs.
5. **Threads carry roles.** Private thread payloads contain `santa` or `recipient`, never the other party's ID.
6. **Assignment rows tell nothing.** Shuffled inserts, no `created_at` or `updated_at` on the assignment table.
7. **"Draw checked" is one-way.** It never reverts, so a departure repair is invisible in the participant list.
8. **Admins get counts.** Any admin or instance-admin view that touches the draw shows numbers only.
9. **Logs carry no bodies.** Request and response bodies are not logged. Errors on draw code paths log no participant IDs.
10. **No presence.** No typing, online, last-seen or read indicators anywhere.
11. **Static cache only.** The service worker caches static assets, never API responses.

The limit of this design: whoever holds both the database and the encryption key can decrypt the draw. The goal is to make peeking impossible by accident, not to resist a determined host. Say so in the README.

## Public-instance protection

The hosted instance lets anyone create a group, so these limits ship in v1. Their job is to stop the app being used to send unwanted email.

| Limit | Default |
| --- | --- |
| Sign-in emails per address | 5 per hour |
| Sign-in emails per IP | 20 per hour |
| Attempts per sign-in code | 5 |
| Groups created per account | 3 per day |
| Typed invitations per account | 50 per day |
| Email resends per participant | 1 per day |
| Chat and thread messages per participant | 20 per minute |
| Members per group | 50 |

- **Overrides**: each limit has a `RATE_LIMIT_*` environment variable.
- **Who can create groups**: `GROUP_CREATION` is `open`, `allowlist` (emails in `GROUP_CREATION_ALLOWLIST`) or `admins` (instance admins only). Creating always requires a verified account.
- **Text that ends up in emails**: first name, group name and edition name are length-limited and reject URLs.
- **Suppression list**: the unsubscribe link in an invitation stores a keyed hash of the address. Typed invitations to a suppressed address are silently skipped.
- **IDs**: groups, editions and participants use random IDs of at least 128 bits. No readable slugs, no sequential numbers in URLs.
- **Not found means not yours**: a URL for a group the user does not belong to answers exactly like a URL that does not exist.
- **Headers**: a strict Content-Security-Policy, no third-party scripts, no analytics.
- **Instance admin page**: totals (accounts, groups, editions) and a list of groups with name, creator email, member count, edition count, creation date and last activity. One action: delete a group.

## Data model

Fourteen tables, plus one metadata row. All primary keys are random UUIDs; every table has `created_at` unless noted.

| Table | Key fields | Notes |
| --- | --- | --- |
| `user` | email (unique, lowercased), first\_name, last\_name, language, last\_seen\_at | Created at first sign-in |
| `login_token` | email, code\_hash, link\_token\_hash, purpose (`sign_in`, `action`), target, expires\_at, attempts, used\_at | Codes and tokens stored hashed |
| `session` | user\_id, token\_hash, persistent, expires\_at, last\_used\_at | `persistent = false` for shared devices |
| `group` | name, default\_language, created\_by, last\_activity\_at |  |
| `membership` | group\_id, user\_id, role (`member`, `admin`) | Unique on group and user |
| `edition` | group\_id, name, theme, exchange\_date, timezone, budget\_amount, budget\_currency, state (`open`, `drawn`, `archived`), drawn\_at, chat\_opened\_at, no\_repeat\_lookback, invite\_token, archived\_at | One non-archived edition per group |
| `participant` | edition\_id, user\_id (null until a typed invitee signs in), invited\_email, invited\_first\_name, status (`invited`, `confirmed`), confirmed\_at, draw\_checked\_at, alias\_key, chat\_read\_at, thread\_read\_as\_santa\_at, thread\_read\_as\_recipient\_at | "Draw checked" means `draw_checked_at` is set |
| `assignment` | edition\_id, giver\_participant\_id, recipient\_ciphertext, nonce | No timestamps. One row per giver |
| `wishlist` | participant\_id (unique), state (`draft`, `published`, `surprise`), published\_at, updated\_at |  |
| `wishlist_item` | wishlist\_id, position, text, url, price, note |  |
| `chat_message` | edition\_id, alias\_key (null for system messages), system\_kind, body, deleted\_at | Author is the alias only |
| `thread` | edition\_id, recipient\_participant\_id (unique) | Created at the draw |
| `thread_message` | thread\_id, from\_role (`santa`, `recipient`), body | No author ID |
| `email_suppression` | email\_hash | Keyed hash, not the address |

- **Instance metadata**: a single-row `instance_meta` table holds the encryption key fingerprint.
- **Alias mapping**: `participant.alias_key` is the only link between a person and their alias. No DTO exposes it for anyone but the owner.
- **Deletion**: foreign keys cascade from group to editions to participants and their content.

## Stack, deployment and configuration

One Docker image serves the API and the built web app; PostgreSQL runs beside it.

- **Stack**: NestJS API, React single-page app (Vite, TypeScript), PostgreSQL, Sequelize 7.
- **Compose**: `docker-compose.yml` at the repo root with two services, `app` and `postgres`.
- **Migrations**: forward-only, run at startup.
- **PWA**: web manifest, icons, and a service worker that caches static assets only. The app never prompts to install or to allow notifications.
- **Layout**: `apps/api`, `apps/web`, `locales/`, `themes/`, `docs/`, `.env.example`, `README.md`, `CONTRIBUTING.md`, `LICENSE`.
- **CI (GitHub Actions)**: lint, type-check, tests, locale key check, build. On a version tag, publish the image to `ghcr.io/totophe/santa`.
- **Health**: `GET /healthz` returns 200 when the database is reachable and the key fingerprint matches.

| Variable | Purpose | Default |
| --- | --- | --- |
| `APP_URL` | Public base URL, used in emails and QR codes | none, required |
| `DATABASE_URL` | PostgreSQL connection string | none, required |
| `ENCRYPTION_KEY` | 32 bytes, base64. Encrypts assignments | none, required |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE` | Outgoing mail | none, required |
| `MAIL_FROM` | Sender name and address | none, required |
| `GROUP_CREATION` | `open`, `allowlist` or `admins` | `admins` |
| `GROUP_CREATION_ALLOWLIST` | Comma-separated emails | empty |
| `INSTANCE_ADMINS` | Comma-separated emails | empty |
| `INSTANCE_NAME` | Name shown in the UI and emails | `Santa` |
| `DEFAULT_LANGUAGE` | Fallback language | `en` |
| `PRIVACY_PAGE_PATH` | Markdown file replacing the default privacy text | built-in text |
| `INACTIVE_GROUP_YEARS` | Years without activity before a group is deleted | `3` |
| `RATE_LIMIT_*` | Overrides for the limits table | see limits |
| `TRUST_PROXY` | Read the client IP from proxy headers | `false` |

The hosted instance sets `GROUP_CREATION=open` and uses Scaleway Transactional Email for SMTP.

## Data lifecycle

People can leave and delete on their own, and nothing is kept forever.

- **Leave a group**: removes the membership and the person's place in the current edition. After the draw, this triggers the departure repair.
- **Delete an account**: leaves every group under the same rules, then deletes the user, sessions and wishlists. Past participant rows show "Former member". Chat messages stay under their alias.
- **Sole admin**: must name a successor before leaving or deleting their account. If they are the only member, the group is deleted.
- **Delete a group**: admins only, after typing the group's name. Deletes all its editions and content.
- **Auto-deletion**: a group with no activity for `INACTIVE_GROUP_YEARS` is deleted. Admins get E8 30 days before.
- **Expired tokens**: sign-in codes, action tokens and ended sessions are purged daily.
- **Privacy page**: a default text ships with the app; `PRIVACY_PAGE_PATH` replaces it.
- **Backups**: the README tells self-hosters to back up the database and the encryption key separately. Restoring one without the other loses every draw and the no-repeat history.

## Tests and build order

The draw code and the secrecy rules are what people will read to decide whether to trust the app, so they are tested first and hardest.

### Tests

- **Draw, property-based**: for any group of 3 to 50, everyone gives once and receives once, nobody draws themselves, and the result is one loop covering everyone.
- **No-repeat**: with a generated history, the rule holds whenever a valid loop exists, and relaxation is reported when it does not.
- **Departure repair**: removing any participant from a loop of 4 or more leaves one loop, with exactly one giver changed.
- **Leak tests**: for every endpoint and every role, assert the response contains only the keys that viewer's DTO allows.
- **One-way status**: "draw checked" survives a departure repair.
- **Encryption**: a wrong key refuses to start; assignment rows are unreadable without the key.
- **Locales**: no missing or orphan key in any language.
- **Rate limits**: each limit in the table is enforced.
- **End to end (Playwright)**: create a group, invite three people, confirm, draw, reveal for each, chat opens.

### Build order

1. Repo, compose, migrations, sign-in, profile, locale and theme plumbing (EN and FR, Santa theme).
2. Group and first edition, invite link and QR, join, participant list with statuses.
3. Wishlists: draft, publish, "Surprise me!", paste several.
4. Draw: algorithm and its tests, encryption, emails E4 and E6, press-and-hold reveal.
5. Private threads, then group chat with aliases and the open gate.
6. Admin actions: typed invitations, resend, remove participant, departure repair, admins, edition settings.
7. Rate limits, suppression list, instance admin page, privacy page, account and group deletion.
8. New edition flow, archive, import between editions, no-repeat rule.
9. NL, DE and ES, the generic theme, PWA manifest and icons.

Steps 1 to 7 are what the first family draw needs. Step 8 is only exercised from the second edition on.

## Not in v1

Do not build these. Each was discussed and left out on purpose.

- **Gift reservations** or any "bought" mark on a wishlist item.
- **Reusable wishlists** shared between editions or groups.
- **Joining after the draw**, with its volunteer poll and partial redraw.
- **Exclusions** between couples or households.
- **A scheduled or automatic draw**, and a sign-up deadline.
- **Redrawing** an edition that is already drawn.
- **Emails or push notifications for messages.**
- **Accounts without an email address**, and child accounts managed by a parent.
- **Revealing pairings** after the exchange, to anyone.
- **A guess-your-Santa game**: any feedback on a guess leaks information.
- **Several open editions** in one group at the same time.
- **Offline mode.**
- **A "gift sorted" progress bar and a post-exchange gift wall**: liked ideas, kept for a later version.

## Open points

These defaults were chosen to fill gaps and were not explicitly confirmed. Tick each one to accept it, or change it before building.

- [ ] An admin can open the group chat early when someone never checks their draw.
- [ ] Buttons in edition emails sign the person in (single use, valid 7 days).
- [ ] An edition archives itself 14 days after the exchange date.
- [ ] A wishlist item is a text plus an optional link, price and note, and order stands for priority.
- [ ] The wishlist reminder is sent twice at most per edition.
- [ ] Aliases are assigned when the draw runs, and the theme is locked from then on.
- [ ] The profile is a first name or nickname, an optional last name and a language, with no birthdate.
- [ ] Self-hosted instances default to `GROUP_CREATION=admins`; the hosted instance sets `open`.
- [ ] The name shown in the UI is "Santa", configurable per instance.
