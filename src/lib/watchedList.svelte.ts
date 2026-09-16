import { req } from "@/lib/util/api";
import paginatedLoader from "@/lib/util/paginatedLoader.svelte";
import { onWatchedRemoved, onWatchedUpdated } from "@/lib/util/watchedEvents";
import { store } from "@/store.svelte";
import type { Media, PaginationResponse, Watched } from "@/types";

type WatchedListLoader = ReturnType<typeof paginatedLoader<Media, undefined>>;

let loader: WatchedListLoader | undefined;

let activeScroll: { dataLoaded: () => void } | undefined;

let dataForParamsKey: string | undefined;

let cachedUsername: string | undefined;

let listGeneration = 0;

let reconciling = false;

export function getWatchedListLoader(): WatchedListLoader {
	if (!loader) {
		loader = paginatedLoader<Media, undefined>(load);
	}
	return loader;
}

export function setActiveScroll(
	scroll: { dataLoaded: () => void } | undefined,
) {
	activeScroll = scroll;
}

export function ensureWatchedListLoaded(allowRestore: boolean): boolean {
	const l = getWatchedListLoader();

	const invalidateCache = () => {
		listGeneration++;
		l.reset();
	};

	// The cached list belongs to a different user now, clear it.
	if (cachedUsername !== store.userInfo?.username) {
		cachedUsername = store.userInfo?.username;
		dataForParamsKey = undefined;
		invalidateCache();
	}

	const key = JSON.stringify(store.sortAndFiltersForQueryParams);

	if (allowRestore && isListUsable(key)) {
		console.debug(
			"watchedList->ensureWatchedListLoaded: Restoring existing list.",
		);
		return true;
	}

	// Sort/filter params changed or a fresh load is wanted: clear the
	// old list (also aborts any in-flight request).
	invalidateCache();
	dataForParamsKey = key;
	console.debug("watchedList->ensureWatchedListLoaded: Loading list.");
	void l.runFn();
	return false;
}

function isListUsable(key: string): boolean {
	const l = getWatchedListLoader();
	return (
		dataForParamsKey === key &&
		(l.state.data.length > 0 || l.state.page > 0 || !!l.state.reqLoadError)
	);
}

function syncWatchedUpdateToCache(updated: Watched | undefined) {
	if (!updated?.id) {
		return;
	}
	const l = loader;
	if (!l) {
		return;
	}
	const i = l.state.data.findIndex((m) => m.watched?.id === updated.id);
	if (i < 0) {
		// Not in the currently loaded list, nothing to sync.
		return;
	}
	const w = l.state.data[i].watched;
	if (!w) {
		return;
	}
	// Copy over the fields a watched entry update can change.
	w.status = updated.status;
	w.rating = updated.rating;
	w.thoughts = updated.thoughts;
	w.pinned = updated.pinned;
	w.updatedAt = updated.updatedAt;
	if (updated.plays !== undefined) {
		w.plays = updated.plays;
	}
	if (updated.activity) {
		w.activity = updated.activity;
	}
	console.debug("watchedList->syncWatchedUpdateToCache: Synced entry:", w.id);
}

function removeWatchedFromCache(watchedId: number) {
	const l = loader;
	if (!l) {
		return;
	}
	const i = l.state.data.findIndex((m) => m.watched?.id === watchedId);
	if (i < 0) {
		return;
	}
	l.state.data.splice(i, 1);
	console.debug(
		"watchedList->removeWatchedFromCache: Removed entry:",
		watchedId,
	);
}

onWatchedUpdated(syncWatchedUpdateToCache);
onWatchedRemoved((watchedId) => {
	if (activeScroll) {
		return;
	}
	removeWatchedFromCache(watchedId);
});

export async function reconcileWatchedList(): Promise<void> {
	const l = getWatchedListLoader();
	if (reconciling) {
		return;
	}
	const pages = l.state.page;
	if (pages <= 0 || l.state.data.length <= 0) {
		return;
	}
	reconciling = true;
	const generation = listGeneration;
	const params = { ...store.sortAndFiltersForQueryParams };
	try {
		const fresh: Media[] = [];
		let pageMax = 1;
		const CONCURRENCY = 4;
		for (let start = 1; start <= pages; start += CONCURRENCY) {
			const resps = await Promise.all(
				Array.from(
					{ length: Math.min(CONCURRENCY, pages - start + 1) },
					(_, i) =>
						req.get<PaginationResponse<Media, undefined>>(`/watched`, {
							params: { ...params, page: start + i },
						}),
				),
			);
			for (const r of resps) {
				if (!r) {
					console.warn(
						"watchedList->reconcile: Incomplete response, keeping old list.",
					);
					return;
				}
				if (r.results?.length) {
					fresh.push(...r.results);
				}
				pageMax = r.totalPages ?? pageMax;
			}
			if (generation !== listGeneration) {
				console.debug(
					"watchedList->reconcile: List changed while refreshing, discarding.",
				);
				return;
			}
		}

		l.state.data = fresh;
		l.state.page = Math.min(pages, pageMax);
		l.state.pageMax = pageMax;
		l.state.reqLoadError = undefined;
		console.debug("watchedList->reconcile: List refreshed in background.");
	} catch (err) {
		console.error("watchedList->reconcile: Failed, keeping old list.", err);
	} finally {
		reconciling = false;
	}
}

export const watchedListReconciling = () => reconciling;

async function load(signal: AbortSignal) {
	const l = getWatchedListLoader();
	const params = {
		page: l.state.page + 1,
		...store.sortAndFiltersForQueryParams,
	};
	console.debug("watchedList->load: loadParams:", params);
	const r = await req.get<PaginationResponse<Media, undefined>>(`/watched`, {
		params,
		signal,
	});
	activeScroll?.dataLoaded();
	return r;
}
