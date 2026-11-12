# How Risk Analysis calculates
The risk owner declares a complete list of assumed joint outcomes. For each state, probability is its integer weight divided by total weight. Expected loss is the weighted mean of residual loss. Standard deviation uses centered weighted variance to preserve small variance around large loss baselines.

Loss quantiles use the weighted empirical CDF: return the first loss whose cumulative weight reaches the requested fraction. P10 is the lower loss quantile and P90 the higher loss quantile. These are loss quantiles, not petroleum reserve categories. Tail probability is the mass with loss at or above the operator's threshold.

Indicator correlations are calculated from which hazards occur together in the supplied joint states. Integer arithmetic protects the covariance numerator from cancellation. A zero-variance indicator has unavailable correlation; it is never assigned a fabricated coefficient. All such probabilities and dependence describe assumptions.

Register coverage is evaluated independently of probability mass. A zero-probability state cannot erase missing evidence, a conflict, unknown severity or an unmitigated severe hazard. The resulting work remains blocked or ready for exact human review.

The initial method is deterministic, so a random seed is inapplicable. It does not infer field probabilities, financial NPV/IRR, jurisdiction risk scores, compliance or investment approval. An enrolled human's separate decision is required before private recording.
