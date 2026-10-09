# Design System: iRent Semarang — Pastel Workspace

## 1. Reference and intent
New, separate Stitch project: 7448049823013098704. Reference studied locally: original-a26de1dbe8246317e0ab8b8f25082c62.jpg, a white task workspace on a grey canvas, narrow pale sidebar, understated top search, airy four-column board, tinted pastel task notes, dark primary buttons, fine outlines and rounded corners. Translate its visual composition, not its task-management business model. Do not copy its tiny typography, cramped cards, purple logo, avatars or fake project progress bars. The MCP generation interface accepts text rather than this local JPG; this description conveys the reference.

PRD.md remains authoritative for business rules, including the 9 October decision: PWA only in phase 1, WhatsApp and calls deferred. All screens use Indonesian. ../../DESIGN.md is the canonical visual guide; this document translates it into Stitch prompts. The old Stitch project remains intact. Use stitch-design-taste with explicit adaptations: Poppins-only overrides suggested font pairings; usability overrides perpetual motion and decorative asymmetry. Density 4 customer / 5 admin, variance 3, motion 2. Existing FIX screens represent workflow coverage; they still need the content reduction and hierarchy below. Updating these files does not regenerate Stitch screens.

## 2. Palette and atmosphere
Quiet matte white software workspace, light neutral background, generous four-sided gutters, soft pastel accents like paper notes. No hero marketing or giant metrics on dashboards.
- Canvas #F1F2F4, workspace #FCFCFD, surface #FFFFFF, sidebar #F8F9FA.
- Ink #24262B, muted #606570, line #E6E8ED.
- Single brand accent rose #A34B70; pale selected rose #F9E8EF. Primary action charcoal #292B31 with white text. No purple/neon logo or buttons.
- Pastel classification fills: blue #EAF1FC (payment review), apricot #FFF0DE (pickup/preparation), lilac #F1ECFB (extension), mint #E8F5EE (verified completion), blush #FBECEE (return review). These are soft task-type backgrounds, not extra CTA colors. Lilac is only a background, never a primary accent.
- Urgency is independent: red ink #A12A39 on #FFF0F1; warning #855300 on #FFF5DF; success #176345 on #EAF6EF.
Labels and icons explain status; color alone conveys nothing. Normal text minimum contrast 4.5:1. No gradients, glass blur, glossy effects or pure black.

## 3. Typography
Poppins for every heading, paragraph, number, input, button, table and badge. No Inter, serif or mono. Explicitly import Poppins 400/500/600. Desktop/mobile: page title32/28px, section22/20px, primary item title20/18px, focal money/deadline28/24px, body/controls16px, metadata14px. A narrow task queue uses item18px/focal20px/metadata14px. Title and focal value use600, controls500, metadata400. Never shrink deadlines, money or state below14px. At most three content sizes per card; controls remain16px. Choose ONE focal value, not every amount enlarged/bold. Body line-height1.5–1.6. Numeric values use tabular-nums and right alignment, still Poppins. Sentence case. Rp120.000 and 10 Okt 2026, 11.30 WIB; show absolute time with secondary countdown.

## 4. Layout and components
Desktop 1440px: 32px exterior inset on grey canvas, white app shell with 20px corners, 224px sidebar, 72px understated top header; content gutters 32px and bottom 48px. Shell fits viewport minus gutters and expands/scrolls as needed; do not clip content. Main maximum 1360px admin and 1200px customer. Header has search, page context, notifications and account. Sidebar grouped operational navigation, settings near bottom. All admin roles equal; no Super Admin.
Spacing scale 4/8/12/16/20/24/32/40/48/64. Panel padding 24px, task padding 20px, task gap 16px, column gap 20px. Panels 16px radius, task notes 12px, controls 10px. Thin neutral lines and minimal shadows; shadows only floating drawers.
Kanban only for prioritized task queues, 4 columns desktop when readable: Pembayaran, Serah terima, Pengembalian, Perpanjangan. Counts, clear headings, 2–3 example tasks per column, contextual actions. NO dragging to approve, change bookings, transfer money or mark units ready. Status changes require explicit business actions.
Dense data uses clean lists/tables, not nested cards. Details use restrained 2:1 work area / summary, history below. One primary action per decision group. Forms labels above, inline errors, 44px targets. Proof preview is private and illustrative; no real QR payment code, NIK, bank details or secret.

Summary cards have a strict content budget: item/task title, ONE main status badge, at most TWO metadata rows, ONE focal amount/deadline, and ONE main action plus a quiet detail link. At most five core facts; no fixed card height and no clipping of decisive text. Other statuses remain distinct and appear as labelled plain text when necessary for the decision. At most one short helper sentence, around12words. No paragraphs of SOP, legal terms, entire price tables, identities, bank proofs or transaction history inside a summary card. Do not repeat every label inside another bordered box. Catalogue cards show actual product photo, model, selected-duration price, availability and selection action; other packages/content/gallery are on detail.

Separate overview, work detail and confirmation. Overview answers what needs attention next; detail holds price breakdown, per-unit schedules, proof and history; confirmation shows amount, affected units and consequences. Decisive short-payment/conflict/refund/deadline warnings remain visible before action, not hidden inside help. SOP/technical formulas belong in contextual help, not dashboard paragraphs. Forms and detail sections use flat headings/dividers. Alternative states are separate variants, not all visible simultaneously. Preserve all functions across the flow rather than printing the entire PRD on each screen.
Mobile 390px: 20px gutters, 24px vertical gaps, drawer navigation, 44px touch targets. Board becomes tabs plus a single task list, never four squeezed columns or sideways overflow. Tables become records with visible money/deadline/action. One-column forms and safe-area padding.

## 5. Motion and notification states
150–220ms opacity/transform feedback only, no pulse, perpetual loops, floating cards or decorative load animation. Honor reduced motion. Skeleton, empty with contextual action, inline error, disabled, submitting, success and offline states. Prevent duplicate submits and preserve input after errors.
PWA setup: install guidance, permission denied/not supported, enabled, offline, retry/error history. Active dashboard has "Aktifkan suara", "Nonaktifkan suara", and "Saya tangani". Foreground sound every 10 seconds requires user activation; local acknowledgement mutes that task version, does not approve payment, and may reset on reload. Stop sound when tab hidden/tasks cease/logout. Background push does not guarantee alarm, sound, punctual delivery or bypass Focus/silent. Reminders H-30/H-15/H-5, relevant overdue alert, retain allocation. WhatsApp labelled "Ditunda"; no WA call/action in phase 1.

## 6. Non-negotiable business representation
These are behaviour constraints for designers, not copy to paste into every card. Display the relevant result and brief reason at the decision point; keep full policy/technical explanations in detail/help. State variants below must be designed separately.
Customer books and immediately pays/uploads without waiting for admin. Upload means "Menunggu verifikasi pembayaran", NOT paid. Admin checks actual bank receipt and explicitly verifies/approves. Booking, proof, payment, extension, return and refund statuses are separate.
Initial rentals 6/12/24 hours or multiples of 24 through 168; extensions 6/12/24 per selected unit. Same prices weekdays/weekends. Operational hours 08.00–22.00 WIB, minimum initial lead 2h, 12h starts no later than 10.00. Return time computed; invalid options disabled with explanation. Calendar horizon follows PRD month rule, not rolling 30 days. Max 1 iPhone plus accessories; accessories-only allowed.
DP flat, not per item/day; small total at/below configured DP requires full payment. Urgent booking 2–3h lead: upload within 30min, confirmation min(upload+1h,pickup−1h); ordinary upload 2h, confirmation min(upload+24h,pickup−1h). Server deadlines do not reset on refresh/reupload. Proof JPG/PNG/PDF max 2 MB. Insufficient/extra funds, rejected proof versus rejected booking, reconciliation and refunds need distinct states.
Fair allocation first successful atomic reservation, not first click. Conflict screen preserves selection, offers alternative time/unit, never silently books unavailable stock.
Extensions select individual units, exact scoped full price, extra delivery quote if required; submit creates additional hold 30min. Old return schedule stays until approval; collision/late application blocks extension, initial rental protected. Multi-unit proposal approved/rejected together.
Customer reports return per unit; admin verifies actual receipt/time/condition. Then 1h preparation and explicit admin completion; timer alone never marks ready. Maintenance closes then preparation. Partial return, lateness, damage, loss and future-booking risk represented. Replacement same model after availability check; no automatic cancellation.
Refund request approval and "Catat uang dikembalikan" are separate manual actions. Customer cancellation >48h: 50% paid DP or 75% full payment; <=48h none. Store fault/rejection, excess or failed obligation reconciled funds and rejected extension refunded fully in relevant scope. No-show 3h after pickup: DP retained, verified excess over DP refunded; distinguish store delivery delay.
Cash reports count actual verified incoming receipts minus actually transferred refunds, pending proofs/approved unpaid refunds excluded. Completed rental is not necessarily paid; successful transactions require completed + fully paid. Loss closure remains visible.
Customer profile requires name/address/active phone/NIK before booking, no invented KTP verification upload. Admin sees NIK only authorized detail. Identity privacy, logs and private proofs maintained.

## 7. Screen coverage inventory
Produce individual named screens, not a collage; menus alone do not count as designing functions.
A01 Admin urgent task board.
A02 Admin booking detail + bank payment review, short/excess/rejected/reconciliation states.
A03 Admin per-unit schedule/calendar + holds/preparation and future risk replacement.
A04 Admin handover/return + partial receipt, fees, damage, loss, preparation/maintenance.
A05 Admin extension review + quote, conflict, original/new schedule, decision.
A06 Admin refunds + approve versus actual transfer and evidence.
A07 Admin inventory/item/unit CRUD + package, prices, readiness and maintenance.
A08 Admin customers/accounts + profile detail, reset password and admin account creation.
A09 Admin cash reports/successful transactions + daily/monthly Excel, pending liabilities.
A10 Admin settings + zones CRUD, rental rules, QRIS config, PWA permission/foreground sound states, WA deferred.
C01 Customer dashboard/history with urgent payment and active rental.
C02 Customer catalogue/item detail and time-aware availability.
C03 Customer booking wizard with 5 step states/summary/consents and conflict alternatives.
C04 Customer payment/upload with urgent deadline, rejected/short payment and pending state.
C05 Customer booking detail + per-unit extension/return/cancellation/refund/history.
C06 Customer login/register and manual admin password-reset assistance.
C07 Customer profile completion + terms/about information.
M01 Mobile admin urgent queue and active sound controls.
M02 Mobile customer payment/upload.
Each flow includes key alternative states as separate variants, drawers/modals or supporting screens; do not stack all states into the normal screen or one card. No invented policies. Data is clearly marked "Data contoh".

## 8. Review gate
Review actual Stitch screenshots and HTML where available: font, gutter, hierarchy, pastel restraint, visible deadlines and sums, no clipped controls, correct status/action relationships. Reject summary cards that exceed the content budget, use uniform14–16px text for title/value/metadata, contain SOP paragraphs, or display multiple mutually exclusive states. A five-second scan should reveal item, focal value and next action. Product imagery must render. Link screen IDs to this inventory and list remaining gaps. A visual prototype does not implement or prove backend authorization, concurrency, file privacy, accessibility, exports, sound or push delivery.


## 9. Delivered workspace
The separate Stitch project is https://stitch.withgoogle.com/projects/7448049823013098704. Use the 36 FIX screens: 17 desktop pages, 17 dedicated mobile adaptations, plus the two earlier focused mobile examples. Superseded canvas versions are labelled DRAFT and positioned separately. See ../../STITCH_REDESIGN.md for the final requirement mapping, review findings and implementation limits; screens.latest.json identifies the latest source and canvas instances.

## 10. Mobile coverage and item photography
Every A01–A10 admin page and C01–C07 customer page needs a dedicated mobile adaptation, named MA01–MA10 and MC01–MC07. M01 and M02 remain focused mobile queue/payment examples. Design at 390px, with a layout intended to adapt down to 360px: single-column content, 20px side gutters, Poppins, 44px targets, labelled inputs, visible absolute deadlines and money, no page-wide horizontal overflow. Use drawer navigation for admin and at most five primary destinations for customer bottom navigation. Reserve bottom space for sticky actions, navigation and safe areas. Forms and modal/drawer content must scroll naturally; do not disable zoom or hide essential actions to fit one viewport.

Item imagery is mandatory on desktop and mobile catalogue/item detail. Use recognisable iPhone and accessory product photographs, not generic icons, avatars, descriptive placeholders or unrelated stock images. Neutral backgrounds, object-fit contain, no cropping of the device. Catalogue photographs should be visibly large (about 160px desktop, 140–180px mobile); detail cover photography should be about 240–280px tall, with gallery thumbnails. Keep price, availability and the next action readable alongside the image. Booking selections, summaries and active rental details use compact 56–72px item thumbnails when useful. Admin item management includes visible item photos and cover/gallery management controls; these are visual controls until implemented. Provide descriptive alt text, loading skeleton and missing-image fallback. Demo imagery must be replaced with authorised actual inventory photos before release; image preview does not establish a storage/API policy.

## 11. Prompt contract
Generate one named screen and one primary state at a time. Specify the user goal, initial visible content, detail-only content, focal value, title/value/metadata sizes and main action. Do not ask for all PRD scenarios to appear together. Example: "MC04 mobile390px, awaiting proof upload. Poppins. Item thumbnail64px, title18px, pay-now amount24px, metadata14px. Summary has item, one status, schedule, actual payable amount, absolute upload deadline and one upload action. Cost breakdown and terms are in the relevant detail section. Rejected-proof state is a separate variant. White/grey surfaces, restrained pastel,20px gutters. Do not add SOP paragraphs or badges for every field."
