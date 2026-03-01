import { schema, table, t } from 'spacetimedb/server';

export const player = table(
  { name: 'player', public: true },
  {
    identity: t.identity().primaryKey(),
    name: t.string(),
    createdAt: t.timestamp(),
  }
);

export const lobby = table(
  {
    name: 'lobby',
    public: true,
    indexes: [
      { name: 'lobby_status', accessor: 'lobby_status', algorithm: 'btree', columns: ['status'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    maxPlayers: t.u32(),
    status: t.string(), // "waiting" | "starting" | "in_game"
    createdAt: t.timestamp(),
    gameStartsAt: t.u64().optional(), // micros since epoch; set when status = "starting"
  }
);

export const lobby_member = table(
  {
    name: 'lobby_member',
    public: true,
    indexes: [
      { name: 'lobby_member_lobby_id', accessor: 'lobby_member_lobby_id', algorithm: 'btree', columns: ['lobbyId'] },
      { name: 'lobby_member_player_identity', accessor: 'lobby_member_player_identity', algorithm: 'btree', columns: ['playerIdentity'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    lobbyId: t.u64(),
    playerIdentity: t.identity(),
    joinedAt: t.timestamp(),
    colorPreference: t.string(), // "4b"|"3b1w"|"2b2w"|"1b3w"|"4w" (4-tile) or "3b"|"2b1w"|"1b2w"|"3w" (3-tile)
  }
);

export const tile_pool = table(
  {
    name: 'tile_pool',
    indexes: [{ name: 'tile_pool_lobby_id', accessor: 'tile_pool_lobby_id', algorithm: 'btree', columns: ['lobbyId'] }],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    lobbyId: t.u64(),
    orderIndex: t.u8(),
    color: t.string(),
    value: t.u8(),
    isDrawn: t.bool(),
  }
);

export const tile_public = table(
  {
    name: 'tile_public',
    public: true,
    indexes: [
      { name: 'tile_public_lobby_id', accessor: 'tile_public_lobby_id', algorithm: 'btree', columns: ['lobbyId'] },
      { name: 'tile_public_owner', accessor: 'tile_public_owner', algorithm: 'btree', columns: ['ownerId'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    lobbyId: t.u64(),
    ownerId: t.identity(),
    color: t.string(),
    position: t.u8(),
    isRevealed: t.bool(),
    isInHand: t.bool(),
    revealedValue: t.u8().optional(),
    jokerSlot: t.u8().optional(), // Jokers only: number of non-Joker tiles to the left
  }
);

export const tile_secret = table(
  {
    name: 'tile_secret',
    public: true,
    indexes: [{ name: 'tile_secret_owner', accessor: 'tile_secret_owner', algorithm: 'btree', columns: ['ownerId'] }],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    tilePublicId: t.u64().unique(),
    ownerId: t.identity(),
    value: t.u8(),
  }
);

export const game_state = table(
  {
    name: 'game_state',
    public: true,
    indexes: [{ name: 'game_state_lobby_id', accessor: 'game_state_lobby_id', algorithm: 'btree', columns: ['lobbyId'] }],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    lobbyId: t.u64(),
    activePlayer: t.identity(),
    phase: t.string(), // "draw" | "attack"
    canEndTurn: t.bool(),
    inHandTileId: t.u64().optional(),
    winner: t.identity().optional(),
    lastAction: t.string().optional(),
    targetedTileId: t.u64().optional(), // Set when active player selects opponent tile before guessing
  }
);

const spacetimedb = schema({ player, lobby, lobby_member, tile_pool, tile_public, tile_secret, game_state });
export default spacetimedb;
