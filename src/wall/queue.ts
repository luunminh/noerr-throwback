import type { Memory } from '../lib/memory';
import { shuffle, type Rand } from '../lib/random';

export interface Queue {
  next(onScreen: ReadonlySet<string>): Memory;
}

/**
 * Shared photo pool for the wall: no memory repeats until all were shown,
 * and a memory already on screen is skipped while any other is available.
 */
export function createQueue(order: readonly Memory[], rand: Rand = Math.random): Queue {
  if (order.length === 0) throw new Error('createQueue: empty pool');
  let round = order.slice();
  let pos = 0;
  let last: string | undefined;

  const newRound = () => {
    round = shuffle(order, rand);
    if (round.length > 1 && round[0].id === last) [round[0], round[1]] = [round[1], round[0]];
    pos = 0;
  };
  const serve = (i: number) => {
    [round[pos], round[i]] = [round[i], round[pos]];
    last = round[pos].id;
    return round[pos++];
  };

  return {
    next(onScreen) {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (pos >= round.length) newRound();
        const i = round.findIndex((m, k) => k >= pos && !onScreen.has(m.id));
        if (i !== -1) return serve(i);
        pos = round.length; // everything left in this round is on screen already: counts as shown
      }
      newRound();
      return serve(0); // pool smaller than the wall: a duplicate beats a blank tile
    },
  };
}
