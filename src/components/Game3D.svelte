<script lang="ts">
  import { Canvas } from '@threlte/core';
  import { useSpacetimeDB, useReducer } from 'spacetimedb/svelte';
  import { reducers } from '../module_bindings';
  import type { GameState, TilePublic, TileSecret, Player, Lobby, LobbyMember } from '../module_bindings/types';
  import GameScene from './game3d/GameScene.svelte';
  import GameHUD from './game3d/GameHUD.svelte';
  import type { TileRenderData } from './game3d/PlayerSeat.svelte';

  interface Props {
    gameState: GameState;
    tilePub: readonly TilePublic[];
    mySecrets: readonly TileSecret[];
    players: readonly Player[];
    myLobby: Lobby;
    members: readonly LobbyMember[];
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

  const poolLeft = $derived(26 - lobbyTiles.length);

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
    selectedTileId = tile.id;
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
      endTurnReducer({ lobbyId: myLobby.id, jokerSlot: undefined });
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

  // ── 3D tile render data ───────────────────────────────────────────────────────

  const myTileData = $derived<TileRenderData[]>(
    myTiles.map(tile => ({
      id: tile.id,
      color: tile.color,
      value: tileValue(tile),
      isRevealed: tile.isRevealed,
      isInHand: false,
      isOwn: true,
      isTargetable: false,
      isSelected: false,
      onselect: undefined,
    }))
  );

  const myHandTileData = $derived<TileRenderData | undefined>(
    myHandTile ? {
      id: myHandTile.id,
      color: myHandTile.color,
      value: null, // drawn tile stays face-down
      isRevealed: false,
      isInHand: true,
      isOwn: true,
      isTargetable: false,
      isSelected: false,
    } : undefined
  );

  const opponentSeatData = $derived(
    opponents.map(opp => ({
      tiles: opp.tiles.map((tile): TileRenderData => {
        const isTargetable = !tile.isRevealed && !tile.isInHand && isMyTurn && gameState.phase === 'attack';
        return {
          id: tile.id,
          color: tile.color,
          value: tileValue(tile),
          isRevealed: tile.isRevealed,
          isInHand: false,
          isOwn: false,
          isTargetable,
          isSelected: selectedTileId === tile.id,
          onselect: isTargetable ? () => selectTile(tile) : undefined,
        };
      }),
      handTile: undefined,
    }))
  );
</script>

<div class="relative w-full h-screen overflow-hidden" style="background:#ECEFF4">
  <Canvas>
    <GameScene
      myTiles={myTileData}
      myHandTile={myHandTileData}
      opponentSeats={opponentSeatData}
    />
  </Canvas>

  <GameHUD
    {isMyTurn}
    phase={gameState.phase}
    canEndTurn={gameState.canEndTurn}
    {winnerName}
    {activePlayerName}
    {poolLeft}
    {opponents}
    activePlayerId={gameState.activePlayer.toHexString()}
    {selectedTileId}
    {selectedTile}
    {guessedValue}
    {handTileIsJoker}
    {showJokerPicker}
    {selectedGap}
    {myTiles}
    {myHandTile}
    {mySecrets}
    {actionToast}
    {actionIsCorrect}
    onDrawTile={drawTile}
    onGuess={guess}
    onEndTurn={endTurn}
    onSetGuessedValue={(v) => { guessedValue = v; }}
    onCancelSelection={() => { selectedTileId = null; guessedValue = null; }}
    onConfirmJokerPlacement={confirmJokerPlacement}
    onCancelJokerPicker={() => { showJokerPicker = false; selectedGap = null; }}
    onSetSelectedGap={(i) => { selectedGap = i; }}
    onLeaveLobby={leaveLobby}
  />
</div>
