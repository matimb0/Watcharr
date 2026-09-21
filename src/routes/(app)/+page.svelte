<script lang="ts">
	import { afterNavigate, goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import Error from "@/lib/Error.svelte";
	import Icon from "@/lib/Icon.svelte";
	import Poster from "@/lib/poster/Poster.svelte";
	import PosterList from "@/lib/poster/PosterList.svelte";
	import Spinner from "@/lib/Spinner.svelte";
	import infScroll from "@/lib/util/infScroll";
	import {
		ensureWatchedListLoaded,
		getWatchedListLoader,
		reconcileWatchedList,
		setActiveScroll,
		watchedListReconciling,
	} from "@/lib/watchedList.svelte";
	import { clearActiveFilters, store } from "@/store.svelte";
	import { onDestroy, onMount, tick, untrack } from "svelte";

	const scroll = infScroll({ callback: onScrollToBottom });
	const dataLoader = getWatchedListLoader();

	async function onScrollToBottom() {
		// If an error is being shown, no more infinite scroll.
		if (dataLoader.state.reqLoadError) {
			return;
		}
		// Don't append more content while the restored list is being
		// reconciled in the background; we re-check afterwards.
		if (watchedListReconciling()) {
			return;
		}
		dataLoader.runFn();
	}

	// Whether the initial load (on mount) was already handled by
	// `afterNavigate` below. This is a per-mount variable so we can
	// decide between restoring the old list or loading fresh.
	let initialLoadHandled = false;

	$effect(() => {
		if (initialLoadHandled && store.sortAndFiltersForQueryParams) {
			untrack(() => {
				// Sort/filter params changed -> fresh load of the list.
				ensureWatchedListLoaded(false);
			});
		}
	});

	afterNavigate(({ type }) => {
		if (initialLoadHandled) {
			return;
		}
		initialLoadHandled = true;
		untrack(() => {
			if (ensureWatchedListLoaded(type === "popstate")) {
				// Restored the existing list
				scroll.dataLoaded();
				// Silently refresh the restored list
				void reconcileAndFixScroll();
			}
		});
	});

	interface ScrollAnchor {
		watchedId: number;
		top: number;
		scrollY: number;
	}

	function captureScrollAnchor(): ScrollAnchor | undefined {
		const lis = Array.from(document.querySelectorAll<HTMLLIElement>("ul li"));
		const data = dataLoader.state.data;
		let best: ScrollAnchor | undefined;
		for (let i = 0; i < lis.length; i++) {
			const watchedId = data[i]?.watched?.id;
			if (!watchedId) {
				continue;
			}
			const rect = lis[i].getBoundingClientRect();
			if (rect.bottom <= 0 || rect.top >= window.innerHeight) {
				continue;
			}
			if (!best || rect.top < best.top) {
				best = { watchedId, top: rect.top, scrollY: window.scrollY };
			}
		}
		return best;
	}

	function restoreScrollAnchor(anchor: ScrollAnchor | undefined) {
		if (!anchor) {
			return;
		}
		// The user started scrolling during the refresh, don't yank
		// them back to the anchor.
		if (Math.abs(window.scrollY - anchor.scrollY) > 5) {
			return;
		}
		const lis = Array.from(document.querySelectorAll<HTMLLIElement>("ul li"));
		const idx = dataLoader.state.data.findIndex(
			(m) => m.watched?.id === anchor.watchedId,
		);
		if (idx < 0 || idx >= lis.length) {
			return;
		}
		window.scrollBy(0, anchor.top - lis[idx].getBoundingClientRect().top);
	}

	async function reconcileAndFixScroll() {
		const anchor = captureScrollAnchor();
		await reconcileWatchedList();
		await tick();
		restoreScrollAnchor(anchor);
		scroll.dataLoaded();
	}

	onMount(() => {
		setActiveScroll(scroll);

		const initialLoadTimeout = window.setTimeout(() => {
			if (!initialLoadHandled) {
				initialLoadHandled = true;
				console.debug("MAIN PAGE: No navigation event, loading fresh.");
				ensureWatchedListLoaded(false);
			}
		}, 0);

		return () => {
			window.clearTimeout(initialLoadTimeout);
		};
	});

	onDestroy(() => {
		console.log("MAIN PAGE DESTROYED");
		scroll.destroy();
		setActiveScroll(undefined);
	});
</script>

<svelte:head>
	<title>Watched List</title>
</svelte:head>

<!-- <span
	style="position: fixed; top: 80px; background-color: white; color: black; z-index: 60;"
>
	<b>listPage</b>: {dataLoader.state.page}
	listPageMax: {dataLoader.state.pageMax}
	listLoading: {dataLoader.state.reqLoading}
	<b>sort:</b>
	{JSON.stringify(store.activeSort)}
	<b>filter:</b>
	{JSON.stringify(store.activeFilters)}
	<b>queryp:</b>
	{JSON.stringify(store.sortAndFiltersForQueryParams)}
	paginatedLoader.state.meta: {JSON.stringify(dataLoader.state.meta)}
</span> -->

<PosterList>
	{#if dataLoader.state.data?.length > 0}
		{#each dataLoader.state.data as w, i (w.watched?.id ?? `${i}-${w.type}`)}
			{#if w}
				<Poster
					bind:watched={dataLoader.state.data[i].watched}
					media={w}
					fluidSize={true}
				/>
			{/if}
		{/each}
	{:else if !dataLoader.state.reqLoading && !dataLoader.state.reqLoadError}
		<div class="empty-list">
			<Icon i={store.hasActiveFilters ? "filter-circle" : "reel"} wh={80} />
			<h2 class="norm">Your list looks empty!</h2>
			<h4 class="norm">
				Try {`${store.hasActiveFilters ? "removing your active filters or" : ""}`}
				searching for something you would like to add.
			</h4>
			{#if !store.hasActiveFilters}
				<button onclick={() => goto(resolve("/import"))}>Import</button>
			{/if}
			{#if store.hasActiveFilters}
				<button onclick={() => clearActiveFilters()}>Clear Filters</button>
			{/if}
		</div>
	{/if}
</PosterList>

{#if dataLoader.state.reqLoading}
	<div style="margin-bottom: 60px;">
		<Spinner />
	</div>
{/if}

{#if dataLoader.state.reqLoadError}
	<div style="margin-bottom: 60px;">
		<Error
			pretty="Failed to load results!"
			error={dataLoader.state.reqLoadError}
			onRetry={() => {
				dataLoader.state.reqLoadError = undefined;
				dataLoader.runFn();
			}}
		/>
	</div>
{/if}

<!-- TODO: A 'That's it' message when you reach bottom of your list? -->
<!-- {#if !dataLoader.state.reqLoadError && dataLoader.state.page === dataLoader.state.pageMax}
	<b>That's it!</b>
{/if} -->

<style lang="scss">
	.empty-list {
		display: flex;
		flex-flow: column;
		gap: 5px;
		align-items: center;
		max-width: 400px;

		h2 {
			margin-top: 10px;
		}

		h4 {
			font-weight: normal;
			text-align: center;
		}

		button {
			width: max-content;
			padding-left: 20px;
			padding-right: 20px;
			margin-top: 15px;
		}
	}
</style>
