<script lang="ts">
import { useSpacetimeDB, useReducer } from 'spacetimedb/svelte';
import { reducers } from '../module_bindings';
import { fly } from 'svelte/transition';
import { flip } from 'svelte/animate';
import { cubicOut } from 'svelte/easing';
import type { GameState, TilePublic, TileSecret, Player, Lobby, LobbyMember } from '../module_bindings/types';
import { Button } from '$lib/components/ui/button';
import { Separator } from '$lib/components/ui/separator';
import * as Popover from '$lib/components/ui/popover';
import * as Dialog from '$lib/components/ui/dialog';

interface Props {
  gameState: GameState;
  tilePub: TilePublic[];
  mySecrets: TileSecret[];
  players: Player[];
  myLobby: Lobby;
  members: LobbyMember[];
  onLeave: () => void;
  onQueueAgain: (maxPlayers: number) => void;
}

const { gameState, tilePub, mySecrets, players, myLobby, members, onLeave, onQueueAgain }: Props = $props();

const conn = useSpacetimeDB();
const drawTileReducer = useReducer(reducers.drawTile);
const attackReducer = useReducer(reducers.attack);
const endTurnReducer = useReducer(reducers.endTurn);
const selectTargetReducer = useReducer(reducers.selectTarget);

// ── Derived state ───────────────────────────────────────────────────────────

const myId = $derived($conn.identity?.toHexString());

const isMyTurn = $derived(
  myId != null && gameState.activePlayer.toHexString() === myId
);

const lobbyTiles = $derived(
  tilePub.filter(t => t.lobbyId === myLobby.id)
);

// Pool counts by color
const blackDrawn = $derived(lobbyTiles.filter(t => t.color === 'black').length);
const whiteDrawn = $derived(lobbyTiles.filter(t => t.color === 'white').length);
const blackLeft = $derived(13 - blackDrawn);
const whiteLeft = $derived(13 - whiteDrawn);

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
      handTile: lobbyTiles.find(
        t => t.ownerId.toHexString() === m.playerIdentity.toHexString() && t.isInHand
      ),
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

const myPlayerName = $derived(
  players.find(p => p.identity.toHexString() === myId)?.name ?? ''
);

const didIWin = $derived(winnerName != null && winnerName === myPlayerName);

// Get value for a tile: own placed tiles use secret, drawn tile stays hidden, others use revealedValue
function tileValue(tile: TilePublic): number | null {
  if (tile.isRevealed) return tile.revealedValue ?? null;
  if (tile.isInHand) return null;
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
  if (selectedTileId === tile.id) {
    selectedTileId = null;
    selectTargetReducer({ lobbyId: myLobby.id, tileId: undefined });
  } else {
    selectedTileId = tile.id;
    selectTargetReducer({ lobbyId: myLobby.id, tileId: tile.id });
  }
  guessedValue = null;
}

function clearSelection() {
  if (selectedTileId != null) {
    selectTargetReducer({ lobbyId: myLobby.id, tileId: undefined });
  }
  selectedTileId = null;
  guessedValue = null;
}

// ── Joker placement state ─────────────────────────────────────────────────────

const handTileIsJoker = $derived(
  myHandTile != null && mySecrets.find(s => s.tilePublicId === myHandTile!.id)?.value === 0
);

let showJokerPicker = $state(false);
let selectedGap: number | null = $state(null);

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

function drawTile(color: 'black' | 'white') {
  drawTileReducer({ lobbyId: myLobby.id, color });
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


</script>

<div class="flex min-h-screen flex-col bg-background text-foreground">

  <!-- Action toast -->
  {#if actionToast}
    <div
      class="fixed top-4 left-1/2 z-50 -translate-x-1/2 pointer-events-none select-none
        animate-in slide-in-from-top-2 fade-in duration-200"
      in:fly={{ y: -12, duration: 200 }}
    >
      <div class="rounded-full px-5 py-2 text-sm font-semibold shadow-lg
        {actionIsCorrect
          ? 'bg-green-500 text-white'
          : 'bg-destructive text-destructive-foreground'}">
        {actionToast}
      </div>
    </div>
  {/if}

  <!-- Header -->
  <header class="flex items-center justify-between border-b bg-card px-4 py-3">
    <h1 class="text-lg font-bold tracking-wide">Tile Guessr</h1>
    <div class="text-sm">
      {#if winnerName}
        <span class="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">Game over</span>
      {:else if isMyTurn}
        <span class="rounded-full bg-green-500 px-3 py-1 text-white font-semibold">Your turn</span>
        <span class="ml-2 text-muted-foreground">{gameState.phase === 'draw' ? 'Draw a tile' : 'Attack!'}</span>
      {:else}
        <span class="text-muted-foreground">Waiting for {activePlayerName}…</span>
      {/if}
    </div>
    <!-- Pool counts by color -->
    <div class="flex items-center gap-1.5 text-sm font-mono font-semibold">
      <span class="flex items-center gap-1 rounded px-2 py-0.5 text-white" style="background-color: #5e81ac;">
        ■ {blackLeft}
      </span>
      <span class="flex items-center gap-1 rounded px-2 py-0.5 text-white" style="background-color: #bf616a;">
        ■ {whiteLeft}
      </span>
    </div>
  </header>

  <main class="flex flex-1 flex-col gap-6 overflow-auto p-4 pb-24">

    <!-- Win / loss dialog -->
    <Dialog.Root open={winnerName != null} onOpenChange={() => {}}>
      <Dialog.Content class="max-w-xs text-center">
        <Dialog.Header>
          <Dialog.Title class="text-2xl">
            {didIWin ? '🏆 You win!' : '💀 You lose'}
          </Dialog.Title>
          <Dialog.Description>
            {winnerName} won the game.
          </Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer class="mt-4 flex flex-col gap-2 sm:flex-col">
          <Button onclick={() => onQueueAgain(myLobby.maxPlayers)} class="w-full">
            Queue Again ({myLobby.maxPlayers}p)
          </Button>
          <Button variant="outline" onclick={onLeave} class="w-full">
            Return to Lobby
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>

    <!-- Opponents (shown above my tiles) -->
    {#each opponents as opp (opp.member.id)}
      <section>
        <h2 class="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {opp.player?.name ?? '?'}
          {#if opp.member.playerIdentity.toHexString() === gameState.activePlayer.toHexString()}
            <span class="ml-1 animate-pulse text-green-500">●</span>
          {/if}
        </h2>
        <div class="flex flex-wrap justify-center gap-3">
          {#each opp.tiles as tile, tileIdx (tile.id)}
            {@const isTargetable = !tile.isRevealed && !tile.isInHand && isMyTurn && gameState.phase === 'attack'}
            {@const isSelected = selectedTileId === tile.id}
            {@const pulseTile = isTargetable && selectedTileId === null}
            <div
              in:fly={{ y: -80, duration: 500, delay: 60 + tileIdx * 80, easing: cubicOut }}
              animate:flip={{ duration: 200, easing: cubicOut }}
            >
              <Popover.Root
                open={isSelected}
                onOpenChange={(open) => { if (!open) clearSelection(); }}
              >
                <Popover.Trigger>
                  {#snippet child({ props })}
                    <button
                      {...props}
                      onclick={() => isTargetable ? selectTile(tile) : undefined}
                      class="focus:outline-none"
                      class:cursor-pointer={isTargetable}
                      class:cursor-default={!isTargetable}
                      disabled={!isTargetable && !isSelected}
                    >
                      {@render TilePill({ tile, value: tileValue(tile), highlighted: isSelected, targetable: isTargetable, isOpponent: true, pulseTile })}
                    </button>
                  {/snippet}
                </Popover.Trigger>
                <Popover.Content side="bottom" align="center" class="w-auto p-3">
                  <p class="mb-2 text-xs text-muted-foreground text-center">Pick a value:</p>
                  <div class="grid grid-cols-7 gap-1">
                    {#each Array.from({length: 13}, (_, i) => i) as v}
                      <button
                        onclick={() => guessedValue = v}
                        class="h-9 w-9 rounded-lg text-sm font-bold transition-colors
                          {guessedValue === v
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}"
                      >
                        {v === 0 ? 'J' : v}
                      </button>
                    {/each}
                  </div>
                  {#if guessedValue != null}
                    <div class="mt-2 flex gap-2 justify-center">
                      <Button size="sm" onclick={guess}>
                        Guess {guessedValue === 0 ? 'Joker' : guessedValue}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onclick={clearSelection}
                      >
                        Cancel
                      </Button>
                    </div>
                  {/if}
                </Popover.Content>
              </Popover.Root>
            </div>
          {/each}
          <!-- Opponent in-hand tile (face-down) -->
          {#if opp.handTile}
            <div
              in:fly={{ y: -80, duration: 500, delay: 150, easing: cubicOut }}
            >
              <div class="flex flex-col items-center gap-4">
                <span class="text-xs text-amber-600 font-semibold">In hand</span>
                {@render TilePill({ tile: opp.handTile, value: null, inHand: true, isOpponent: true })}
              </div>
            </div>
          {/if}
          {#if opp.tiles.length === 0 && !opp.handTile}
            <span class="text-sm italic text-muted-foreground">Eliminated</span>
          {/if}
        </div>
      </section>
    {/each}

    <Separator />

    <!-- My lineup (below opponent tiles) -->
    <section>
      <h2 class="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Your tiles</h2>

      {#if showJokerPicker}
        <div class="rounded-xl border bg-card p-4">
          <p class="mb-3 text-sm font-semibold text-amber-600">
            Place your {myHandTile?.color} Joker — tap a gap to choose its position:
          </p>
          <div class="flex flex-wrap items-center justify-center gap-1">
            {#each Array.from({ length: myTiles.length + 1 }, (_, i) => i) as gapIdx}
              <button
                onclick={() => selectedGap = gapIdx}
                class="flex h-24 w-6 items-center justify-center rounded text-xs font-bold transition-colors
                  {selectedGap === gapIdx
                    ? 'bg-amber-400 text-black'
                    : 'bg-muted text-muted-foreground hover:bg-amber-100 hover:text-amber-700'}"
                title="Place Joker here"
              >↓</button>
              {#if gapIdx < myTiles.length}
                {@render TilePill({ tile: myTiles[gapIdx], value: tileValue(myTiles[gapIdx]) })}
              {/if}
            {/each}
          </div>
          <div class="mt-3 flex gap-2 justify-center">
            <Button
              onclick={confirmJokerPlacement}
              disabled={selectedGap === null}
              class="bg-amber-500 hover:bg-amber-400 text-black"
            >
              Confirm Placement
            </Button>
            <Button
              variant="outline"
              onclick={() => { showJokerPicker = false; selectedGap = null; }}
            >
              Cancel
            </Button>
          </div>
        </div>
      {:else}
        <div class="flex flex-wrap justify-center gap-3">
          {#each myTiles as tile, tileIdx (tile.id)}
            {@const isTargeted = !isMyTurn && gameState.targetedTileId != null && gameState.targetedTileId === tile.id}
            <div
              in:fly={{ y: 80, duration: 500, delay: 60 + tileIdx * 80, easing: cubicOut }}
              animate:flip={{ duration: 200, easing: cubicOut }}
            >
              {@render TilePill({ tile, value: tileValue(tile), isTargeted })}
            </div>
          {/each}
          {#if myHandTile}
            <div
              class="flex flex-col items-center gap-4 {myTiles.length > 0 ? 'ml-5 pl-5 border-l border-border/40' : ''}"
              in:fly={{ y: 80, duration: 500, delay: 60 + myTiles.length * 80, easing: cubicOut }}
            >
              <span class="text-xs text-amber-600 font-semibold">In hand</span>
              {@render TilePill({ tile: myHandTile, value: tileValue(myHandTile), inHand: true })}
            </div>
          {/if}
          {#if myTiles.length === 0 && !myHandTile}
            <span class="text-sm italic text-muted-foreground">No tiles</span>
          {/if}
        </div>
      {/if}
    </section>

  </main>

  <!-- Sticky bottom action bar -->
  {#if !winnerName}
    <div class="sticky bottom-0 border-t bg-background px-4 py-3">
      {#if !isMyTurn}
        <p class="text-center text-muted-foreground">Waiting for {activePlayerName}…</p>

      {:else if gameState.phase === 'draw'}
        <div class="flex justify-center gap-3">
          <Button
            onclick={() => drawTile('black')}
            disabled={blackLeft === 0}
            size="lg"
            class={blackLeft > 0 ? 'ring-2 ring-white/50 ring-offset-2 animate-pulse' : ''}
            style="background-color: #5e81ac; color: white; border: none;"
          >
            Draw ■ ({blackLeft})
          </Button>
          <Button
            onclick={() => drawTile('white')}
            disabled={whiteLeft === 0}
            size="lg"
            class={whiteLeft > 0 ? 'ring-2 ring-white/50 ring-offset-2 animate-pulse' : ''}
            style="background-color: #bf616a; color: white; border: none;"
          >
            Draw ■ ({whiteLeft})
          </Button>
        </div>

      {:else if gameState.phase === 'attack'}
        <div class="flex flex-wrap items-center justify-center gap-3">
          {#if !selectedTileId}
            <p class="text-sm text-muted-foreground">
              {gameState.canEndTurn
                ? 'Correct! Select another tile to attack or end turn.'
                : 'Select an opponent\'s hidden tile to attack.'}
            </p>
          {/if}
          {#if gameState.canEndTurn}
            <Button
              variant="secondary"
              class={!selectedTileId ? 'ring-2 ring-foreground/30 ring-offset-1 animate-pulse' : ''}
              onclick={endTurn}
            >
              {handTileIsJoker ? 'Place Joker…' : 'End Turn'}
            </Button>
          {/if}
        </div>
      {/if}
    </div>
  {:else}
    <!-- Spacer so the dialog isn't obscured -->
    <div class="h-16"></div>
  {/if}

</div>

<!-- Tile pill sub-component -->
{#snippet TilePill({ tile, value, highlighted = false, targetable = false, isOpponent = false, inHand = false, isTargeted = false, pulseTile = false }: {
  tile: TilePublic;
  value: number | null;
  highlighted?: boolean;
  targetable?: boolean;
  isOpponent?: boolean;
  inHand?: boolean;
  isTargeted?: boolean;
  pulseTile?: boolean;
})}
  <div
    class="
      flex h-24 w-16 select-none flex-col items-center justify-center rounded-xl border-2
      font-bold transition-all duration-200 text-white border-white/20
      {tile.isRevealed
        ? isOpponent ? 'translate-y-0 shadow-none' : 'translate-y-2 shadow-none'
        : '-translate-y-2 shadow-md'}
      {targetable && !highlighted ? 'hover:-translate-y-3 hover:shadow-lg' : ''}
      {highlighted ? 'ring-2 ring-primary ring-offset-2 shadow-lg' : ''}
      {inHand ? 'ring-2 ring-amber-400 ring-offset-1' : ''}
      {isTargeted ? 'ring-2 ring-yellow-400 ring-offset-2 animate-pulse' : ''}
      {pulseTile ? 'ring-2 ring-white/50 animate-pulse' : ''}
    "
    style="background-color: {tile.color === 'black' ? '#5e81ac' : '#bf616a'};"
  >
    {#if value != null}
      <span class="text-2xl leading-none">{value === 0 ? 'J' : value}</span>
    {:else}
      <span class="text-2xl leading-none text-white/50">?</span>
    {/if}
    <span class="mt-1 text-xs opacity-60">{tile.color === 'black' ? '■' : '□'}</span>
  </div>
{/snippet}
