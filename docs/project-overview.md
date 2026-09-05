# SHOPITFORME — PROJECT OVERVIEW
A plain-language but technically accurate walkthrough of how this whole
system works. Written to learn from, not as marketing copy.

The one idea that explains most decisions in this codebase:
  THE AI PROPOSES. DETERMINISTIC CODE DECIDES AND EXECUTES.
An LLM can suggest a product, suggest a discount, suggest cancelling an
order — but it never has the power to actually charge money, apply a
discount amount, or change a database row by itself. Plain code (Zod
schemas, if/else checks, DB writes) always sits between "the AI said so"
and "something real happened."


## 1. THE AGENTS — DEEP DIVE: HOW THEY'RE ACTUALLY BUILT
There are two separate agents in this codebase. They share no code with
each other — separate tool files, separate system prompts, separate loop
files — on purpose, so one can change without risking the other. But
they're built on the exact same mechanism, so understanding one teaches
you the other.

1.1 THE MECHANISM: WHAT A "TOOL-CALLING LOOP" ACTUALLY IS
The engine underneath both agents is the Vercel AI SDK's `generateText`
function, called with a `tools` object. This is NOT "ask the model a
question, get text back." It's a real loop:

  1. The model receives the system prompt, the conversation history, and
     a LIST OF REAL FUNCTIONS it's allowed to call (each described by a
     name, a plain-English description, and a Zod input schema — the
     exact shape of arguments it's allowed to pass).
  2. The model decides: reply with text, call one or more of those
     functions, or both.
  3. If it calls a function, the SDK actually runs the real JavaScript
     function on the server, with whatever arguments the model chose,
     validated against that Zod schema first (a malformed call is
     rejected before it ever touches your code).
  4. The function's real return value goes BACK to the model as part of
     the conversation, and the model gets to think again — now with real
     data instead of a guess.
  5. This repeats until the model stops calling tools and just replies,
     or a hard cap on how many rounds this can go through is hit.

Each one of those rounds is called a "step" in this codebase. A step can
contain zero, one, or several tool calls (the buyer agent's system prompt
explicitly tells it to fire search_products and web_search_products in
the SAME step, in parallel, since neither depends on the other's result —
this is a real perf choice, not an accident).

The hard cap on rounds is `stepCountIs(N)` — the buyer agent allows 8
steps per turn, the merchant agent allows 10 (it legitimately needs to
chain more reads for a "how's my business doing overall" question:
analytics, then diagnosis, then catalog, before it can answer well). This
is what makes "bounded" a real, enforced number rather than a design
intention — the loop CANNOT run forever, and the real count used vs. the
cap is tracked (`stepsUsed` / `stepBudget`) and surfaced live in the
observability app as a segmented bar.

Both loops also carry a real wall-clock timeout (35s for the buyer agent,
60s for the merchant agent — higher because a cold catalog-readiness grade
can involve several sequential LLM batch calls the first time it's asked)
so a genuinely stuck upstream call fails loudly instead of hanging the
request forever.

1.2 EVERY TOOL IS A REAL FUNCTION, NOT A PROMPT TRICK
Nothing the agent "knows" is baked into the prompt as a fact. Every single
number, name, price, or status it states in a reply had to come from
actually calling one of these functions this turn — the system prompt for
both agents says this explicitly and repeatedly ("never state a number you
did not just get from a tool call this conversation"). Here is every tool
the buyer agent has, and why it's shaped the way it is:

- search_products — the ONLY source of what's actually purchasable.
  Returns real rows (id, name, price, brand, category, stock, image,
  merchant_id) capped at 8 results. Every other product-shaped answer in
  the app traces back to this.
- web_search_products — a real web search (via Tavily), fired in the SAME
  step as search_products, not as a fallback. Structurally prevented from
  ever becoming a purchase: its results carry no product_id shape at all,
  so there's no code path from "found on the web" to "added to cart" even
  if the model tried. Capped at 3 calls per conversation (a module-level
  counter keyed by conversation_id) specifically to protect a live demo
  from burning the whole external-API budget on one chat.
- propose_purchase — confirms ONE specific product as "this is what they
  want to buy right now." This does not charge anything — it hands off to
  a completely separate, deterministic checkout UI flow (see the Backend
  section). The agent's job ends at "here's the product"; a human
  confirms address/shipping/payment afterward through ordinary UI, not
  through more agent turns.
- add_to_cart — same product-resolution logic as propose_purchase, but for
  "add this, I'm still browsing." The rule that a cart can only hold one
  vendor's items at a time is enforced by the cart code itself, not by the
  agent being asked nicely — if the tool call is for the wrong vendor, it
  comes back rejected and the agent just reports that plainly.
- process_shopping_list — takes a whole pasted list and, for each line,
  searches and returns up to 3 real candidates. It deliberately does NOT
  pick one and add it — that was tried and explicitly rejected earlier in
  this project's history, because a shopper needs to see "Onion (1kg)" vs
  "Onion (Loose) 500g" and choose, not have one silently guessed. Capped
  at 15 items per call (each line is a real catalog search).
- get_wallet_status — checks whether the customer has an active spending
  approval before the agent ever implies it can check out.
- get_order_history — returns orders newest-first, but the model is told
  to pass a SMALL limit matching the actual question ("my last order" →
  limit 1). The response always carries an explicit total_count separate
  from the (deliberately truncated) list, and the system prompt forbids
  the model from ever counting the array itself — a truncated list counted
  by hand gives a wrong number.
- get_order_details / get_order_activity — full detail on one order, and
  the real step-by-step audit trail behind it (see Backend section) turned
  into plain English. The system prompt tells it to relay those sentences
  AS WRITTEN, never soften or reinterpret them, because they carry the
  actual figures that made the original decision.
- propose_cancellation — checks whether an order CAN be cancelled and
  whether that would be an outright cancel or a refund (based on real
  delivery-stage timing), and returns that as a proposal. It cannot
  cancel anything itself — the app renders a confirm button, and only a
  real tap on that button calls the actual cancel endpoint.
- get_available_coupons, browse_catalog, get_product_details, get_invoice,
  get_spending_stats, get_profile — straightforward real reads, included
  specifically so "can you check my account" questions always have a real
  tool to reach for instead of the agent refusing or guessing.

The merchant agent's tools are all read-only by design — there is no
write/money-moving tool on this surface at all:
- get_merchant_stats / get_recent_orders — quick headline numbers.
- get_sales_analytics — the deep one: trends, best/worst sellers,
  categories, brands, customers, repeat rate, payment failures, refunds.
  The system prompt tells the agent to prefer this for open-ended
  questions rather than reaching for five narrow tools.
- get_low_readiness_products — wraps the SAME shared function the
  Catalog page itself calls (not a reimplementation). This is the one
  merchant tool that internally runs a real bounded LLM call of its own
  (see 1.4 below).
- get_inventory_status, get_upsell_performance, get_campaign_performance —
  narrow, specific reads for their named topic.
- diagnose_business — joins sales + catalog quality + stock into one
  ranked "what's actually wrong" answer, so a vague "how am I doing"
  question doesn't require the merchant to already know which five tools
  to ask for.

Both tool files share a `traced()` wrapper around every single tool's
`execute` function. That wrapper is what makes the rest of this section
possible — see 1.5.

1.3 THE GUARDRAILS ARE IN THE SYSTEM PROMPT, NOT JUST THE CODE
Some rules are enforced by code (a cart can't mix vendors — that's a real
check). Others are enforced by explicit, repeated instruction in the
system prompt, because they're about HOW the agent talks, not what it's
allowed to touch:
- "Never state a price, stock count, balance, order detail, or spending
  figure you did not just get from a tool call this conversation."
- "Never count things yourself... every count you cite must be read from
  an explicit count field" — because a tool result is often a truncated
  sample, and a model tallying array entries by hand will confidently
  report a wrong total.
- The merchant agent specifically: "NEVER cite industry benchmarks,
  competitor data, or 'typical' conversion rates — this platform has no
  such data and you have no way to verify it."
- "Don't turn a small sample into a trend" — if there are only a couple
  of orders, say the data's too thin rather than describing a pattern.
- Return ONLY as many records as were actually asked for ("my last
  order" ≠ "my recent orders" ≠ "all my orders").

1.4 BOUNDED OUTPUT: WHERE THE AGENT'S OWN JUDGEMENT GETS FENCED IN
A few things in this system need an LLM's judgement, not just a lookup —
grading whether a product description is specific enough, or judging how
well a product matches a customer's stated taste. Anywhere that happens,
it goes through `generateObject` with a strict Zod schema instead of free
text, so the model is physically constrained to fields you defined (a
number in a range, a string under N words) — it can't smuggle extra
claims outside that shape. Catalog readiness grading is the clearest
example: the model returns exactly {product_id, score 0-100, one-sentence
verdict, issues[]} per product, and the prompt explicitly forbids it from
inventing product facts or writing replacement copy — it grades what's
already there, nothing else.

1.5 PRODUCT FIT SCORING — THE BUYER APP'S "WHY THIS ONE" SCORECARD
Every product shown in the picker gets a small scorecard, not a bare
number. Three of its four criteria are plain arithmetic against real data,
computed in code, zero LLM involved — so they're identical every time and
a customer could verify them by hand:
  - Value: this listing's price vs. the real median price of other
    listings in the same category (read straight from the catalog, not
    the customer's spending limit — that number answers "can the agent
    afford this," not "is this a good price," so re-using it here would
    have been the wrong question).
  - Availability: real stock count.
  - Relevance: real word-overlap between what the customer typed and the
    listing (with simple plural/singular folding, e.g. "tomatoes"
    correctly matches a listing called "Tomato").
Only the fourth criterion, matching the customer's saved shopping
preferences, is a genuine judgement call — and it's forced to quote the
exact phrase from the saved preference it used, in a field called
matched_on, so it can never claim a match against something the customer
never actually said. Scoring a whole result set (e.g. 8 search results) is
ONE batched model call, not one call per product — otherwise a single
search would burn 8 calls against a shared per-minute quota for zero extra
information.

1.6 EVERY TOOL CALL LEAVES A REAL, TIMED TRACE
Wrapping every tool's execute() function is a small piece of shared
infrastructure (services/ai/traceUtils.js) that, for every single call,
without exception, records:
  - the real wall-clock start time (captured before the call runs) and
    end time (after it resolves) — so duration is a true measurement,
    correct even when two tools run concurrently in the same step and
    finish at different real speeds, never guessed from array order.
  - an "outcome" (ok / denied), read from real signals the tool's own
    result already carries (an `error` field, or `eligible: false`) —
    never a separate, invented judgement.
  - a "lane" — code, or ai — depending on whether that specific call
    internally ran a bounded generateObject call (catalog readiness
    grading is the one buyer/merchant-agent tool that does) or was a
    plain deterministic function. This is the literal "AI proposed vs.
    code decided" split made into a real field on real data, not just a
    slogan.
This is the same data that both feeds the live observability app (see the
Extraordinary Features section) and is available to reconstruct exactly
what a given reply was based on.

1.7 GETTING RESULTS OUT OF THE LOOP AND INTO THE UI
generateText's result includes every step the loop went through. Both
loop files scan that (searching backward for the LAST call of each tool
name — e.g. "the last time propose_purchase was called this turn") to
pull out the specific pieces of structured data the frontend needs to
render real UI: the proposed product, the search candidates, the order
history rows, the cancellation proposal, and so on. The model's own text
reply is just one field among many returned — the actual cards, buttons,
and lists the customer sees are built from the tool results directly, not
from the model narrating them.

1.8 STYLE, NOT FACTS, LEARNS FROM FEEDBACK
Thumbs up/down on a reply doesn't change any fact the agent knows. It
feeds a short block of recently liked/disliked reply excerpts back into
the NEXT system prompt as tone steering ("lean toward this style / move
away from this style") — genuine in-context reinforcement on phrasing,
explicitly never treated as a source of facts, and never anything close to
retraining a model.


## 2. THE BACKEND — HOW THINGS ACTUALLY GET DONE
Node.js + Express, with Supabase (Postgres) as the database. Every table
has a matching in-memory fallback so the app still runs with zero setup
if Supabase isn't configured — same code path either way, just a
different storage backend underneath.

THE DETERMINISTIC CORE: checkout is NOT part of the chat agent's tool
loop. It's a separate, ordinary function (executeCheckoutSequence) that
re-checks everything from scratch right before money moves:
  1. Re-fetch the real product and its real current price (a customer's
     price can never be trusted from what the chat displayed earlier —
     if it changed, the charge is refused, not silently adjusted).
  2. Check real stock.
  3. Check delivery is possible to the address.
  4. Check the store's own policy rules.
  5. Check the spending mandate/token actually covers the full total.
  6. Only then: create the order and charge.
Any step failing returns a specific status (PRICE_CHANGED, OUT_OF_STOCK,
AUTHORIZATION_EXCEEDED, POLICY_BLOCKED, ...) instead of a generic error —
that status is what later gets turned into a plain-English explanation.

THE AUDIT TRAIL: every money-relevant action (mandate approved, order
created, payment failed, refund issued, coupon applied, cancellation) is
written as one row to an append-only audit_records table — "append-only"
enforced at the database level (UPDATE/DELETE are revoked), so it can't be
edited after the fact. Each row carries who did it, what happened, the
decision (ALLOWED/DENIED), and a reason string with the real numbers that
were compared. A separate function (services/commerce/explain.js) turns
those raw rows into a plain sentence a customer can read — but the
numbers themselves always come from the row, never invented on the spot.

DISCOUNTS/COUPONS/CAMPAIGNS: the client only ever sends a CODE. The server
always re-looks-up that code and re-calculates the discount amount itself
— a client can never say "give me ₹500 off," only "here's the code I have,
you tell me what it's worth."

RATE-LIMIT HANDLING: every real LLM call in the codebase sets
maxRetries: 0, so a rate-limited call fails fast and visibly instead of
the AI SDK silently retrying for minutes with no error logged. The one
place that DOES retry on purpose (catalog readiness grading, which grades
many products in batches) has its own single, logged retry that honours
the exact cooldown Google's API reports, and results are cached for ten
minutes with duplicate concurrent requests sharing one in-flight grading
pass instead of each starting their own.


## 3. RAZORPAY — WHERE AND WHEN IT'S ACTUALLY USED
Razorpay is the real payment gateway. It shows up in a few distinct
places, all inside src/services/payments/razorpay.js:
- Setting up a spending mandate/token (createAuthorizationOrder,
  confirmAuthorizationToken) — the "pre-approve the agent to spend up to
  ₹X" flow, done once through Razorpay's real Checkout.js.
- One-time checkout (createOneTimeOrder, verifyOneTimePayment) — a normal
  single purchase paid by card.
- Charging against an already-approved mandate (executePayment) — the
  recurring/token charge used when the agent checks out on the customer's
  behalf without them present.
- Refunds (refundOneTimePayment) when an order is cancelled or returned.

HONESTY ABOUT WHAT'S REAL: every one of those functions returns a
`simulated: true/false` flag. If there are no live Razorpay keys, or the
mandate hasn't completed real authorization yet, or (documented case) the
recurring-charge API is confirmed broken on this test account, the code
falls back to a clearly-tagged simulated charge instead of pretending. No
UI ever shows a simulated payment as if it were real money moving.

WEBHOOKS: a dedicated route (POST /webhooks/razorpay) receives Razorpay's
own async confirmations (payment.captured, payment.failed, order.paid,
refund.created). Every delivery is HMAC signature-verified before anything
else happens, deduplicated by Razorpay's own event id (so a retried
delivery can't double-process), and always logged to the audit trail as
WEBHOOK_RECEIVED even for event types the app doesn't act on. This webhook
path is the actual source of truth for payment state — the client-side
"it looked successful" moment is hardened, not replaced, by it.


## 4. THE FRONTENDS
Four separate apps, each its own Vite/React project, no shared frontend
code between them on purpose (so one can change without risking the
others). All of them talk to the same one Express backend.

- frontend-storefront — the original, simpler storefront.
- frontend-ai-buyer ("RazeGPT") — the main chat-first buyer experience:
  a product picker with the fit scorecards described above, a running
  cart, a checkout flow, order history/cancellation, and the full agent
  chat.
- frontend-merchant ("Payzorray") — the merchant dashboard: stats,
  orders, catalog readiness, campaigns, and the "Ask Your Store" agent
  chat, with slash-commands as shortcuts into common questions.
- frontend-observability — an internal, dev-only tool (not customer
  facing) that shows what either agent is doing live: real tool calls,
  real Razorpay calls, real webhook deliveries, real audit writes, as
  they happen, over one open connection.


## 5. HOW EVERYTHING IS WIRED TOGETHER
One Express server, several routers mounted at different URL prefixes:
  /commerce     — cart, checkout, mandates, orders, coupons
  /ai-buyer     — the buyer agent's chat + account-question endpoints
  /merchant     — the merchant agent's chat + dashboard data endpoints
  /catalog      — product search/browse
  /webhooks     — Razorpay's real async callbacks
  /observability — the live event stream described below

Nothing is duplicated between "what the agent's tool does" and "what the
page itself shows." For example, the merchant agent's
get_low_readiness_products tool is a thin wrapper that calls the EXACT
same function the Catalog page calls directly — one real implementation,
two ways to reach it.

THE OBSERVABILITY LAYER is the newest connective piece: a single
in-process event bus (Node's EventEmitter) that both agents' tool
wrappers, the audit-writing function, and the real Razorpay call wrapper
all publish onto. One SSE (Server-Sent Events) endpoint
(/observability/stream) re-broadcasts whatever gets published to any
browser tab watching — no polling, and nothing shown there is invented;
it's a live window onto the same events already being written for real
reasons elsewhere.


## 6. OVERALL ARCHITECTURE — A FULL WALKTHROUGH
Say a customer types "buy me a sambar onion" in the buyer app:

1. The message POSTs to /ai-buyer/chat.
2. The agent loop (generateText + tools) decides to call search_products,
   gets real catalog rows back, and calls propose_purchase once it's
   confident which product is meant.
3. The reply and the proposed product go back to the frontend, which
   opens the checkout flow — a separate, deterministic UI flow, NOT
   another agent turn.
4. The customer confirms. That request hits executeCheckoutSequence,
   which re-validates price/stock/delivery/policy/mandate from scratch
   (never trusting anything the chat already displayed).
5. If everything checks out, a real (or honestly-simulated) Razorpay
   charge happens, the order is written to the database, and an audit
   record is written describing exactly what was decided and why.
6. Razorpay's own webhook later confirms the payment asynchronously,
   which is itself logged and can update the order if anything changed.
7. If the customer later asks "why was I charged this," the agent reads
   that same audit trail back to them in plain English — the same numbers
   that made the decision, not a re-explanation guessed after the fact.
8. Throughout all of this, if the observability app is open, every one of
   these steps appeared there the instant it happened.

The merchant side works the same way minus the money-moving part: the
merchant agent only ever reads real data and proposes; a human has to
approve before a campaign/coupon becomes real and starts affecting what
customers see.


## 7. STANDOUT / EXTRA FEATURES WORTH KNOWING ABOUT
- Live "Agent Observability" HUD: real-time view of both agents working,
  split into an "AI proposed" lane (actual model calls) vs. a "code
  decided" lane (deterministic functions), a dedicated panel for guard-
  rail rejections (a price change caught, a spend limit exceeded), a
  step-budget bar showing the real per-turn tool-call cap, and separate
  live panels for Razorpay calls and webhook deliveries — all fed by one
  shared event bus, nothing faked for the display.
- Cancellation is a two-step, never-silent flow: the agent can only check
  and explain what cancelling would do (refund vs. outright cancel, how
  much, where it goes) — a human always taps a real confirm button before
  anything changes.
- Explainability: any past money decision can be reconstructed in plain
  English from the append-only audit trail, not from re-asking the model
  to guess what probably happened.
- Campaign suggestions are generated FROM real analytics (concentration
  risk, never-sold products, slow categories) rather than being generic —
  and still require a human approval step before they're live.
- Consistent "simulated vs. real" labelling anywhere money touches
  Razorpay, so nothing in a demo can be mistaken for an actual charge.
