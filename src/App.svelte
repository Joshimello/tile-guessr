<script lang="ts">
	import './app.css';
	import { useSpacetimeDB, useTable, useReducer } from 'spacetimedb/svelte';
	import { tables, reducers } from './module_bindings';
	import NameEntry from './components/NameEntry.svelte';
	import LobbySelect from './components/LobbySelect.svelte';
	import WaitingRoom from './components/WaitingRoom.svelte';
	import Game from './components/Game.svelte';

	const conn = useSpacetimeDB();
	const [players] = useTable(tables.player);
	const [lobbies] = useTable(tables.lobby);
	const [lobbyMembers] = useTable(tables.lobby_member);
	const [tilePub] = useTable(tables.tile_public);
	const [tileSecrets] = useTable(tables.tile_secret);
	const [gameStates] = useTable(tables.game_state);

	const joinLobbyReducer = useReducer(reducers.joinLobby);
	const leaveLobbyReducer = useReducer(reducers.leaveLobby);

	const myPlayer = $derived($players.find((p) => p.identity.toHexString() === $conn.identity?.toHexString()));
	const myMembership = $derived($lobbyMembers.find((m) => m.playerIdentity.toHexString() === $conn.identity?.toHexString()));

	const myLobby = $derived(myMembership
		? $lobbies.find((l) => l.id === myMembership.lobbyId)
		: undefined);

	const myLobbyMembers = $derived(myLobby
		? $lobbyMembers.filter((m) => m.lobbyId === (myLobby!).id)
		: []);

	const myGameState = $derived(myLobby
		? $gameStates.find((gs) => gs.lobbyId === (myLobby!).id)
		: undefined);

	const mySecrets = $derived($conn.identity
		? $tileSecrets.filter((s) => s.ownerId.toHexString() === ($conn.identity!).toHexString())
		: []);

	// ── Queue-again flow ─────────────────────────────────────────────────────
	// When the user clicks "Queue Again" in the win/loss dialog we store their
	// desired maxPlayers, call leave_lobby, then auto-join once membership clears.

	let pendingQueueMaxPlayers: number | null = $state(null);

	$effect(() => {
		if (!myMembership && pendingQueueMaxPlayers !== null) {
			const mp = pendingQueueMaxPlayers;
			pendingQueueMaxPlayers = null;
			joinLobbyReducer({ maxPlayers: mp });
		}
	});

	function handleLeave() {
		leaveLobbyReducer();
	}

	function handleQueueAgain(maxPlayers: number) {
		pendingQueueMaxPlayers = maxPlayers;
		leaveLobbyReducer();
	}

	// ── Pre-game reveal animation ─────────────────────────────────────────────

	let showReveal = $state(false);
	let revealName = $state('');
	let revealDone = $state(false);
	let revealInterval: ReturnType<typeof setTimeout> | null = null;

	function runRevealAnimation(allNames: string[], winnerName: string) {
		revealDone = false;
		revealName = allNames[0] ?? '?';
		showReveal = true;

		const totalMs = 2500;
		const steps: number[] = [];
		let t = 0;
		let interval = 80;
		while (t < totalMs) {
			steps.push(interval);
			t += interval;
			interval = Math.min(interval * 1.08, 400);
		}

		let stepIdx = 0;
		let nameIdx = 0;

		function tick() {
			if (stepIdx >= steps.length) {
				revealName = winnerName;
				revealDone = true;
				setTimeout(() => { showReveal = false; }, 1500);
				return;
			}
			nameIdx = (nameIdx + 1) % allNames.length;
			revealName = allNames[nameIdx];
			revealInterval = setTimeout(tick, steps[stepIdx++]);
		}

		revealInterval = setTimeout(tick, steps[stepIdx++]);
	}

	const seenRevealKey = (gameId: bigint) => `reveal-seen-${gameId}`;
	let prevGameStateId: bigint | null = null;

	$effect(() => {
		const gs = myGameState;
		if (!gs) { prevGameStateId = null; return; }
		if (gs.id === prevGameStateId) return;
		prevGameStateId = gs.id;

		const key = seenRevealKey(gs.id);
		if (sessionStorage.getItem(key)) return;
		sessionStorage.setItem(key, '1');

		const allNames = myLobbyMembers
			.map(m => $players.find(p => p.identity.toHexString() === m.playerIdentity.toHexString())?.name ?? '?');
		const winnerName = $players.find(p => p.identity.toHexString() === gs.activePlayer.toHexString())?.name ?? '?';

		if (allNames.length === 0) return;
		if (revealInterval) { clearTimeout(revealInterval); revealInterval = null; }
		runRevealAnimation(allNames, winnerName);
	});
</script>

{#if showReveal}
	<div class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
		<div class="text-center select-none">
			<p class="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Goes first…</p>
			<div class="text-5xl font-black tracking-tight transition-all duration-75" style="min-width: 12rem;">
				{revealName}
			</div>
			{#if revealDone}
				<p class="mt-4 text-xl font-bold text-green-500 animate-in fade-in duration-300">goes first!</p>
			{/if}
		</div>
	</div>
{:else if !myPlayer}
	<NameEntry />
{:else if !myMembership || !myLobby}
	<LobbySelect playerName={myPlayer.name} />
{:else if myLobby.status === 'waiting' || myLobby.status === 'starting'}
	<WaitingRoom
		lobby={myLobby}
		members={myLobbyMembers}
		players={$players}
	/>
{:else if myLobby.status === 'in_game' && myGameState}
	<Game
		gameState={myGameState}
		tilePub={$tilePub}
		mySecrets={mySecrets}
		players={$players}
		myLobby={myLobby}
		members={myLobbyMembers}
		onLeave={handleLeave}
		onQueueAgain={handleQueueAgain}
	/>
{/if}
