# How the Economist works

The employee starts from an assigned task and current permitted evidence. The
operator supplies explicit net cash flows and supporting forecasts, prices,
costs, ownership, fiscal terms and assumptions. The employee reads the source
identities first and requests bounded source pages when it needs detail.

Econobot computes each supplied scenario using one reviewed calculation contract.
Cash paid out is negative; cash received is positive. The first entry occurs now
and later entries occur at the end of equal periods. Currency, money scale and
effective discount rate belong to the declared period. The employee preserves
zeros, negative returns and unavailable or ambiguous IRR states. It never guesses
missing fiscal inputs or treats public observed prices as an approved forecast.

A draft preserves exact calculations, assumed financial basis, source revisions
and limitations. The final response contains only `work` and `scenario` JSON, or
a `deferred` string when required authorized inputs are missing. Evaluation parses
that actual response: a correct backend result cannot hide incorrect model text.

Preparing review stores a packet with the exact work, context, source bytes,
evaluation references and proposed private-save action. The enrolled reviewer
inspects it using a separate CLI, then approves, rejects or requests changes.
Changed assumptions require a new source/task/scenario revision and new review.
Installed qualification and current rights are checked again on approval and save.

After approval, deterministic supervision can resume the exact save across
restart without another model request. Repeating it returns the same stored
outcome. Revoked access blocks further source/context use even after an earlier
approval. The stored scenario never authorizes capital or certifies professional
financial conclusions.
