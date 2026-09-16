// Where "submit to the collection" sends people. The repo has to exist and be
// public, or GitHub's prefilled new-file page 404s.
export const REPO = 'diaozxin007/pelicanzoo';
export const BRANCH = 'main';

// GitHub puts the whole file into the query string. Chrome and GitHub both
// cope well past this, but somewhere north of ~8KB the request starts getting
// refused, so anything bigger is handed over as a download instead.
//
// Measured against the built URL, not against the file. An SVG is mostly
// characters encodeURIComponent has to escape — every <, >, ", #, space and
// newline becomes three bytes — and on the one real submission in the
// collection 4162 characters of file came out as a 7409-byte URL, 1.78x. A
// budget applied to the raw length is therefore a budget for something like
// half of what actually gets sent.
export const URL_LIMIT = 8000;
export const SIZE_LIMIT = 200_000;

// Public by design: it ships in the page source. Analytics.astro decides at
// runtime whether to load it, so localhost stays out of the reports.
export const GA4_ID = 'G-QW81EXNLQV';
