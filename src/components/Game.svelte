<script lang="ts">
import { useSpacetimeDB, useReducer } from 'spacetimedb/svelte';
import { reducers } from '../module_bindings';
import { fly } from 'svelte/transition';
import { flip } from 'svelte/animate';
import { cubicOut } from 'svelte/easing';
import type { GameState, TilePublic, TileSecret, Player, Lobby, LobbyMember } from '../module_bindings/types';

interface Props {
  gameState: GameState;
  tilePub: TilePublic[];
  mySecrets: TileSecret[];
  players: Player[];
  myLobby: Lobby;
  members: LobbyMember[];
}

const { gameState, tilePub, mySecrets, players, myLobby, members }: Props = $props();

const conn = useSpacetimeDB();
const drawTileReducer = useReducer(reducers.drawTile);
const attackReducer = useReducer(reducers.attack);
const endTurnReducer = useReducer(reducers.endTurn);
const leaveLobbyReducer = useReducer(reducers.leaveLobby);

// ── Derived state ───────────────────────────────────────────────────────────

const myId = $derived($conn.identity?.toHexString());

const isMyTurn = $derived(
  myId != null && gameState.activePlayer.toHexString() === myId
);

const lobbyTiles = $derived(
  tilePub.filter(t => t.lobbyId === myLobby.id)
);

const poolLeft = $derived(
  26 - lobbyTiles.length
);

const myTiles = $derived(
  lobbyTiles
    .filter(t => t.ownerId.toHexString() === myId && !t.isInHand)
    .sort((a, b) => a.position - b.position)
);

const myHandTile = $derived(
  gameState.inHandTileId != null
    ? lobbyTiles.find(t => t.id === gameState.inHandTileId && t.ownerId.toHexString() === myId)
    : undefined
);

const opponents = $derived(
  members
    .filter(m => m.playerIdentity.toHexString() !== myId)
    .map(m => ({
      member: m,
      player: players.find(p => p.identity.toHexString() === m.playerIdentity.toHexString()),
      tiles: lobbyTiles
        .filter(t => t.ownerId.toHexString() === m.playerIdentity.toHexString() && !t.isInHand)
        .sort((a, b) => a.position - b.position),
    }))
);

const activePlayerName = $derived(
  players.find(p => p.identity.toHexString() === gameState.activePlayer.toHexString())?.name ?? '?'
);

const winnerName = $derived(
  gameState.winner != null
    ? players.find(p => p.identity.toHexString() === gameState.winner!.toHexString())?.name ?? '?'
    : null
);

// Get value for a tile: own placed tiles use secret, drawn tile stays hidden, others use revealedValue
function tileValue(tile: TilePublic): number | null {
  if (tile.isRevealed) return tile.revealedValue ?? null;
  if (tile.isInHand) return null; // drawn tile is always hidden
  if (tile.ownerId.toHexString() === myId) {
    return mySecrets.find(s => s.tilePublicId === tile.id)?.value ?? null;
  }
  return null;
}

// ── Attack state ─────────────────────────────────────────────────────────────

let selectedTileId: bigint | null = $state(null);
let guessedValue: number | null = $state(null);

const selectedTile = $derived(
  selectedTileId != null ? lobbyTiles.find(t => t.id === selectedTileId) : undefined
);

function selectTile(tile: TilePublic) {
  if (tile.isRevealed || tile.isInHand) return;
  if (tile.ownerId.toHexString() === myId) return;
  selectedTileId = tile.id;
  guessedValue = null;
}

// ── Joker placement state ─────────────────────────────────────────────────────

// Whether the in-hand tile is a Joker (value 0)
const handTileIsJoker = $derived(
  myHandTile != null && mySecrets.find(s => s.tilePublicId === myHandTile!.id)?.value === 0
);

let showJokerPicker = $state(false);
let selectedGap: number | null = $state(null); // index into myTiles gaps (0 = before first)

// Convert visual gap index → jokerSlot (number of non-Joker tiles to the left)
function gapToJokerSlot(gapIndex: number): number {
  let count = 0;
  for (let i = 0; i < gapIndex && i < myTiles.length; i++) {
    const v = myTiles[i].isRevealed
      ? myTiles[i].revealedValue
      : mySecrets.find(s => s.tilePublicId === myTiles[i].id)?.value;
    if (v !== 0 && v !== undefined) count++;
  }
  return count;
}

// Reset all selection state when phase resets
$effect(() => {
  if (gameState.phase === 'draw') {
    selectedTileId = null;
    guessedValue = null;
    showJokerPicker = false;
    selectedGap = null;
  }
});

// ── Action toast ──────────────────────────────────────────────────────────────

let actionToast: string | null = $state(null);
let actionIsCorrect = $state(false);
let toastTimer: ReturnType<typeof setTimeout> | null = null;

$effect(() => {
  const msg = gameState.lastAction;
  if (msg) {
    if (toastTimer) clearTimeout(toastTimer);
    actionToast = msg;
    actionIsCorrect = msg.startsWith('✓');
    toastTimer = setTimeout(() => { actionToast = null; }, 5000);
  }
});

// ── Actions ───────────────────────────────────────────────────────────────────

function drawTile() {
  drawTileReducer({ lobbyId: myLobby.id });
}

function guess() {
  if (selectedTileId == null || guessedValue == null) return;
  attackReducer({
    lobbyId: myLobby.id,
    targetTileId: selectedTileId,
    guessedValue,
  });
  selectedTileId = null;
  guessedValue = null;
}

function endTurn() {
  if (handTileIsJoker) {
    showJokerPicker = true;
  } else {
    endTurnReducer({ lobbyId: myLobby.id });
  }
}

function confirmJokerPlacement() {
  if (selectedGap === null) return;
  endTurnReducer({ lobbyId: myLobby.id, jokerSlot: gapToJokerSlot(selectedGap) });
  showJokerPicker = false;
  selectedGap = null;
}

function leaveLobby() {
  leaveLobbyReducer();
}
</script>

<div class="min-h-screen bg-gray-900 text-white flex flex-col">

  <!-- Action toast -->
  {#if actionToast}
    <div class="
      fixed top-4 left-1/2 -translate-x-1/2 z-50
      px-5 py-3 rounded-xl shadow-xl text-sm font-semibold
      pointer-events-none select-none
      {actionIsCorrect ? 'bg-green-600 text-white' : 'bg-red-700 text-white'}
    ">
      {actionToast}
    </div>
  {/if}

  <!-- Header -->
  <header class="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
    <h1 class="text-lg font-bold tracking-wide">Tile Guessr</h1>
    <div class="text-sm text-gray-300">
      {#if winnerName}
        <span class="text-yellow-400 font-semibold">Game over</span>
      {:else if isMyTurn}
        <span class="text-green-400 font-semibold">Your turn</span>
        — {gameState.phase === 'draw' ? 'Draw a tile' : 'Attack!'}
      {:else}
        <span class="text-gray-400">Waiting for {activePlayerName}…</span>
      {/if}
    </div>
    <div class="text-sm text-gray-400">Draw pile: <span class="font-mono text-white">{poolLeft}</span></div>
  </header>

  <main class="flex-1 flex flex-col gap-6 p-4 overflow-auto">

    <!-- Winner banner -->
    {#if winnerName}
      <div class="bg-yellow-500 text-black rounded-xl p-6 text-center shadow-lg">
        <div class="text-3xl font-bold mb-2">🏆 {winnerName} wins!</div>
        <button
          onclick={leaveLobby}
          class="mt-3 px-6 py-2 bg-black text-yellow-400 rounded-lg font-semibold hover:bg-gray-900 transition-colors"
        >
          Leave
        </button>
      </div>
    {/if}

    <!-- My lineup -->
    <section>
      <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Your tiles</h2>

      {#if showJokerPicker}
        <!-- Joker placement picker -->
        <div class="bg-gray-800 rounded-xl p-4 border border-yellow-500/40">
          <p class="text-sm text-yellow-300 font-semibold mb-3">
            Place your {myHandTile?.color} Joker — tap a gap to choose its position:
          </p>
          <div class="flex items-center flex-wrap gap-1">
            {#each Array.from({ length: myTiles.length + 1 }, (_, i) => i) as gapIdx}
              <button
                onclick={() => selectedGap = gapIdx}
                class="w-6 h-16 rounded flex items-center justify-center text-xs font-bold transition-colors
                  {selectedGap === gapIdx
                    ? 'bg-yellow-400 text-black'
                    : 'bg-gray-700 text-gray-400 hover:bg-yellow-500/30 hover:text-yellow-300'}"
                title="Place Joker here"
              >↓</button>
              {#if gapIdx < myTiles.length}
                {@render TilePill({ tile: myTiles[gapIdx], value: tileValue(myTiles[gapIdx]) })}
              {/if}
            {/each}
          </div>
          <div class="flex gap-2 mt-3">
            <button
              onclick={confirmJokerPlacement}
              disabled={selectedGap === null}
              class="px-5 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed text-black rounded-xl font-semibold transition-colors"
            >
              Confirm Placement
            </button>
            <button
              onclick={() => { showJokerPicker = false; selectedGap = null; }}
              class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl font-semibold transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      {:else}
        <div class="flex flex-wrap gap-2">
          {#each myTiles as tile (tile.id)}
            <div in:fly={{ y: 32, duration: 300, easing: cubicOut }} animate:flip={{ duration: 250 }}>
              {@render TilePill({ tile, value: tileValue(tile) })}
            </div>
          {/each}
          {#if myHandTile}
            <div class="flex flex-col items-center">
              <span class="text-xs text-yellow-300 mb-1">In hand</span>
              {@render TilePill({ tile: myHandTile, value: tileValue(myHandTile) })}
            </div>
          {/if}
          {#if myTiles.length === 0 && !myHandTile}
            <span class="text-gray-500 text-sm italic">No tiles</span>
          {/if}
        </div>
      {/if}
    </section>

    <!-- Opponents -->
    {#each opponents as opp (opp.member.id)}
      <section>
        <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
          {opp.player?.name ?? '?'}
          {#if opp.member.playerIdentity.toHexString() === gameState.activePlayer.toHexString()}
            <span class="text-green-400 ml-1">●</span>
          {/if}
        </h2>
        <div class="flex flex-wrap gap-2">
          {#each opp.tiles as tile (tile.id)}
            {@const isTargetable = !tile.isRevealed && !tile.isInHand && isMyTurn && gameState.phase === 'attack'}
            {@const isSelected = selectedTileId === tile.id}
            <div in:fly={{ y: 32, duration: 300, easing: cubicOut }} animate:flip={{ duration: 250 }}>
              <button
                onclick={() => isTargetable ? selectTile(tile) : null}
                class="focus:outline-none"
                class:cursor-pointer={isTargetable}
                class:cursor-default={!isTargetable}
                disabled={!isTargetable}
              >
                {@render TilePill({ tile, value: tileValue(tile), highlighted: isSelected, targetable: isTargetable })}
              </button>
            </div>
          {/each}
          {#if opp.tiles.length === 0}
            <span class="text-gray-500 text-sm italic">Eliminated</span>
          {/if}
        </div>
      </section>
    {/each}

    <!-- Action area -->
    {#if !winnerName}
      <section class="mt-auto border-t border-gray-700 pt-4">
        {#if !isMyTurn}
          <p class="text-gray-400 text-center">Waiting for {activePlayerName}…</p>

        {:else if gameState.phase === 'draw'}
          <div class="flex justify-center">
            <button
              onclick={drawTile}
              class="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-lg transition-colors"
            >
              Draw Tile
            </button>
          </div>

        {:else if gameState.phase === 'attack'}
          <div class="flex flex-col gap-4">

            {#if gameState.canEndTurn}
              <!-- Correct guess: can guess again or end turn -->
              <div class="flex justify-center gap-4">
                {#if selectedTileId != null}
                  <!-- Value picker for another attack -->
                  <div class="flex flex-col gap-2">
                    <p class="text-sm text-gray-300 text-center">Pick value to guess:</p>
                    <div class="flex flex-wrap gap-1 justify-center">
                      {#each Array.from({length: 13}, (_, i) => i) as v}
                        <button
                          onclick={() => guessedValue = v}
                          class="w-9 h-9 rounded-lg text-sm font-bold transition-colors {guessedValue === v ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
                        >
                          {v === 0 ? 'J' : v}
                        </button>
                      {/each}
                    </div>
                    {#if guessedValue != null}
                      <button
                        onclick={guess}
                        class="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-colors"
                      >
                        Guess {guessedValue === 0 ? 'Joker' : guessedValue}
                      </button>
                    {/if}
                  </div>
                {:else}
                  <p class="text-sm text-green-400">Correct! Select another tile to attack or end turn.</p>
                {/if}
                <button
                  onclick={endTurn}
                  class="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-xl font-semibold transition-colors self-end"
                >
                  {handTileIsJoker ? 'Place Joker…' : 'End Turn'}
                </button>
              </div>

            {:else}
              <!-- First attack this turn -->
              {#if selectedTileId == null}
                <p class="text-sm text-gray-300 text-center">Select an opponent's hidden tile to attack.</p>
              {:else}
                <div class="flex flex-col gap-2">
                  <p class="text-sm text-gray-300 text-center">
                    Attacking <span class="font-semibold text-white">{selectedTile?.color}</span> tile at position {selectedTile?.position} — pick a value:
                  </p>
                  <div class="flex flex-wrap gap-1 justify-center">
                    {#each Array.from({length: 13}, (_, i) => i) as v}
                      <button
                        onclick={() => guessedValue = v}
                        class="w-9 h-9 rounded-lg text-sm font-bold transition-colors {guessedValue === v ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
                      >
                        {v === 0 ? 'J' : v}
                      </button>
                    {/each}
                  </div>
                  {#if guessedValue != null}
                    <div class="flex gap-2 justify-center">
                      <button
                        onclick={guess}
                        class="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-colors"
                      >
                        Guess {guessedValue === 0 ? 'Joker' : guessedValue}
                      </button>
                      <button
                        onclick={() => { selectedTileId = null; guessedValue = null; }}
                        class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl font-semibold transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  {/if}
                </div>
              {/if}
            {/if}

          </div>
        {/if}
      </section>
    {/if}

  </main>
</div>

<!-- Tile pill sub-component -->
{#snippet TilePill({ tile, value, highlighted = false, targetable = false }: {
  tile: TilePublic;
  value: number | null;
  highlighted?: boolean;
  targetable?: boolean;
})}
  <div
    class="
      w-12 h-16 rounded-xl flex flex-col items-center justify-center text-sm font-bold select-none
      border-2 transition-all
      {tile.color === 'black'
        ? 'bg-gray-900 text-white border-gray-600'
        : 'bg-white text-gray-900 border-gray-300'}
      {highlighted ? '!border-blue-400 shadow-[0_0_0_2px_#60a5fa]' : ''}
      {targetable ? 'hover:border-yellow-400 hover:shadow-[0_0_0_2px_#facc15]' : ''}
      {tile.isRevealed ? '-translate-y-3 shadow-lg' : ''}
    "
  >
    {#if value != null}
      <span class="text-lg leading-none">{value === 0 ? 'J' : value}</span>
    {:else}
      <span class="text-xl leading-none text-gray-400">?</span>
    {/if}
    <span class="text-[9px] mt-1 opacity-50">{tile.color === 'black' ? '◼' : '◻'}</span>
  </div>
{/snippet}
