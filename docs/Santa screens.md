# Santa: screens

Oct 3, 2026 · @Jean-Christophe Cuveler

Santa has 36 screens and 8 emails. This brief lists each one with its content, actions and states, plus the rules every design must respect. It is written for a designer who has not read the [build spec](https://claude.ai/artifact/RFAg6njj319ZSAabBHY4Sf); screen IDs (S01 to S36) and email IDs (E1 to E8) are the same in both.

## Product in brief

Santa is a web app for secret gift exchanges that repeat every year: each person secretly gives to one other person, and nobody else ever learns who gave to whom.

- **Group**: the lasting set of people, for example a family. It has one or more admins.
- **Edition**: one round inside a group, for example "Noël 2026". It has a name, an exchange date, an optional budget and a theme.
- **Draw**: an admin runs it once every participant has confirmed. Each person then discovers their recipient with a press-and-hold gesture.
- **Wishlist**: one per person per edition. It is a draft, published, or replaced by "Surprise me!".
- **Messages**: an anonymous private thread between each person and their Secret Santa, and a group chat where everyone has a random alias and avatar.
- **Statuses**: everyone sees who is invited, who has confirmed and who has checked their draw, so the group can chase the late ones.

The first users are a family of 14, aged 12 to over 80, mostly on phones. The app is generic and themed per edition: v1 has a neutral theme and a Santa theme.

The tone is warm, playful and short. Clarity always wins over cuteness.

## Design rules

Ten rules apply to every screen. The first three protect the secret and are not negotiable.

1. **The recipient's name appears in one place only**: on the draw card, while the button is held. Never in a header, a thread title, a notification, a page title or a link.
2. **Nothing hints at who a giver is.** Wording about "your Secret Santa" is neutral: no gender, no avatar derived from the person, no "online" or "typing" signs.
3. **A glance at someone's phone reveals nothing.** After the hold is released, the screen looks the same as before.
4. **Phone first.** Design for 360 to 430 px wide. On desktop the same layout sits in a centred column.
5. **For ages 12 to 80+.** Body text at 16 px or more, tap targets at 44 px or more, one primary action per screen.
6. **Five languages.** English, French, Dutch, German and Spanish. German and Dutch run about 30% longer, so buttons must wrap and no text is baked into images.
7. **Accessible.** WCAG AA contrast, visible focus, and a reduced-motion variant for every animation. Status is always an icon plus a label, never colour alone.
8. **Two themes, one layout.** A theme changes palette, illustrations, aliases and some wording. It never changes structure.
9. **No nagging.** No install prompt, no notification permission prompt, no cookie banner (there is one session cookie and no tracking).
10. **Light mode is required; dark mode is welcome.**

Navigation proposal: the edition page is the hub, with four tabs at the bottom: Home, Wishlists, Chat, People. The designer is free to propose another structure.

## Screen list

| ID | Screen | Seen by |
| --- | --- | --- |
| S01 | Landing | Signed-out visitors |
| S02 | Sign in | Signed-out visitors |
| S03 | Enter code | Signed-out visitors |
| S04 | Link landing | Anyone opening a magic link |
| S05 | Join | Anyone opening an invite link or QR code |
| S06 | Profile setup | New accounts |
| S07 | Unsubscribed | Anyone using an invitation's unsubscribe link |
| S08 | Home | Signed-in users |
| S09 | Create a Secret Santa | Users allowed to create a group |
| S10 | Start a new edition | Group admins |
| S11 | Edition, open | Participants and admins |
| S12 | Edition, drawn | Participants and admins |
| S13 | Participants | Participants and admins |
| S14 | Draw card | Participants |
| S15 | My wishlist, empty | Participants |
| S16 | My wishlist, editing | Participants |
| S17 | Import from a previous edition | Participants |
| S18 | My wishlist, "Surprise me!" | Participants |
| S19 | Wishlists | Participants |
| S20 | Private thread, as recipient | Participants |
| S21 | Private thread, as giver | Participants |
| S22 | Group chat | Participants and admins |
| S23 | Group settings | Members; admins see more |
| S24 | Invite | Group admins |
| S25 | Run the draw | Group admins |
| S26 | Edition settings | Group admins |
| S27 | Remove a participant | Group admins |
| S28 | Change admins | Group admins |
| S29 | Account | Signed-in users |
| S30 | Past editions | Members |
| S31 | Archived edition | Its participants |
| S32 | Participation prompt | Invited members |
| S33 | Leave group | Members |
| S34 | Instance admin | Instance admins |
| S35 | Privacy page | Everyone |
| S36 | System states | Everyone |

## Entry and sign-in

Sign-in is by email: the person types their address, receives a 6-digit code and a link, and uses either.

### S01 Landing

- **Shows**: one sentence on what the app does, three short benefits (a group that lasts, a draw nobody can see, a wishlist per person), a language switcher, a link to the open-source repo, a link to the privacy page.
- **Actions**: "Create a Secret Santa" (primary), "Sign in".
- **States**: creation open; creation closed (only "Sign in", with a line saying groups are by invitation on this site).

### S02 Sign in

- **Shows**: an email field, a "Shared device" checkbox with one line of explanation ("You'll be signed out when you close the browser").
- **Actions**: "Send my code".
- **States**: default, sending, invalid address, too many requests.

### S03 Enter code

- **Shows**: the address the code went to, six digit boxes (numeric keypad, paste fills all six), a hint that the link in the email also works.
- **Actions**: the code submits itself when complete; "Send a new code" with a cooldown; "Use another address".
- **States**: wrong code with attempts left, code expired, too many attempts.

### S04 Link landing

- **Shows**: "Signing you in", then the target screen.
- **States**: link expired or already used, with a button to get a new code.

### S05 Join

- **Shows**: the group name, the edition name and the theme illustration. Nothing about members.
- **Actions**: "Join", which leads to S02, S03 and, for a new account, S06.
- **States**: link revoked; entries closed because the draw has run; group full; already a participant (goes to the edition).

### S06 Profile setup

- **Shows**: first name or nickname (required), last name (optional), language.
- **Actions**: "Continue".
- **Note**: the first name is what everyone sees, so the hint says a nickname like "Mamy" is fine.

### S07 Unsubscribed

- **Shows**: a confirmation that this site will not send invitations to that address again.

## Home and creation

Most people belong to one group, so Home opens that group's current edition directly when there is only one.

### S08 Home

- **Shows**: one card per group with the group name, the current edition name, the theme's accent, the days left until the exchange, and the person's next step as a chip ("Confirm you're in", "Publish your list", "Check your draw", "3 unread").
- **Actions**: open a group; "Create a Secret Santa" when the site allows it; account.
- **States**: no group yet (explains that an invite link is needed, or offers to create one); one group (skips to its edition); several groups; a group with no current edition.

### S09 Create a Secret Santa

- **Shows**: one form creating the group and its first edition. Group name, edition name (prefilled from the theme and year), exchange date, budget and currency (optional), theme picker with a preview of each, group language.
- **Actions**: "Create", which leads to S24 Invite.
- **States**: validation errors (name too long, links not allowed, date in the past); daily creation limit reached.

### S10 Start a new edition

- **Shows**: edition name, exchange date, budget and theme, all prefilled from the previous edition. Below, every group member with a tick, all ticked by default.
- **Actions**: untick members who skip this year; "Start", which emails every ticked member.
- **Note**: the line under the list says unticked members will not see this edition and can be added back until the draw.

## Edition page

The edition page is where people spend their time. It changes once at the draw, so it is described as two screens.

### S11 Edition, open (before the draw)

- **Header**: edition name, group name, theme illustration, days until the exchange, budget.
- **My next step**: one card that changes with the person's situation. Invited: "I'm in" and "Not this year". Confirmed with no list: "Write your wishlist". List done: "You're ready. The draw happens when everyone has confirmed."
- **Progress**: "11 of 14 confirmed", linking to S13.
- **Entries**: my wishlist, everyone's wishlists.
- **Admin bar**: "Invite" (S24), "Run the draw" (S25, disabled with the reason until everyone has confirmed), "Settings" (S26).

### S12 Edition, drawn

- **Top**: the draw card (S14).
- **Entries**: "Your Secret Santa" thread with an unread badge, my wishlist, everyone's wishlists, participants.
- **Group chat entry**: locked ("Opens when everyone has checked their draw: 2 to go") or open with an unread badge.
- **Header**: as S11. On the exchange date it switches to a "Today's the day" state.
- **Admin bar**: "Settings"; "Open the chat now" while it is locked.

### S13 Participants

- **Row**: first name (with last initial when two people share it), an admin badge, a status chip, a wishlist icon.
- **Status chip**: Invited, Confirmed, or Draw checked.
- **Wishlist icon**: published, "Surprise me!", or not yet.
- **Summary**: "12 of 14 confirmed" before the draw, "12 of 14 have checked their draw" after.
- **Order**: people still waiting first, so they are easy to chase.
- **Admin actions on a row**: resend their email, remove from this edition (S27), make or unmake admin (S28).

### S14 Draw card

The signature component. The recipient's name is visible only while the button is held.

| State | What the card shows |
| --- | --- |
| Not drawn | A sealed envelope and "The draw hasn't happened yet". |
| Ready | "Your draw is ready", a large "Press and hold to reveal" button, and "Signed in as Marie" beside it. |
| Holding | The button fills over about 1 second, so the person sees how long to hold. Releasing early cancels. |
| Revealed | The recipient's first name, large, for as long as the press lasts. The first time only, the theme's reveal animation plays. |
| Released | The name is gone and the button is back. Below: "Message the person you drew" and a reminder that their wishlist is in Wishlists. Neither shows the name. |
| Changed | A notice: "Your draw has changed. Press and hold to see it." |
| Archived | The same button still works, so a giver can check who they had. |

- **Touch**: no text selection bubble, no context menu, no magnifier on a long press.
- **Keyboard**: holding Space or Enter does the same, with a visible focus ring.
- **Reduced motion**: the fill becomes a static progress indicator; the reveal animation is replaced by a simple fade.
- **Budget and date**: shown on the card, since this is where people come back to while shopping.

## Wishlists

A person has one wishlist per edition. It is a draft only they can see, a published list everyone in the edition can read, or "Surprise me!".

### S15 My wishlist, empty

- **Shows**: three large choices. "Create my list", "Import from a previous edition" (absent when there is none), "Surprise me!".
- **Note**: each choice has one line saying what it does. This screen is the first thing a new participant is sent to.

### S16 My wishlist, editing

- **State banner**: "Draft: only you can see this" or "Published: everyone in this edition can see this".
- **Items**: an ordered list, most wanted first, with a handle to reorder. Each row shows the text, and the link, price and note when present.
- **Add an item**: one text field. "More details" unfolds link, price and note.
- **Paste several**: a box where each line becomes an item.
- **Actions**: "Publish" (draft with at least one item); edit and delete on each item; "Switch to Surprise me!".
- **After the draw**: the entry to the "Your Secret Santa" thread sits on this page.
- **States**: draft with no item ("Publish" disabled); draft; published; read-only when archived.

### S17 Import from a previous edition

- **Step 1**: the person's own earlier lists, each with group name, edition name and item count.
- **Step 2**: that list's items with tick boxes, unticked by default, and "Select all".
- **Actions**: "Add to my draft".

### S18 My wishlist, "Surprise me!"

- **Shows**: a themed card confirming the person asked to be surprised, and that nobody will be reminded to chase them.
- **Actions**: "Write a list instead", which brings back the draft with any earlier items.

### S19 Wishlists

- **List view**: every participant with their wishlist icon (published, "Surprise me!", not yet). The person's own row comes first.
- **Someone's list**: their items in order, each with text, a link button, price, note and the date it was added, plus "last updated" at the top.
- **States for someone's list**: published; "Surprise me!" card; "No list yet".
- **Note**: everyone can open everyone's list, so looking at one gives nothing away. Nothing here marks a person as "your recipient".

## Messages

Messages are a playful extra. They never send an email, so the only signal is an unread badge inside the app.

Each participant has two private threads that must not be confused: one with their Secret Santa (S20) and one with the person they drew (S21). They live in different places and should look clearly different.

### S20 Private thread, as recipient

- **Entry**: from my wishlist page.
- **Header**: the theme's wording, "Your Secret Santa", with a themed anonymous avatar that is the same for everyone.
- **Messages**: "Secret Santa" on one side, "You" on the other. Plain text, with a time.
- **One-tap answers**: when the Secret Santa sends a preset question, its possible answers appear as chips.
- **Empty state**: "Your Secret Santa can ask you questions here. You can also leave them a hint."
- **States**: empty; active; read-only when archived.

### S21 Private thread, as giver

- **Entry**: from the draw card, as "Message the person you drew".
- **Header**: "The person you drew". The recipient's name never appears on this screen.
- **Reminder line**: "They don't know who you are. Mind what your message gives away."
- **One-tap questions**: chips above the text field ("Sweet or savoury?", "Surprise or practical?", "What size do you wear?", "Any colour to avoid?").
- **Messages**: "You, as Secret Santa" on one side, "Them" on the other.
- **Note**: after a departure, a new giver sees earlier messages from the previous Secret Santa, labelled the same way.

### S22 Group chat

- **Locked**: an illustration, "The chat opens when everyone has checked their draw", and the participants still to check.
- **Open**: messages with the sender's alias avatar and alias name. My own messages sit on the other side under my alias.
- **My alias**: shown at the top ("You are Grumpy Elf this year").
- **System messages**: chat opened; an admin added or removed.
- **Admin**: delete a message, which leaves "message removed". An admin who is not a participant can read and delete but has no text field.
- **States**: locked; open and empty; open; read-only when archived.

## Admin screens

Group admins see the same app as everyone else, plus these screens. No admin screen ever shows who drew whom.

### S23 Group settings

- **Shows**: group name, default language, the members with an admin badge, the list of past editions (S30).
- **Admin actions**: rename, change language, make or unmake admin (S28), remove a member, delete the group.
- **Member actions**: leave the group (S33).
- **Delete the group**: a danger zone that asks the admin to type the group's name.

### S24 Invite

- **Link**: the invite link with "Copy" and the phone's share sheet.
- **QR code**: large enough to scan from a phone held up at a family dinner.
- **Regenerate**: replaces the link and the QR code, with a warning that the old one stops working.
- **By email**: rows of first name and email, "Send invitations", and a note that the email text is fixed.
- **Pending**: people invited by email who have not joined, each with "Resend" and "Cancel".
- **States**: open; entries closed after the draw; daily invitation limit reached; group full.

### S25 Run the draw

- **Disabled**: the button states why ("Waiting for 3 people to confirm", "At least 3 participants are needed").
- **Confirmation**: "Draw for 14 participants. Nobody, including you, will see the result. Nobody can join after this."
- **Done**: "Everyone has been emailed. Now check your own draw."
- **Variant**: a notice that the no-repeat rule was relaxed this year.

### S26 Edition settings

- **Shows**: name, exchange date, timezone, budget and currency, theme.
- **Actions**: save; "Open the chat now" (drawn and still locked); "Archive this edition".
- **States**: the theme is locked after the draw; everything is read-only once archived.

### S27 Remove a participant

- **Before the draw**: a simple confirmation.
- **After the draw**: "Removing Marc changes 1 assignment. One person will be told their draw has changed. Nobody will know who."
- **Warning variant**: fewer than 3 participants would remain, so pairings become guessable.

### S28 Change admins

- **Make admin**: a confirmation listing what an admin can do, and that admins cannot see the draw.
- **Unmake admin**: a confirmation.
- **Blocked**: the last admin is told to name another admin first.

## Account, archive, instance admin and system

### S29 Account

- **Shows**: first name or nickname, last name, language, email (read-only).
- **Actions**: save; sign out; delete my account.
- **Delete my account**: lists the groups the person will leave, and is blocked while they are the only admin of a group with other members.

### S30 Past editions

- **Shows**: the group's archived editions, each with name, exchange date and number of participants.
- **Admin action**: "Start a new edition" (S10) when no edition is running.

### S31 Archived edition

- **Shows**: the edition page, read-only: header, participants, wishlists, the group chat with aliases still in place, my two threads, my draw card.
- **Note**: an "Archived" banner replaces every text field and action. Nothing reveals who gave to whom.

### S32 Participation prompt

- **Reached from**: the "new edition" email, or the Home card.
- **Shows**: edition name, exchange date, budget, theme illustration.
- **Actions**: "I'm in" and "Not this year".
- **After "I'm in"**: straight to my wishlist (S15), where importing last year's list is one of the three choices.
- **After "Not this year"**: a short confirmation that they stay in the group for next time.

### S33 Leave group

- **Before the draw**: a simple confirmation.
- **After the draw**: the confirmation adds that one person will be given a new recipient.
- **Blocked**: the last admin must name another admin first.

### S34 Instance admin

- **Shows**: totals for accounts, groups and editions, and a table of groups with name, creator email, members, editions, creation date and last activity.
- **Actions**: delete a group, after typing its name.
- **Note**: plain and functional. No group content is visible here.

### S35 Privacy page

- **Shows**: a long-form text page with headings. Self-hosters replace the text, so the layout must handle any length.

### S36 System states

- **Loading**: skeletons for lists and cards.
- **Empty**: every list has an empty state with one sentence and one action.
- **Not found**: one message for both "does not exist" and "you are not a member".
- **Errors**: generic error with retry; "too many attempts, try again in 10 minutes"; session ended, sign in again.
- **Offline**: a slim banner; the app does not work offline.
- **Toasts**: saved, copied, sent, removed.

## Emails

Eight emails share one template: a header, one short paragraph, one button, a footer. None of them may contain a recipient's name, a giver's name, an alias or the text of a message.

| ID | Email | Header | Body in one line | Button |
| --- | --- | --- | --- | --- |
| E1 | Sign-in | Neutral | The 6-digit code, large and easy to copy, valid 15 minutes | "Sign in" |
| E2 | Invitation | Neutral | "Marie invites you to Noël 2026" | "Join" |
| E3 | New edition | Edition theme | Edition name, exchange date, budget | "I'm in", and a secondary "Not this year" |
| E4 | Draw is ready | Edition theme | "Your draw is ready" | "Open my draw" |
| E5 | Draw has changed | Edition theme | "Your draw has changed" | "Open my draw" |
| E6 | Chat is open | Edition theme | "Everyone knows who they are giving to. The chat is open." | "Open the chat" |
| E7 | Wishlist reminder | Edition theme | "Your Secret Santa is waiting for ideas" | "Write my list" |
| E8 | Inactivity warning | Neutral | "This group will be deleted in 30 days" | "Keep this group" |

- **Subject lines**: as neutral as the body. They show on lock screens.
- **E2 footer**: an unsubscribe link, and one line saying why the person received this.
- **Width and weight**: single column, readable without images, with a plain-text version.
- **Languages**: the five app languages, so the button must cope with long labels.

## Themes

v1 ships two themes on one layout: a neutral "gift exchange" theme and a Santa theme. An admin picks the theme per edition, and it colours that edition's screens and emails only.

| Each theme provides | Generic | Santa |
| --- | --- | --- |
| Mood | Neutral and festive, usable for a birthday or an office exchange | Winter, Christmas, a little mischievous |
| Giver wording | "Your secret giver" | "Your Secret Santa" |
| Default edition name | "Gift exchange 2026" | "Christmas 2026" (FR: "Noël 2026") |
| Alias examples | "Curious Fox", "Sleepy Owl" | "Grumpy Elf", "Distracted Reindeer" |

Both themes need the same set of assets:

- **Palette**: background, surface, text, muted text, primary, accent, success, warning, danger, as named tokens.
- **Header illustration** for the edition page and edition emails.
- **Empty-state illustrations**: no group yet, empty wishlist, "Surprise me!", chat locked, draw not yet run.
- **Reveal animation**: plays once, on the first reveal, around the name. It needs a reduced-motion version.
- **Anonymous avatar**: one avatar for "your Secret Santa", identical for everyone.
- **Alias avatars**: at least 60, flat and simple, still distinct at 32 px. Each has a fixed name per language.
- **Theme picker preview**: a small card used in S09, S10 and S26.

The app shell (landing, sign-in, home, account, instance admin) uses a neutral brand that sits comfortably beside either theme.

## Components and states

These pieces repeat across screens. Designing them once, with every state, covers most of the app.

| Component | States or variants | Used in |
| --- | --- | --- |
| Hold-to-reveal button | Idle, holding (filling), revealed, released, focus, reduced motion | S14 |
| Status chip | Invited, Confirmed, Draw checked | S13, S22 |
| Wishlist icon | Published, "Surprise me!", not yet | S13, S19 |
| Participant row | Plain, with admin badge, with admin actions | S10, S13, S23 |
| Group card | Next-step chip, unread badge, no current edition | S08 |
| Next-step card | Confirm, write your list, ready, check your draw | S11, S12 |
| Wishlist item row | Text only, with details, editing, reordering, read-only | S16, S17, S19 |
| State banner | Draft, published, archived, draw changed | S14, S16, S31 |
| Message bubble | Mine, theirs, alias, system, removed | S20, S21, S22 |
| Question chip | Preset question, preset answer | S20, S21 |
| Code input | Empty, filling, error | S03 |
| QR card | With link and share action | S24 |
| Confirmation sheet | Neutral, danger, type-to-confirm, blocked | S25, S27, S28, S33 |
| Countdown | Days left, today, past | S08, S11, S12 |
| Theme picker | Generic, Santa, locked | S09, S10, S26 |
| Empty state | Illustration, one sentence, one action | S08, S15, S19, S22 |
| Banner and toast | Offline, error, saved, copied | S36 |

## Main flows

Six paths cover almost every visit. Each should feel short: the person arrives from an email or a link and reaches their goal in two or three screens.

| Flow | Who | Path |
| --- | --- | --- |
| Set up the first exchange | Organizer | S01, S02, S03, S06, S09, S24, then S11 |
| Join from a link or QR code | New participant | S05, S02, S03, S06, S11, then S15 |
| Draw day | Admin, then everyone | Admin: S11, S25. Everyone: E4, S12, S14, then S19 for the recipient's list |
| Ask a question anonymously | Giver, then recipient | Giver: S14, S21. Recipient: S16, S20 |
| The chat opens | Everyone | E6, S22 |
| Next year | Admin, then members | Admin: S30, S10. Members: E3, S32, S15, S17, S16 |

Two rarer paths still need a design: a participant leaving after the draw (S13, S27, then E5 and the "changed" state of S14 for one person), and the last admin stepping down (S28 or S33, blocked until another admin is named).
