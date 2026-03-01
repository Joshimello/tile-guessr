import spacetimedb from './schema';
export { default } from './schema';
import { t, SenderError } from 'spacetimedb/server';

// ── Helpers ───────────────────────────────────────────────────────────────────

function recalcPositions(ctx: any, playerId: any, lobbyId: bigint): void {
  const tiles = [...ctx.db.tile_public.tile_public_owner.filter(playerId)]
    .filter((tp: any) => tp.lobbyId === lobbyId && !tp.isInHand);
  const secrets = [...ctx.db.tile_secret.tile_secret_owner.filter(playerId)];
  const secretMap = new Map<bigint, number>(secrets.map((s: any) => [s.tilePublicId, s.value]));

  // Get effective value for each tile (secret for hidden, revealedValue for revealed)
  const tilesWithValue = tiles.map((tp: any) => ({
    tile: tp,
    value: tp.isRevealed ? (tp.revealedValue ?? 0) : (secretMap.get(tp.id) ?? 0),
  }));

  const jokers = tilesWithValue.filter(t => t.value === 0);
  const nonJokers = tilesWithValue.filter(t => t.value !== 0);

  // Sort non-Jokers by (value ASC, black < white)
  nonJokers.sort((a: any, b: any) => {
    if (a.value !== b.value) return a.value - b.value;
    if (a.tile.color !== b.tile.color) return a.tile.color === 'black' ? -1 : 1;
    return 0;
  });

  // Interleave: jokerSlot = number of non-Joker tiles to the left of this Joker
  const result: any[] = [];
  for (let slot = 0; slot <= nonJokers.length; slot++) {
    for (const j of jokers) {
      if ((j.tile.jokerSlot ?? 0) === slot) result.push(j.tile);
    }
    if (slot < nonJokers.length) result.push(nonJokers[slot].tile);
  }

  for (let i = 0; i < result.length; i++) {
    if (result[i].position !== i) {
      ctx.db.tile_public.id.update({ ...result[i], position: i });
    }
  }
}

function getNextActivePlayer(ctx: any, members: any[], currentSender: any, lobbyId: bigint): any {
  const sorted = [...members].sort((a: any, b: any) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const currentIdx = sorted.findIndex((m: any) => m.playerIdentity.toHexString() === currentSender.toHexString());

  for (let i = 1; i <= sorted.length; i++) {
    const nextIdx = (currentIdx + i) % sorted.length;
    const m = sorted[nextIdx];
    const mTiles = [...ctx.db.tile_public.tile_public_owner.filter(m.playerIdentity)]
      .filter((tp: any) => tp.lobbyId === lobbyId && !tp.isInHand);
    if (mTiles.some((tp: any) => !tp.isRevealed)) {
      return m.playerIdentity;
    }
  }
  // Fallback: return first member (shouldn't reach here if game isn't over)
  return sorted[0].playerIdentity;
}

function cleanupGame(ctx: any, lobbyId: bigint): void {
  // Delete all tile secrets and tile publics for this lobby
  const lobbyTiles = [...ctx.db.tile_public.tile_public_lobby_id.filter(lobbyId)];
  for (const tp of lobbyTiles) {
    const secret = ctx.db.tile_secret.tilePublicId.find(tp.id);
    if (secret) ctx.db.tile_secret.id.delete(secret.id);
    ctx.db.tile_public.id.delete(tp.id);
  }
  // Delete tile pool
  for (const tp of [...ctx.db.tile_pool.tile_pool_lobby_id.filter(lobbyId)]) {
    ctx.db.tile_pool.id.delete(tp.id);
  }
  // Delete game state
  const gs = [...ctx.db.game_state.game_state_lobby_id.filter(lobbyId)][0];
  if (gs) ctx.db.game_state.id.delete(gs.id);
  // Delete remaining lobby members and lobby
  for (const m of [...ctx.db.lobby_member.lobby_member_lobby_id.filter(lobbyId)]) {
    ctx.db.lobby_member.id.delete(m.id);
  }
  ctx.db.lobby.id.delete(lobbyId);
}

function doLeave(ctx: any): void {
  const memberships = [...ctx.db.lobby_member.lobby_member_player_identity.filter(ctx.sender)];
  for (const membership of memberships) {
    const lobbyId = membership.lobbyId;
    const lobby = ctx.db.lobby.id.find(lobbyId);
    if (!lobby) continue;

    ctx.db.lobby_member.id.delete(membership.id);
    const remaining = [...ctx.db.lobby_member.lobby_member_lobby_id.filter(lobbyId)];

    if (lobby.status !== 'in_game') {
      if (remaining.length === 0) ctx.db.lobby.id.delete(lobbyId);
      continue;
    }

    const gs = [...ctx.db.game_state.game_state_lobby_id.filter(lobbyId)][0];

    if (!gs || remaining.length === 0) {
      cleanupGame(ctx, lobbyId);
      continue;
    }

    if (gs.winner !== undefined) {
      // Game was already won — remaining players are viewing the win screen.
      // Clean up only when the last player leaves.
      continue;
    }

    // Game in progress: determine forfeit outcome
    const playersWithHiddenTiles = remaining.filter((m: any) => {
      const mTiles = [...ctx.db.tile_public.tile_public_owner.filter(m.playerIdentity)]
        .filter((tp: any) => tp.lobbyId === lobbyId && !tp.isInHand);
      return mTiles.some((tp: any) => !tp.isRevealed);
    });

    if (playersWithHiddenTiles.length === 1) {
      // Award forfeit win — remaining player sees win banner, cleans up when they leave
      ctx.db.game_state.id.update({ ...gs, winner: playersWithHiddenTiles[0].playerIdentity, inHandTileId: undefined });
    } else if (playersWithHiddenTiles.length === 0) {
      cleanupGame(ctx, lobbyId);
    } else {
      // 2+ players still in the game — advance turn if the leaver was active
      if (gs.activePlayer.toHexString() === ctx.sender.toHexString()) {
        if (gs.inHandTileId !== undefined) {
          const inHandTile = ctx.db.tile_public.id.find(gs.inHandTileId);
          const inHandSecret = ctx.db.tile_secret.tilePublicId.find(gs.inHandTileId);
          if (inHandTile && inHandSecret) {
            ctx.db.tile_public.id.update({
              ...inHandTile, isRevealed: true, revealedValue: inHandSecret.value, isInHand: false,
              jokerSlot: inHandSecret.value === 0 ? 0 : undefined,
            });
          }
        }
        const nextPlayer = getNextActivePlayer(ctx, remaining, ctx.sender, lobbyId);
        ctx.db.game_state.id.update({ ...gs, phase: 'draw', canEndTurn: false, inHandTileId: undefined, activePlayer: nextPlayer });
      }
    }
  }
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

export const onConnect = spacetimedb.clientConnected((_ctx) => {
  // Nothing to do on connect — player row is created via set_name
});

export const onDisconnect = spacetimedb.clientDisconnected((ctx) => {
  doLeave(ctx);
  // Delete player row so the name is cleared on disconnect/refresh
  const player = ctx.db.player.identity.find(ctx.sender);
  if (player) ctx.db.player.identity.delete(ctx.sender);
});

// ── Reducers ─────────────────────────────────────────────────────────────────

export const set_name = spacetimedb.reducer({ name: t.string() }, (ctx, { name }) => {
  const trimmed = name.trim();
  if (!trimmed) throw new SenderError('Name cannot be empty');
  if (trimmed.length > 24) throw new SenderError('Name must be 24 characters or fewer');

  const existing = ctx.db.player.identity.find(ctx.sender);
  if (existing) {
    ctx.db.player.identity.update({ ...existing, name: trimmed });
  } else {
    ctx.db.player.insert({ identity: ctx.sender, name: trimmed, createdAt: ctx.timestamp });
  }
});

export const join_lobby = spacetimedb.reducer({ maxPlayers: t.u32() }, (ctx, { maxPlayers }) => {
  if (maxPlayers !== 2 && maxPlayers !== 3 && maxPlayers !== 4) {
    throw new SenderError('maxPlayers must be 2, 3, or 4');
  }

  const pl = ctx.db.player.identity.find(ctx.sender);
  if (!pl) throw new SenderError('You must set a name before joining a lobby');

  const existingMemberships = [...ctx.db.lobby_member.lobby_member_player_identity.filter(ctx.sender)];
  if (existingMemberships.length > 0) throw new SenderError('You are already in a lobby');

  // Find an open "waiting" lobby with matching maxPlayers that has space
  let targetLobbyId: bigint | null = null;
  for (const lb of ctx.db.lobby.lobby_status.filter('waiting')) {
    if (lb.maxPlayers !== maxPlayers) continue;
    const memberCount = [...ctx.db.lobby_member.lobby_member_lobby_id.filter(lb.id)].length;
    if (memberCount < maxPlayers) {
      targetLobbyId = lb.id;
      break;
    }
  }

  if (targetLobbyId === null) {
    const newLobby = ctx.db.lobby.insert({
      id: 0n,
      maxPlayers,
      status: 'waiting',
      createdAt: ctx.timestamp,
    });
    targetLobbyId = newLobby.id;
  }

  ctx.db.lobby_member.insert({
    id: 0n,
    lobbyId: targetLobbyId,
    playerIdentity: ctx.sender,
    joinedAt: ctx.timestamp,
  });

  const allMembers = [...ctx.db.lobby_member.lobby_member_lobby_id.filter(targetLobbyId)];
  if (allMembers.length >= maxPlayers) {
    const lb = ctx.db.lobby.id.find(targetLobbyId);
    if (lb) {
      ctx.db.lobby.id.update({ ...lb, status: 'in_game' });

      // ── Game initialization ──────────────────────────────────────────────
      const members = allMembers.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
      const tilesPerPlayer = members.length === 4 ? 3 : 4;

      // Build deck: 2 colors × 13 values (0–12)
      const deck: Array<{ color: string; value: number }> = [];
      for (let v = 0; v <= 12; v++) {
        deck.push({ color: 'black', value: v });
        deck.push({ color: 'white', value: v });
      }

      // LCG Fisher-Yates shuffle
      let s = ctx.timestamp.microsSinceUnixEpoch;
      for (let i = 25; i >= 1; i--) {
        s = BigInt.asUintN(64, s * 6364136223846793005n + 1442695040888963407n);
        const j = Number(s % BigInt(i + 1));
        const tmp = deck[i];
        deck[i] = deck[j];
        deck[j] = tmp;
      }

      // Insert all 26 tiles into tile_pool
      const poolRows: Array<{ id: bigint; color: string; value: number }> = [];
      for (let i = 0; i < deck.length; i++) {
        const row = ctx.db.tile_pool.insert({
          id: 0n, lobbyId: targetLobbyId,
          orderIndex: i, color: deck[i].color, value: deck[i].value, isDrawn: false,
        });
        poolRows.push({ id: row.id, color: deck[i].color, value: deck[i].value });
      }

      // Deal tiles to each player
      let deckIdx = 0;
      for (const member of members) {
        const hand = poolRows.slice(deckIdx, deckIdx + tilesPerPlayer);
        deckIdx += tilesPerPlayer;

        // Sort hand: value ASC, black before white
        const sorted = [...hand].sort((a, b) => {
          if (a.value !== b.value) return a.value - b.value;
          return a.color === 'black' ? -1 : 1;
        });

        for (let pos = 0; pos < sorted.length; pos++) {
          const poolRow = ctx.db.tile_pool.id.find(sorted[pos].id)!;
          ctx.db.tile_pool.id.update({ ...poolRow, isDrawn: true });
          const pub = ctx.db.tile_public.insert({
            id: 0n, lobbyId: targetLobbyId, ownerId: member.playerIdentity,
            color: sorted[pos].color, position: pos,
            isRevealed: false, isInHand: false, revealedValue: undefined,
            jokerSlot: sorted[pos].value === 0 ? 0 : undefined,
          });
          ctx.db.tile_secret.insert({
            id: 0n, tilePublicId: pub.id, ownerId: member.playerIdentity, value: sorted[pos].value,
          });
        }
      }

      // Insert initial game state
      ctx.db.game_state.insert({
        id: 0n, lobbyId: targetLobbyId,
        activePlayer: members[0].playerIdentity,
        phase: 'draw', canEndTurn: false,
        inHandTileId: undefined, winner: undefined, lastAction: undefined,
      });
    }
  }
});

export const leave_lobby = spacetimedb.reducer({}, (ctx, _params) => {
  doLeave(ctx);
});

export const draw_tile = spacetimedb.reducer({ lobbyId: t.u64() }, (ctx, { lobbyId }) => {
  const gs = [...ctx.db.game_state.game_state_lobby_id.filter(lobbyId)][0];
  if (!gs) throw new SenderError('Game not found');
  if (gs.winner !== undefined) throw new SenderError('Game is over');
  if (gs.activePlayer.toHexString() !== ctx.sender.toHexString()) throw new SenderError('Not your turn');
  if (gs.phase !== 'draw') throw new SenderError('Not in draw phase');

  // Find first undrawn tile in pool
  const poolTiles = [...ctx.db.tile_pool.tile_pool_lobby_id.filter(lobbyId)]
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const nextTile = poolTiles.find(tp => !tp.isDrawn);
  if (!nextTile) throw new SenderError('No tiles remaining');

  ctx.db.tile_pool.id.update({ ...nextTile, isDrawn: true });

  const pub = ctx.db.tile_public.insert({
    id: 0n, lobbyId, ownerId: ctx.sender,
    color: nextTile.color, position: 99,
    isRevealed: false, isInHand: true, revealedValue: undefined, jokerSlot: undefined,
  });
  ctx.db.tile_secret.insert({
    id: 0n, tilePublicId: pub.id, ownerId: ctx.sender, value: nextTile.value,
  });

  ctx.db.game_state.id.update({ ...gs, inHandTileId: pub.id, phase: 'attack', lastAction: undefined });
});

export const attack = spacetimedb.reducer(
  { lobbyId: t.u64(), targetTileId: t.u64(), guessedValue: t.u8() },
  (ctx, { lobbyId, targetTileId, guessedValue }) => {
    const gs = [...ctx.db.game_state.game_state_lobby_id.filter(lobbyId)][0];
    if (!gs) throw new SenderError('Game not found');
    if (gs.winner !== undefined) throw new SenderError('Game is over');
    if (gs.activePlayer.toHexString() !== ctx.sender.toHexString()) throw new SenderError('Not your turn');
    if (gs.phase !== 'attack') throw new SenderError('Not in attack phase');
    if (gs.inHandTileId === undefined) throw new SenderError('No tile in hand');

    const target = ctx.db.tile_public.id.find(targetTileId);
    if (!target) throw new SenderError('Target tile not found');
    if (target.lobbyId !== lobbyId) throw new SenderError('Target tile not in this lobby');
    if (target.ownerId.toHexString() === ctx.sender.toHexString()) throw new SenderError('Cannot attack your own tile');
    if (target.isRevealed) throw new SenderError('Target tile is already revealed');
    if (target.isInHand) throw new SenderError('Cannot target a tile in hand');

    const secret = ctx.db.tile_secret.tilePublicId.find(targetTileId);
    if (!secret) throw new SenderError('Target secret not found');

    const attackerName = ctx.db.player.identity.find(ctx.sender)?.name ?? '?';
    const targetOwnerName = ctx.db.player.identity.find(target.ownerId)?.name ?? '?';
    const guessLabel = guessedValue === 0 ? 'Joker' : String(guessedValue);
    const colorLabel = target.color;

    if (guessedValue === secret.value) {
      // ── Correct guess ────────────────────────────────────────────────────
      ctx.db.tile_public.id.update({ ...target, isRevealed: true, revealedValue: secret.value });

      // Check if target player is eliminated
      const targetTiles = [...ctx.db.tile_public.tile_public_owner.filter(target.ownerId)]
        .filter((tp: any) => tp.lobbyId === lobbyId && !tp.isInHand && tp.id !== targetTileId);
      const targetEliminated = !targetTiles.some((tp: any) => !tp.isRevealed);

      let winner: any = undefined;
      if (targetEliminated) {
        const members = [...ctx.db.lobby_member.lobby_member_lobby_id.filter(lobbyId)];
        const playersWithHiddenTiles = members.filter((m: any) => {
          const mTiles = [...ctx.db.tile_public.tile_public_owner.filter(m.playerIdentity)]
            .filter((tp: any) => tp.lobbyId === lobbyId && !tp.isInHand);
          return mTiles.some((tp: any) => !tp.isRevealed);
        });
        if (playersWithHiddenTiles.length === 1) {
          winner = playersWithHiddenTiles[0].playerIdentity;
        }
      }

      const lastAction = `✓ ${attackerName} correctly guessed ${targetOwnerName}'s ${colorLabel} tile as ${guessLabel}!`;
      ctx.db.game_state.id.update({ ...gs, canEndTurn: true, winner, lastAction });
    } else {
      // ── Wrong guess ──────────────────────────────────────────────────────
      const inHandTile = ctx.db.tile_public.id.find(gs.inHandTileId);
      if (!inHandTile) throw new SenderError('In-hand tile not found');
      const inHandSecret = ctx.db.tile_secret.tilePublicId.find(gs.inHandTileId);
      if (!inHandSecret) throw new SenderError('In-hand secret not found');

      // Reveal in-hand tile and place it (Jokers default to slot 0 when force-revealed)
      ctx.db.tile_public.id.update({
        ...inHandTile, isRevealed: true, revealedValue: inHandSecret.value, isInHand: false,
        jokerSlot: inHandSecret.value === 0 ? 0 : undefined,
      });

      // Recalculate positions for sender (includes newly placed tile)
      recalcPositions(ctx, ctx.sender, lobbyId);

      const members = [...ctx.db.lobby_member.lobby_member_lobby_id.filter(lobbyId)];
      const nextPlayer = getNextActivePlayer(ctx, members, ctx.sender, lobbyId);
      const lastAction = `✗ ${attackerName} guessed ${guessLabel} on ${targetOwnerName}'s ${colorLabel} tile — wrong!`;
      ctx.db.game_state.id.update({ ...gs, phase: 'draw', canEndTurn: false, inHandTileId: undefined, activePlayer: nextPlayer, lastAction });
    }
  }
);

export const end_turn = spacetimedb.reducer({ lobbyId: t.u64(), jokerSlot: t.u8().optional() }, (ctx, { lobbyId, jokerSlot }) => {
  const gs = [...ctx.db.game_state.game_state_lobby_id.filter(lobbyId)][0];
  if (!gs) throw new SenderError('Game not found');
  if (gs.winner !== undefined) throw new SenderError('Game is over');
  if (gs.activePlayer.toHexString() !== ctx.sender.toHexString()) throw new SenderError('Not your turn');
  if (gs.phase !== 'attack') throw new SenderError('Not in attack phase');
  if (!gs.canEndTurn) throw new SenderError('Cannot end turn yet');
  if (gs.inHandTileId === undefined) throw new SenderError('No tile in hand');

  const inHandTile = ctx.db.tile_public.id.find(gs.inHandTileId);
  if (!inHandTile) throw new SenderError('In-hand tile not found');

  const inHandSecret = ctx.db.tile_secret.tilePublicId.find(gs.inHandTileId);
  if (!inHandSecret) throw new SenderError('In-hand secret not found');

  const isJoker = inHandSecret.value === 0;
  if (isJoker && jokerSlot === undefined) throw new SenderError('Joker placement required: specify jokerSlot');

  // Place hand tile face-down, recording jokerSlot for Jokers
  ctx.db.tile_public.id.update({
    ...inHandTile, isInHand: false, isRevealed: false,
    jokerSlot: isJoker ? jokerSlot : undefined,
  });

  // Recalculate positions for sender
  recalcPositions(ctx, ctx.sender, lobbyId);

  const members = [...ctx.db.lobby_member.lobby_member_lobby_id.filter(lobbyId)];
  const nextPlayer = getNextActivePlayer(ctx, members, ctx.sender, lobbyId);
  ctx.db.game_state.id.update({ ...gs, phase: 'draw', canEndTurn: false, inHandTileId: undefined, activePlayer: nextPlayer });
});
