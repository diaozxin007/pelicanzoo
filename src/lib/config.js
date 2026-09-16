// Where "submit to the collection" sends people. The repo has to exist and be
// public, or GitHub's prefilled new-file page 404s.
export const REPO = 'diaozxin007/pelicanzoo';
export const BRANCH = 'main';

// GitHub puts the whole file into the query string. Chrome and GitHub both
// cope well past this, but somewhere north of ~8KB the request starts getting
// refused, so anything bigger is handed over as a download instead.
export const INLINE_LIMIT = 6000;
export const SIZE_LIMIT = 200_000;
