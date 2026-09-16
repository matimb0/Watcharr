<script lang="ts">
	import { updateActivity, removeActivity } from "@/lib/util/api";
	import Modal from "./Modal.svelte";
	import Checkbox from "./Checkbox.svelte";
	import type { Activity } from "@/types";
	import { notify } from "./util/notify";

	interface Props {
		activity: Activity;
		activityMessage: string;
		onClose: () => void;
		onRemoved: (activity: Activity) => void;
		onUpdated: (activityId: number, updatedActivity: Activity) => void;
	}

	let { activity, activityMessage, onClose, onRemoved, onUpdated }: Props =
		$props();

	let isDateTimeValid = $state(true);
	let currentDateObject = new Date(
		Date.parse(activity.customDate ?? activity.createdAt),
	);
	let currentDateString = dateToInputDateString(currentDateObject);
	let currentTimeString = dateToInputTimeString(currentDateObject);
	let selectedDateString = $state(currentDateString);
	let selectedTimeString = $state(currentTimeString);
	let isDateTimeChanged: boolean = $derived(
		currentDateString != selectedDateString ||
			currentTimeString != selectedTimeString,
	);
	let isCountAsPlayChecked = $state(activity.countAsPlay);
	let isCountAsPlayChanged: boolean = $derived(
		isCountAsPlayChecked != activity.countAsPlay,
	);

	function dateToInputDateString(date: Date) {
		const year = date.getFullYear();
		const month = (date.getMonth() + 1).toString().padStart(2, "0");
		const day = date.getDate().toString().padStart(2, "0");
		return `${year}-${month}-${day}`;
	}

	function dateToInputTimeString(date: Date) {
		const hours = date.getHours().toString().padStart(2, "0");
		const minutes = date.getMinutes().toString().padStart(2, "0");
		return `${hours}:${minutes}`;
	}

	function validateNewDate() {
		try {
			const epochMillis = Date.parse(
				`${selectedDateString} ${selectedTimeString}`,
			);
			const dateObj = new Date(epochMillis);
			if (isNaN(dateObj.getTime())) {
				isDateTimeValid = false;
				return;
			}
			isDateTimeValid = true;
			return dateObj;
		} catch (err) {
			console.error("ActivityEditor: validateNewDate failed!", err);
			isDateTimeValid = false;
		}
	}

	async function update() {
		// Only validate/send the date if the user actually changed it.
		let dateObj: Date | undefined;
		if (isDateTimeChanged) {
			dateObj = validateNewDate();
			if (!dateObj || !isDateTimeValid) {
				notify({ text: "New date is invalid!", type: "error" });
				console.error(
					"ActivityEditor: Can't try updating, new date is invalid:",
					selectedDateString,
					selectedTimeString,
				);
				return;
			}
		}
		// Nothing to do if neither field was changed.
		if (!dateObj && !isCountAsPlayChanged) {
			notify({ text: "Nothing was changed to update!", type: "error" });
			return;
		}
		const updatedActivity = await updateActivity(
			activity,
			dateObj,
			isCountAsPlayChanged ? isCountAsPlayChecked : undefined,
		);
		if (!updatedActivity) {
			// Failed..
			return;
		}
		onUpdated(updatedActivity.id, updatedActivity);
		onClose();
	}

	async function remove() {
		const success = await removeActivity(activity.id);
		if (!success) {
			return;
		}
		onRemoved(activity);
		onClose();
	}
</script>

<Modal title="Edit Activity" desc={activityMessage} maxWidth="400px" {onClose}>
	<div class="centered">
		<h3>Date</h3>
		<input
			id="activity-date"
			type="date"
			bind:value={selectedDateString}
			onchange={validateNewDate}
			class:invalid={!isDateTimeValid}
		/>
		<h3>Time</h3>
		<input
			id="activity-time"
			type="time"
			bind:value={selectedTimeString}
			onchange={validateNewDate}
		/>

		<div class="countasplay">
			<h3>Count as Play</h3>
			<Checkbox
				name="activity-count-as-play"
				bind:value={isCountAsPlayChecked}
			/>
		</div>

		<div class="button-row">
			<button class="danger" onclick={remove}>Delete</button>
			<div>
				<button
					onclick={update}
					disabled={!(
						(isDateTimeChanged || isCountAsPlayChanged) &&
						isDateTimeValid
					)}>Update</button
				>
			</div>
		</div>
	</div>
</Modal>

<style lang="scss">
	.centered {
		display: flex;
		flex-flow: column;
		gap: 10px;
		height: 100%;

		h3 {
			font-size: 16px;
			font-family:
				sans-serif,
				system-ui,
				-apple-system,
				BlinkMacSystemFont;
		}

		.countasplay {
			display: flex;
			flex-flow: row;
			align-items: center;
			justify-content: space-between;

			h3 {
				margin: 0;
			}
		}

		.button-row {
			display: flex;
			flex-flow: row;
			justify-content: space-between;
			margin-top: 10px;

			button {
				margin-top: auto;
				width: max-content;
			}
		}
	}
</style>
