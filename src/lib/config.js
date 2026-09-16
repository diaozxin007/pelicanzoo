// (REPO and BRANCH lived here, pointing at the GitHub blob a fed pelican's file
// could be read from. Feeding has not gone through git for a while, and now that
// the pages read the row instead of the file there is no blob to point at:
// submissions/ is a backup written by npm run backup, not an address.)

// The cap on a submitted drawing, in characters of SVG. Checked in two places
// that must agree: the form before it will enable the button, and the API
// before it will write a row.
//
// (URL_LIMIT = 8000 lived here too. It existed to decide whether a whole file
// could be squeezed into GitHub's prefilled new-file URL — a budget measured
// against the encoded URL, not the file, because encodeURIComponent triples
// every <, > and quote. Nothing measures a URL any more.)
export const SIZE_LIMIT = 200_000;

// Public by design: it ships in the page source. Analytics.astro decides at
// runtime whether to load it, so localhost stays out of the reports.
export const GA4_ID = 'G-QW81EXNLQV';

// Where someone writes to ask for their badge in metal. The pin is struck by an
// image model that costs about two per cent of a week's quota per pelican, so
// the offer is a person rather than a button — and a person needs an address.
//
// Empty until the keeper fills it in, and empty is a working state: the demo
// still shows, the invitation simply doesn't. Nothing else in this repository
// prints an email, so this is the one place to change it.
export const CONTACT_EMAIL = '';
