// The feed pen, read from this machine instead of from the edge.
//
// The pages get it through a D1 binding; a script on the keeper's laptop has no
// binding, so it goes the long way round over the REST API in cf.js. Both ends
// select the same columns and run them through the same shape(), because the
// alternative is two ideas of what a fed pelican is and a bug that only shows up
// in whichever one you are not looking at.
import { d1 } from './cf.js';
import { COLUMNS, shape } from '../../src/lib/feed.js';

/** Everything the wall is currently showing, newest first — the same set, in the
 *  same order, as loadFeed() serves to the homepage.
 *
 *  `status` is a parameter because the keeper sometimes wants to look at what is
 *  waiting rather than what is up: pen('pending') is the queue behind the gate.
 */
export async function pen(status = 'live') {
  const rows = await d1(
    `select ${COLUMNS} from feed where status = ? order by created_at desc, id`,
    [status],
  );
  return rows.map(shape);
}
