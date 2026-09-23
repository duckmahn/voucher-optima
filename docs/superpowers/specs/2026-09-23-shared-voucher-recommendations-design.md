# Shared Voucher Recommendations

## Intent and approved experience

Any signed-in user can import a Shopee voucher link, review its terms, and
explicitly share it with everyone. Guests can browse recommendations and use a
supported voucher in the existing calculator. Contributors can edit and remove
their own submissions. Shared vouchers carry their source and verification status;
duplicates resolve to one entry and expired vouchers leave the public feed.

Private saved vouchers and comparisons remain private. Importing a link alone
does not publish anything.

## Approach

Extend the existing Cloudflare Worker and D1 backend with a separate shared
voucher resource. Reuse the Next.js proxy, Google sign-in, form controls, and
calculator. This keeps ownership and publication enforcement on the server.

A static curated list would not support community submissions. A scheduled
crawler would introduce operational work without resolving the current lack of
public voucher terms. Neither is needed for this release.

## Importing Shopee links

The supplied example, `https://s.shopee.vn/1LfyvMcyzE`, resolved during investigation
to a Shopee search campaign containing `promotionId=1499724412129280`, rather
than a product URL. The fetched HTML did not expose its voucher terms. The existing
product importer expects shop/item IDs and cannot handle this campaign as a voucher.

A dedicated importer accepts HTTPS links on `s.shopee.vn` and `shopee.vn`, resolves
up to five redirects, and validates the exact hostname and protocol at every hop.
Reject credentials, nonstandard ports, and other hosts. Bound request time and
response size. Do not fetch arbitrary user-supplied URLs or use authenticated
Shopee sessions.

Extract campaign identity and voucher terms only from observed, documented-in-code
response shapes or unambiguous visible text, with fixtures supporting each parser.
Do not invent an undocumented voucher API or interpret a product sale percentage
as a voucher discount. Missing terms remain null. A blocked or client-rendered page
produces a usable manual-entry draft with a clear explanation, not fabricated data.

The server stores a short-lived import draft with normalized source URL,
deduplication key, extracted fields, and retrieval time. Publish requests reference
this owner-bound draft; clients cannot claim server verification. Expire unused
drafts after 24 hours and clean them during subsequent imports.

## Terms and verification

Common fields: title, source URL, optional voucher code, minimum spend, expiry,
optional start time, and a short plain-text eligibility note. Support percentage,
fixed-amount, and shipping/other offer categories for display. Percentage offers
require a percentage and explicit cap; fixed offers require an amount. Unknown
terms must be completed before sharing. Unknown expiry must also be supplied.

Use whole VND amounts, finite nonnegative values, percentage in (0, 100], positive
discount amounts/caps, and a future expiry. Validate the same constraints server-side
and in the form. Interpret datetime inputs in Asia/Ho_Chi_Minh and store UTC epoch
seconds; label the timezone in the UI. Bound title, code, notes, and URL lengths.

Labels describe provenance, not checkout eligibility:

- **Fetched from Shopee:** all required offer terms were extracted by the server,
  and published values match the import draft. Show the retrieval timestamp.
- **Community-submitted:** one or more required terms were supplied or changed by
  the contributor. Subsequent edits to offer terms use this label.

Display eligibility notes and a link to check the offer on Shopee. Do not claim
that an offer is available to every account or can be stacked with other offers.

## Storage and duplicate handling

Add `shared_vouchers` and `voucher_import_drafts` tables using additive,
idempotent schema SQL. Include owner ID, timestamps, terms, source identity, and
provenance. Public responses never expose owner IDs, emails, or import drafts.

Use a unique server-generated source key: Shopee promotion ID when present;
otherwise the normalized resolved URL, retaining identity parameters and stripping
known tracking parameters. For sources without a distinct promotion ID, include
voucher code when available. Concurrent duplicate publications return the existing
entry instead of inserting a second row. They do not overwrite its terms, change
ownership, or renew its expiry. Describe this behavior as merging duplicates in
the UI, not as granting edit access to another contributor.

An owner's source identity is immutable on edit; a different campaign needs a new
import. Owners can update terms/expiry or delete their entry. A separate authenticated
“My shared vouchers” view includes expired submissions so owners can manage them.

## API and authorization

Worker routes:

| Route | Access | Behavior |
| --- | --- | --- |
| `GET /shared-vouchers` | Public | Active entries, newest first, cursor pagination; 20 default, 50 maximum |
| `GET /shared-vouchers/mine` | Signed in | Current user's entries, including expired, with pagination |
| `POST /shared-vouchers/import` | Signed in | Resolve and extract into an owner-bound draft |
| `POST /shared-vouchers` | Signed in | Validate and publish draft, or return existing duplicate |
| `PUT /shared-vouchers/:id` | Owner | Validate and update terms |
| `DELETE /shared-vouchers/:id` | Owner | Remove submission |

The proxy permits unauthenticated requests only for the exact public GET route,
forwards query parameters, and adds PUT support. All existing private routes retain
authentication. Public responses are identical for signed-in and guest readers;
ownership controls come from the private “mine” response. Private responses use
`Cache-Control: no-store`. Worker writes derive ownership from the verified session,
never request JSON. An owner mismatch returns 404 without revealing private details.

Errors must preserve their intended status. The current authentication middleware
wraps downstream handlers in its token-verification catch; narrow that catch so
validation or upstream failures are not mislabeled as invalid sessions.

## Interface and calculator integration

Add a Recommended vouchers section on the home page, with a load-more control,
empty/error/loading states, and a Share a voucher action. Guests see a sign-in
prompt for sharing. Signed-in users get an import-and-review form and a My shared
vouchers view with edit/delete actions. Announce import and publication results
accessibly, prevent duplicate submissions, and discard stale import responses when
the source link changes.

Cards show terms, code if available, expiry in Vietnam time, provenance, eligibility
notes, and source link. Render external text as text, not HTML.

Use voucher copies supported percentage terms into `VoucherForm`, preserving the
user's product context, clears any outdated calculation result, and brings the
form into view. It does not save a private voucher or automatically submit a
calculation. Fixed-amount, shipping, and uncapped offers show “View on Shopee”
instead; expanding the calculator's arithmetic and persistence model is out of scope.

## Verification and delivery

Test redirect allowlists, redirect limits/timeouts, campaign identity, tracking
normalization, missing/blocked content, and every supported extraction fixture.
Use synthetic fixtures only as parser tests, never as proof of live extraction.
Test validation, draft ownership/expiry, unforgeable provenance, atomic deduplication,
public pagination, expiry boundaries, guest read access, rejected guest writes,
cross-user edits/deletes, and preservation of private route protection.

Verify the additive schema against local SQLite/D1, run root and Worker tests,
TypeScript checks, relevant lint, and the Next.js production build. Exercise the
import/review/share/use flow and owner controls in the UI. Report any pre-existing
lint failures separately. Document migration and deployment requirements; do not
claim live deployment from local verification. The current Wrangler configuration
still contains a placeholder D1 database ID.

## Explicit limits

No scheduled crawling, admin moderation workflow, voting, universal checkout
eligibility guarantee, or changes to private voucher storage. The supplied link
must at least resolve into a manual-completion draft; automatic extraction of its
discount and expiry is contingent on accessible source data and must be reported
honestly if unavailable.
