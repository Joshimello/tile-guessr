<script lang="ts">
  import type { TilePublic, TileSecret, Player, LobbyMember } from '../../module_bindings/types';

  interface Props {
    // Status
    isMyTurn: boolean;
    phase: string;
    canEndTurn: boolean;
    winnerName: string | null;
    activePlayerName: string;
    poolLeft: number;

    // Opponents list (for name labels)
    opponents: Array<{
      player?: Player;
      member: LobbyMember;
      tiles: TilePublic[];
    }>;
    activePlayerId: string;

    // Attack selection state
    selectedTileId: bigint | null;
    selectedTile: TilePublic | undefined;
    guessedValue: number | null;

    // Joker placement state
    handTileIsJoker: boolean;
    showJokerPicker: boolean;
    selectedGap: number | null;
    myTiles: readonly TilePublic[];
    myHandTile: TilePublic | undefined;
    mySecrets: readonly TileSecret[];

    // Toast
    actionToast: string | null;
    actionIsCorrect: boolean;

    // Callbacks
    onDrawTile: () => void;
    onGuess: () => void;
    onEndTurn: () => void;
    onSetGuessedValue: (v: number) => void;
    onCancelSelection: () => void;
    onConfirmJokerPlacement: () => void;
    onCancelJokerPicker: () => void;
    onSetSelectedGap: (i: number) => void;
    onLeaveLobby: () => void;
  }

  const {
    isMyTurn, phase, canEndTurn, winnerName, activePlayerName, poolLeft,
    opponents, activePlayerId,
    selectedTileId, selectedTile, guessedValue,
    handTileIsJoker, showJokerPicker, selectedGap, myTiles, myHandTile, mySecrets,
    actionToast, actionIsCorrect,
    onDrawTile, onGuess, onEndTurn, onSetGuessedValue, onCancelSelection,
    onConfirmJokerPlacement, onCancelJokerPicker, onSetSelectedGap, onLeaveLobby,
  }: Props = $props();

  function tileDisplayValue(tile: TilePublic): number | null {
    if (tile.isRevealed) return tile.revealedValue ?? null;
    return mySecrets.find(s => s.tilePublicId === tile.id)?.value ?? null;
  }
</script>

<!-- Full-screen overlay; pointer-events disabled by default, re-enabled per-element -->
<div class="absolute inset-0 z-10 pointer-events-none select-none flex flex-col">

  <!-- Action toast -->
  {#if actionToast}
    <div class="
      absolute top-4 left-1/2 -translate-x-1/2
      px-5 py-3 rounded-xl shadow-xl text-sm font-semibold
      {actionIsCorrect ? 'bg-green-600 text-white' : 'bg-red-700 text-white'}
    ">
      {actionToast}
    </div>
  {/if}

  <!-- Header bar -->
  <header class="flex items-center justify-between px-4 py-2 bg-black/60 backdrop-blur-sm pointer-events-auto">
    <h1 class="text-base font-bold tracking-wide text-white">Tile Guessr</h1>
    <div class="text-sm text-gray-200">
      {#if winnerName}
        <span class="text-yellow-400 font-semibold">Game over</span>
      {:else if isMyTurn}
        <span class="text-green-400 font-semibold">Your turn</span>
        <span class="text-gray-300"> — {phase === 'draw' ? 'Draw a tile' : 'Attack!'}</span>
      {:else}
        <span class="text-gray-300">Waiting for <span class="text-white font-medium">{activePlayerName}</span>…</span>
      {/if}
    </div>
    <div class="text-sm text-gray-300">
      Draw pile: <span class="font-mono text-white">{poolLeft}</span>
    </div>
  </header>

  <!-- Opponent name labels (positioned loosely at top) -->
  <div class="flex justify-around px-8 pt-2 text-xs text-gray-300">
    {#each opponents as opp}
      <div class="bg-black/40 rounded px-2 py-1">
        <span class:text-green-400={opp.member.playerIdentity.toHexString() === activePlayerId}>
          {opp.player?.name ?? '?'}
          {#if opp.member.playerIdentity.toHexString() === activePlayerId}●{/if}
        </span>
      </div>
    {/each}
  </div>

  <!-- Spacer -->
  <div class="flex-1"></div>

  <!-- Bottom action area -->
  {#if winnerName}
    <!-- Winner banner -->
    <div class="mx-4 mb-4 bg-yellow-500 text-black rounded-xl p-5 text-center shadow-lg pointer-events-auto">
      <div class="text-2xl font-bold mb-2">🏆 {winnerName} wins!</div>
      <button
        onclick={onLeaveLobby}
        class="mt-2 px-6 py-2 bg-black text-yellow-400 rounded-lg font-semibold hover:bg-gray-900 transition-colors"
      >
        Leave
      </button>
    </div>

  {:else if showJokerPicker}
    <!-- Joker gap picker -->
    <div class="mx-4 mb-4 bg-gray-900/90 backdrop-blur-sm rounded-xl p-4 border border-yellow-500/40 pointer-events-auto">
      <p class="text-sm text-yellow-300 font-semibold mb-3">
        Place your {myHandTile?.color} Joker — tap a gap to choose its position:
      </p>
      <div class="flex items-center flex-wrap gap-1">
        {#each Array.from({ length: myTiles.length + 1 }, (_, i) => i) as gapIdx}
          <button
            onclick={() => onSetSelectedGap(gapIdx)}
            class="w-6 h-14 rounded flex items-center justify-center text-xs font-bold transition-colors
              {selectedGap === gapIdx
                ? 'bg-yellow-400 text-black'
                : 'bg-gray-700 text-gray-400 hover:bg-yellow-500/30 hover:text-yellow-300'}"
          >↓</button>
          {#if gapIdx < myTiles.length}
            {@const v = tileDisplayValue(myTiles[gapIdx])}
            <div class="
              w-10 h-14 rounded-lg flex flex-col items-center justify-center text-xs font-bold
              border
              {myTiles[gapIdx].color === 'black'
                ? 'bg-gray-900 text-white border-gray-600'
                : 'bg-white text-gray-900 border-gray-300'}
            ">
              {#if v != null}
                <span class="text-base leading-none">{v === 0 ? 'J' : v}</span>
              {:else}
                <span class="text-base text-gray-400">?</span>
              {/if}
            </div>
          {/if}
        {/each}
      </div>
      <div class="flex gap-2 mt-3">
        <button
          onclick={onConfirmJokerPlacement}
          disabled={selectedGap === null}
          class="px-5 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed text-black rounded-xl font-semibold transition-colors"
        >
          Confirm Placement
        </button>
        <button
          onclick={onCancelJokerPicker}
          class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl font-semibold transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>

  {:else if !isMyTurn}
    <!-- Waiting indicator -->
    <div class="mx-4 mb-4 text-center text-gray-400 text-sm bg-black/40 rounded-xl py-3">
      Waiting for <span class="text-white font-medium">{activePlayerName}</span>…
    </div>

  {:else if phase === 'draw'}
    <!-- Draw tile button -->
    <div class="flex justify-center mb-4 pointer-events-auto">
      <button
        onclick={onDrawTile}
        class="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-lg shadow-lg transition-colors"
      >
        Draw Tile
      </button>
    </div>

  {:else if phase === 'attack'}
    <div class="mx-4 mb-4 bg-gray-900/90 backdrop-blur-sm rounded-xl p-4 pointer-events-auto">

      {#if canEndTurn}
        <!-- After a correct guess: attack again or end turn -->
        <div class="flex flex-col gap-3">
          {#if selectedTileId != null}
            <p class="text-sm text-gray-300 text-center">Pick value to guess:</p>
            <div class="flex flex-wrap gap-1 justify-center">
              {#each Array.from({length: 13}, (_, i) => i) as v}
                <button
                  onclick={() => onSetGuessedValue(v)}
                  class="w-9 h-9 rounded-lg text-sm font-bold transition-colors
                    {guessedValue === v ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
                >
                  {v === 0 ? 'J' : v}
                </button>
              {/each}
            </div>
            {#if guessedValue != null}
              <div class="flex gap-2 justify-center">
                <button onclick={onGuess}
                  class="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-colors">
                  Guess {guessedValue === 0 ? 'Joker' : guessedValue}
                </button>
                <button onclick={onCancelSelection}
                  class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl font-semibold transition-colors">
                  Cancel
                </button>
              </div>
            {/if}
          {:else}
            <p class="text-sm text-green-400 text-center">Correct! Select another tile to attack or end turn.</p>
          {/if}
          <div class="flex justify-center">
            <button onclick={onEndTurn}
              class="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-xl font-semibold transition-colors">
              {handTileIsJoker ? 'Place Joker…' : 'End Turn'}
            </button>
          </div>
        </div>

      {:else}
        <!-- First attack this turn -->
        {#if selectedTileId == null}
          <p class="text-sm text-gray-300 text-center">Click an opponent's hidden tile to attack.</p>
        {:else}
          <div class="flex flex-col gap-2">
            <p class="text-sm text-gray-300 text-center">
              Attacking <span class="font-semibold text-white">{selectedTile?.color}</span>
              tile at position {selectedTile?.position} — pick a value:
            </p>
            <div class="flex flex-wrap gap-1 justify-center">
              {#each Array.from({length: 13}, (_, i) => i) as v}
                <button
                  onclick={() => onSetGuessedValue(v)}
                  class="w-9 h-9 rounded-lg text-sm font-bold transition-colors
                    {guessedValue === v ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
                >
                  {v === 0 ? 'J' : v}
                </button>
              {/each}
            </div>
            {#if guessedValue != null}
              <div class="flex gap-2 justify-center">
                <button onclick={onGuess}
                  class="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-colors">
                  Guess {guessedValue === 0 ? 'Joker' : guessedValue}
                </button>
                <button onclick={onCancelSelection}
                  class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl font-semibold transition-colors">
                  Cancel
                </button>
              </div>
            {/if}
          </div>
        {/if}
      {/if}

    </div>
  {/if}

</div>
