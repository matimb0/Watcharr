<script lang="ts">
	import type { Activity } from "@/types";
	import {
		seasonAndEpToReadable,
	} from "./util/helpers";
	import ActivityEditor from "./ActivityEditor.svelte";
	import Icon from "./Icon.svelte";
	import tooltip from "./actions/tooltip";
	import { t } from "@/lib/i18n";
	import { store } from "@/store.svelte";

	interface Props {
		activity: Activity[] | undefined;
		onRemoved: (activity: Activity) => void;
	}

	let { activity = undefined, onRemoved }: Props = $props();

	let clickedActivity: Activity | undefined = $state();
	let groupedActivities: { [index: string]: Activity[] } = $derived(
		getGroupedActivity(activity),
	);

	function getMsg(a: Activity) {
		const status = (value: string | undefined) =>
			value ? t(`status.${value.toLowerCase()}` as never) : t("common.unknown");
		switch (a?.type) {
			case "ADDED_WATCHED":
				if (a.data) {
					const data = JSON.parse(a.data);
					return `${t("activity.messages.added")}${data?.status ? ` ${status(data.status)}` : ""}${data?.rating ? ` (${data.rating})` : ""}`;
				}
				return t("activity.messages.added");
			case "REMOVED_WATCHED":
				return t("activity.messages.removed");
			case "RATING_CHANGED":
				if (a.data) {
					return t("activity.messages.ratingChanged", { rating: a.data });
				}
				return t("activity.messages.ratingChanged", { rating: "?" });
			case "STATUS_CHANGED":
				if (a.data) {
					return t("activity.messages.statusChanged", { status: status(a.data) });
				}
				return t("activity.messages.statusChanged", { status: t("common.unknown") });
			case "STATUS_CHANGED_AUTO":
				if (a.data) {
					const data = JSON.parse(a.data);
					return t("activity.messages.statusChanged", { status: status(data.status) });
				}
				return t("activity.messages.statusChanged", { status: t("common.unknown") });
			case "THOUGHTS_CHANGED":
				return t("activity.messages.thoughtsChanged");
			case "THOUGHTS_REMOVED":
				return t("activity.messages.thoughtsRemoved");
			case "IMPORTED_WATCHED":
				return t("activity.messages.imported");
			case "IMPORTED_WATCHED_JF":
			case "IMPORTED_WATCHED_PLEX":
				return t("activity.messages.synced");
			case "IMPORTED_RATING":
				if (a.data) {
					const data = JSON.parse(a.data);
					if (data.rating) {
						return t("activity.messages.ratingChanged", { rating: data.rating });
					} else {
						return t("activity.messages.addedNoRating");
					}
				}
				return t("activity.messages.importedRating");
			case "IMPORTED_ADDED_WATCHED":
			case "IMPORTED_ADDED_WATCHED_JF":
			case "IMPORTED_ADDED_WATCHED_PLEX":
				return t("activity.messages.importedWatchDate");
			case "SEASON_ADDED":
			case "SEASON_ADDED_AUTO":
				if (a.data) {
					const data = JSON.parse(a.data);
					return t("activity.messages.seasonAdded", { season: data.season, status: status(data.status) });
				}
				return t("activity.messages.seasonAddedSimple");
			case "SEASON_ADDED_JF":
			case "SEASON_ADDED_PLEX":
				if (a.data) {
					const data = JSON.parse(a.data);
					return t("activity.messages.seasonSynced", { season: data.season, status: status(data.status) });
				}
				return t("activity.messages.seasonSyncedSimple");
			case "SEASON_RATING_CHANGED":
				if (a.data) {
					const data = JSON.parse(a.data);
					return t("activity.messages.seasonRatingChanged", { season: data.season, rating: data.rating });
				}
				return t("activity.messages.seasonRatingChangedSimple");
			case "SEASON_STATUS_CHANGED":
			case "SEASON_STATUS_CHANGED_AUTO":
				if (a.data) {
					const data = JSON.parse(a.data);
					return t("activity.messages.seasonStatusChanged", { season: data.season, status: status(data.status) });
				}
				return t("activity.messages.seasonStatusChangedSimple");
			case "SEASON_REMOVED":
				if (a.data) {
					const data = JSON.parse(a.data);
					return t("activity.messages.seasonStatusRemoved", { season: data.season });
				}
				return t("activity.messages.seasonRemoved");
			case "EPISODE_ADDED":
				if (a.data) {
					const data = JSON.parse(a.data);
					return t("activity.messages.episodeAdded", { episode: seasonAndEpToReadable(data.season, data.episode) });
				}
				return t("activity.messages.episodeAddedSimple");
			case "EPISODE_ADDED_JF":
			case "EPISODE_ADDED_PLEX":
				if (a.data) {
					const data = JSON.parse(a.data);
					return t("activity.messages.episodeSynced", { episode: seasonAndEpToReadable(data.season, data.episode) });
				}
				return t("activity.messages.episodeSyncedSimple");
			case "EPISODE_RATING_CHANGED":
				if (a.data) {
					const data = JSON.parse(a.data);
					return t("activity.messages.episodeRatingChanged", { episode: seasonAndEpToReadable(data.season, data.episode), rating: data.rating });
				}
				return t("activity.messages.episodeRatingChangedSimple");
			case "EPISODE_STATUS_CHANGED":
				if (a.data) {
					const data = JSON.parse(a.data);
					return t("activity.messages.episodeStatusChanged", { episode: seasonAndEpToReadable(data.season, data.episode), status: status(data.status) });
				}
				return t("activity.messages.episodeStatusChangedSimple");
			case "EPISODE_REMOVED":
				if (a.data) {
					const data = JSON.parse(a.data);
					return t("activity.messages.episodeRemoved", { episode: seasonAndEpToReadable(data.season, data.episode) });
				}
				return t("activity.messages.episodeRemovedSimple");
			default:
				return a.type;
		}
	}

	function toFullTitleCase(text: string | undefined) {
		if (text) {
			return text
				.split(" ")
				.map((l) => l[0].toUpperCase() + l.substring(1).toLowerCase())
				.join(" ");
		}
		return t("common.unknown");
	}

	function toDayTime(d: Date) {
		const locale = store.userSettings?.language === "de" ? "de-DE" : "en-US";
		return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(d);
	}

	/**
	 * Get what will be the visible date the activity was 'created'.
	 * @returns customDate if defined or createdAt if not.
	 */
	function getCreatedAtVis(a: Activity) {
		return Date.parse(a.customDate ?? a.createdAt);
	}

	function getGroupedActivity(activities?: Activity[]) {
		activities = activities?.filter((a) => a.type);
		const a = activities?.sort(
			(a, b) => getCreatedAtVis(b) - getCreatedAtVis(a),
		);
		let grouped: { [index: string]: Activity[] } = {};
		if (a) {
			for (let i = 0; i < a.length; i++) {
				const activity = a[i];
				const date = new Date(getCreatedAtVis(activity));
					const locale = store.userSettings?.language === "de" ? "de-DE" : "en-US";
					const key = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date);
				if (grouped[key]) {
					grouped[key].push(activity);
				} else {
					grouped[key] = [activity];
				}
			}
		}
		return grouped;
	}

	function openEditor(a: Activity) {
		clickedActivity = a;
		return;
	}

	function getActivityDataParsed(a: Activity) {
		try {
			if (a.data) {
				return JSON.parse(a.data);
			}
		} catch (err) {
			console.error("getActivityDataParsed: Failed!", err);
		}
	}
</script>

{#if clickedActivity}
	<ActivityEditor
		activity={clickedActivity}
		activityMessage={getMsg(clickedActivity)}
		onClose={() => (clickedActivity = undefined)}
		onUpdated={(activityId, updatedActivity) => {
			if (!activity) {
				console.error(
					"ActivityEditor->onUpdated: 'activity' doesn't exist somehow..",
				);
				return;
			}
			const ai = activity.findIndex((a) => a.id === activityId);
			activity[ai] = updatedActivity;
		}}
		onRemoved={(a) => {
			if (!activity) {
				console.error(
					"ActivityEditor->onRemoved: 'activity' doesn't exist somehow..",
				);
				return;
			}
			onRemoved(a);
		}}
	/>
{/if}

<div class="activity">
	<h2>{t("activity.title")}</h2>
	{#if groupedActivities && Object.keys(groupedActivities).length > 0}
		<ul>
			{#each Object.keys(groupedActivities) as k (k)}
				<h3>{k}</h3>

				{#each groupedActivities[k] as a (a.id)}
					{@const d = new Date(getCreatedAtVis(a))}
					<li>
						<button class="plain" onclick={() => openEditor(a)}>
							<span title={d.toDateString()}>{toDayTime(d)}</span>
							<span>{getMsg(a)}</span>
						</button>
						{#if a.type?.endsWith("_AUTO")}
							{@const data = getActivityDataParsed(a)}
							<i
								use:tooltip={{
									text:
										data && data.reason
											? t("activity.automatedBecause", { reason: data.reason })
											: t("activity.completedAutomation"),
									pos: "top",
								}}
								style="width: 20px; height: 20px;"
							>
								<Icon i="sparkles" wh={20} />
							</i>
						{/if}
						{#if a.countAsPlay}
							<i
								use:tooltip={{
									text: t("activity.countsAsPlay"),
									pos: "top",
								}}
								style="width: 20px; height: 20px;"
							>
								<Icon i="play" wh={20} />
							</i>
						{/if}
					</li>
				{/each}
			{/each}
		</ul>
	{:else}
		<span>{t("activity.empty")}</span>
	{/if}
</div>

<style lang="scss">
	.activity {
		width: 100%;

		ul {
			display: flex;
			flex-flow: column;
			gap: 8px;
			margin-top: 8px;
			margin-left: calc(30px + 8px);
			list-style: none;
			max-height: 250px;
			overflow-y: auto;
			overflow-x: hidden;

			h3 {
				position: sticky;
				top: 0;
				font-size: 16px;
				font-family:
					sans-serif,
					system-ui,
					-apple-system,
					BlinkMacSystemFont;
				padding-bottom: 1px;
				background-color: $bg-color;
			}

			li {
				display: flex;
				flex-flow: row;
				gap: 8px;
				align-items: center;

				button {
					all: unset;
					display: flex;
					flex-flow: row;
					align-items: center;
					flex-shrink: 1;
					gap: 8px;
					width: max-content;
					min-width: 0;
					max-width: 100%;
					cursor: pointer;
				}

				span {
					width: max-content;
					margin-left: 0px;

					&:first-child {
						min-width: max-content;
					}

					&:last-of-type {
						background-color: $accent-color;
						color: $text-color;
						border-radius: 8px;
						padding: 10px 12px;
					}
				}
			}
		}

		span {
			margin-left: calc(30px);
			width: 100%;
			display: flex;
			justify-content: center;
		}
	}

	h2 {
		font-size: 30px;
		font-weight: bold;
		margin-left: 30px;
	}
</style>
