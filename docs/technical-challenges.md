# RazeGPT — Technical Problems We Ran Into & How We Fixed Them
(Agent + payments infrastructure)

## 1. AN LLM TOOL CALL CAN BE RETRIED — YOUR PAYMENT LOGIC HAS TO ASSUME IT WILL BE
Problem: An agent isn't a single deterministic function call. The model can
decide mid-conversation to "try that again," the app layer can retry a
timed-out request, or the user can resend a message that triggers the same
purchase intent twice. If "call the checkout tool" and "charge the
customer" are the same step, any of those retries double-charges a real
order.

Fix: Every order-creation call carries an idempotency key derived from
(customer_id, conversation_id, approval_id, product_id) — not a random
UUID, but something the same logical request always reproduces. A repeat
call with that key returns the original cached result instead of running
the charge again. Underneath that, spend authority is a "mandate": a
bounded, single-purpose grant (max amount, expiry, one caller type) that
is checked fresh on every order, so even a legitimate second charge
attempt still can't exceed what was actually approved.

## 2. THE AGENT'S OWN MEMORY OF A PRICE IS NOT A TRUSTWORTHY INPUT
Problem: An LLM's product knowledge and the phrasing of confirmations it
generates come from conversation text, which can be several turns old by
the time the buyer actually confirms. If the checkout step charges
whatever price the agent last mentioned, a stale quote, a mid-conversation
price change, or the model simply mis-stating a number it remembers, all
turn into a real, wrong charge — and nothing in that pipeline knows it's
wrong, because it's not "buggy," it's just working exactly as told.

Fix: The agent's remembered price is only ever compared against the
database's current price, never used directly as the transaction amount.
If the two amounts don't match, checkout stops before any payment call
with an explicit "price changed" result the agent can relay honestly
("that price moved, want me to re-check with the updated one?"), rather
than either silently charging the wrong number or silently overriding
what the buyer was quoted.

## 3. TWO SYSTEMS OF RECORD FOR THE SAME PAYMENT, UPDATING YOU OUT OF ORDER
Problem: Razorpay confirms a payment two ways: the synchronous response
your own checkout call gets back, and an asynchronous webhook fired
independently, sometime after. Those can race — the webhook can arrive
before your own code has finished writing the order, or arrive again
after a network blip caused Razorpay to redeliver it, or arrive for a
refund without it being obvious *which* order it's for when a single
Razorpay payment funded several order rows at once (a multi-item cart
checkout creates one order per item, all under one payment_id).

Fix: Webhook handling is idempotent by construction — it re-derives the
order's correct status from its current state rather than blindly
setting a new one, so replaying the same event twice is a no-op instead
of a double-transition. For refunds specifically, we stopped relying on
payment_id alone to find "the" order — the specific order_id is written
into the refund's own notes at charge time, so the webhook can name the
exact sibling order to refund instead of guessing across all of them.

## 4. GUARDRAILS WRITTEN INTO THE PROMPT AREN'T GUARDRAILS
Problem: It's tempting to tell the model "never approve more than X" or
"never do Y" in its system prompt and call that a safety limit. A prompt
is a strong suggestion to a language model, not a constraint a determined
adversarial input, an unusual conversation path, or an outright edge case
(negative amounts, an already-consumed authorization being replayed, a
mandate that expired one second ago) is guaranteed to respect.

Fix: Every rule that actually matters for money moving is enforced as
plain code the model has no path around — mandate expiry and remaining
balance are checked server-side on every order regardless of what the
model believes it already confirmed, and negative/NaN/zero amounts and
already-consumed tokens are rejected before any business logic runs at
all. We specifically wrote tests for the adversarial cases (negative
authorization amounts, replaying a spent token, an expired-but-still-
"active"-looking mandate) as first-class scenarios, not afterthoughts,
because those are exactly the inputs a prompt-level rule is weakest
against.

## 5. YOU CAN'T SET A BREAKPOINT INSIDE A MODEL'S REASONING
Problem: When a multi-step agent produces a wrong or unexpected outcome,
the cause could be the tool it called, the data that tool returned, or
the model's own decision about what to call next and how to interpret the
result — and a stack trace tells you nothing about which. Traditional
debugging tools assume the thing making decisions is your own code; here
part of it is a black box you can't step through.

Fix: Every tool call is traced in real time with its name, arguments,
result, and timing, independent of whatever the model says about it
afterward — so a wrong final answer can be checked against exactly what
the tools actually returned, rather than trusting the model's own account
of what happened. We built a live dashboard around this trace stream (and
a way to replay any past conversation's exact recorded sequence) because
without it, "the agent gave a wrong answer" is nearly undebuggable after
the fact.

## 6. AN AGENT LEFT TO ITS OWN JUDGMENT WILL SOMETIMES JUST KEEP GOING
Problem: Each step in an agent loop is the model deciding "call one more
tool" or "answer now." Nothing about that loop is naturally bounded — a
model that's uncertain, or stuck interpreting an ambiguous result, can
keep calling tools indefinitely, burning real API cost and real latency
on a single user turn with no guarantee it ever converges on an answer.

Fix: Both agent loops run under a hard step budget (12 for the buyer
agent, 10 for the merchant agent) enforced by the framework's own stop
condition, not a suggestion in the prompt. If the budget runs out without
a real answer, that's treated as its own outcome — reported honestly to
the user — rather than a loop that just silently runs longer than
expected.
