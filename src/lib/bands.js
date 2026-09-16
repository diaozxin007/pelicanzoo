/** Which way the number leans. Same three bands, and the same cut-offs, as the
 *  .score block on the specimen pages — the badge and the page have to agree.
 *
 *  Its own file, with no imports, because everything that needs it now runs at
 *  the edge: the page, the badge endpoint and the receipt all render per
 *  request, and a second copy of the cut-offs is exactly the drift this guards.
 */
export function bandOf(score) {
  return score >= 60 ? 'high' : score >= 30 ? 'mid' : 'low';
}
