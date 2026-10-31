/* Pure save/undo-sync state of the panel: a queue of pending saves (one per scope, coalesced), at most one
   in flight, and the merge of an incoming `data` message into the local draft. No DOM, no timers (the view
   owns the debounce timer and stores its handle in `sync.timer`), so it is unit-tested like model.js. */
(function (root) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));

  function create() { return { timer: null, queue: [], inflight: null, draft: false, error: null }; }

  const hasPending = sync => sync.queue.length > 0;

  // Queues a save. A newer save of the same scope replaces the older one (the payload is the whole list),
  // a save of another scope stays queued behind it, so switching scope never drops an edit.
  // Returns true when more than one scope is waiting and the view should flush without waiting for the debounce.
  function enqueue(sync, entry) {
    const same = sync.queue.findIndex(e => e.scope === entry.scope);
    if (same >= 0) sync.queue.splice(same, 1);
    sync.queue.push(entry);
    return sync.queue.length > 1;
  }

  // Next entry to send, or null when nothing is queued or a save is still in flight.
  function take(sync) {
    if (sync.inflight || !sync.queue.length) return null;
    sync.inflight = sync.queue.shift();
    return sync.inflight;
  }

  // The extension confirmed the in-flight save. `again` means send the next queued one now; `waiting` means
  // the debounce will send it; neither means the draft is settled and may be replaced by the saved data.
  function saved(sync) {
    const done = sync.inflight; sync.inflight = null; sync.error = null;
    if (sync.queue.length && !sync.timer) return { done, again: true, waiting: false, settled: false };
    if (sync.timer) return { done, again: false, waiting: true, settled: false };
    sync.draft = false;
    return { done, again: false, waiting: false, settled: true };
  }

  // The save failed: the entry goes back to the front unless a newer one of the same scope is queued.
  function failed(sync, text) {
    const entry = sync.inflight; sync.inflight = null;
    if (entry && !sync.queue.some(e => e.scope === entry.scope)) sync.queue.unshift(entry);
    sync.error = text || 'Erro desconhecido.';
    return entry;
  }

  function retry(sync) { sync.error = null; }

  function discard(sync) { sync.queue = []; sync.error = null; sync.draft = false; }

  // Incoming `data`: replace the local list unless there is an unsaved draft in the same scope, in which case
  // only the favorites (stored outside the configuration) are taken from the message.
  function merge(sync, local, message) {
    const scope = message.scope.active;
    if (!sync.draft || local.scope !== scope) { sync.draft = false; return { groups: clone(message.groups), scope }; }
    const favorites = new Map(message.groups.flatMap(g => g.items.map(i => [i.id, i.favorite])));
    for (const g of local.groups) for (const i of g.items) if (favorites.has(i.id)) i.favorite = favorites.get(i.id);
    return { groups: local.groups, scope: local.scope };
  }

  const api = { create, hasPending, enqueue, take, saved, failed, retry, discard, merge };
  root.syncState = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis));
