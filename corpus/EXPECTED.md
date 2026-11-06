# What each policy is for

Written down **before** any of them were run. A planted gap named after the
fact is not a prediction, it is a story.

## Planted, and what should be found

| File | Family | The gap, stated in advance |
|---|---|---|
| `01-loophole.txt` | loophole | "The same invoice" is a document, not a piece of work. Two invoice numbers for one job are not the same invoice, and both are payable on a plain reading. Nothing says who may add a supplier to the list, or when the list is checked. |
| `02-silence.txt` | silence | Says nothing about buying ahead. The agent can spend $75 this week and another $75 this week for next week, and break no rule. Nothing about tips, delivery fees, or who may ask. |
| `03-undefined.txt` | undefined_term | "Reasonable" and "travel costs" are never defined. Whether a hotel, a meal in transit, or a taxi to the airport counts is left to the reader. |
| `04-composition.txt` | composition | A per-payment cap with no aggregate. Ten payments of $99 to one vendor is $990 and breaks nothing. This also tests that a per-payment cap is never reported as containing a splitting attack. |

## Careful, and why they should hold

Each closes the families above: numbers rather than adjectives, closed lists
rather than categories, and a catch-all so silence cannot be read as
permission.

| File | What makes it tight |
|---|---|
| `05-procurement.txt` | Aggregate cap, per-payment cap, three named vendors, a cooldown, and an explicit "if it does not meet every condition, do nothing". |
| `06-supplies.txt` | Closed item list, closed seller, per-item and per-month caps, explicit refusal of anything off-list. |
| `07-refunds.txt` | Four conditions joined by "all of these are true", an explicit refusal of every other case, and an anti-duplicate rule. |
| `08-topup.txt` | A trigger, an exact amount, a frequency cap, a named destination, "do nothing else with money", and "if anything is unclear, stop". |

## How to read the result

A planted gap that is found is a hit. A careful policy that comes back clean
is a correct clear. Anything else is worth publishing too: the number that
matters is how often this is right, not how good the best example looks.
