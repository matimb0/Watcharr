import type { Watched } from "@/types";

// Event hub for watched-list mutations.

type WatchedUpdatedListener = (watched: Watched | undefined) => void;
type WatchedRemovedListener = (watchedId: number) => void;

const updatedListeners = new Set<WatchedUpdatedListener>();
const removedListeners = new Set<WatchedRemovedListener>();

export function onWatchedUpdated(listener: WatchedUpdatedListener): () => void {
	updatedListeners.add(listener);
	return () => {
		updatedListeners.delete(listener);
	};
}

export function onWatchedRemoved(listener: WatchedRemovedListener): () => void {
	removedListeners.add(listener);
	return () => {
		removedListeners.delete(listener);
	};
}

export function emitWatchedUpdated(watched: Watched | undefined): void {
	updatedListeners.forEach((listener) => listener(watched));
}

export function emitWatchedRemoved(watchedId: number): void {
	removedListeners.forEach((listener) => listener(watchedId));
}
