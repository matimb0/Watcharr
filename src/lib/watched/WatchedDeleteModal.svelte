<script lang="ts">
	import Modal from "../Modal.svelte";
	import { t } from "@/lib/i18n";

	interface Props {
		mediaName?: string;
		/**
		 * If `confirmed=true` then the deletion request was confirmed.
		 */
		onClose: (confirmed: boolean) => void;
	}

	let { mediaName, onClose }: Props = $props();
</script>

<Modal
	title={t("content.removeFromList.title")}
	onClose={() => onClose(false)}
	maxWidth="650px"
>
	<div class="remove-ctr">
		<p>
			{t("content.removeFromList.description", { content: mediaName ?? "this content" })}
		</p>
		<button class="confirm-delete-btn" onclick={() => onClose(true)}>
			{t("content.removeFromList.confirm")}
		</button>
	</div>
</Modal>

<style lang="scss">
	div.remove-ctr {
		display: flex;
		flex-flow: column;
		gap: 10px;

		button.confirm-delete-btn {
			width: max-content;
			margin-left: auto;

			&:hover {
				color: $error;
			}
		}
	}
</style>
