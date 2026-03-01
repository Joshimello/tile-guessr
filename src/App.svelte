<script lang="ts">
import { useSpacetimeDB, useTable } from 'spacetimedb/svelte';
import { tables } from './module_bindings';
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

const myPlayer = $derived(
  $players.find(p => p.identity.toHexString() === $conn.identity?.toHexString())
);

const myMembership = $derived(
  $lobbyMembers.find(m => m.playerIdentity.toHexString() === $conn.identity?.toHexString())
);

const myLobby = $derived(
  myMembership ? $lobbies.find(l => l.id === myMembership.lobbyId) : undefined
);

const myLobbyMembers = $derived(
  myLobby ? $lobbyMembers.filter(m => m.lobbyId === myLobby!.id) : []
);

const myGameState = $derived(
  myLobby ? $gameStates.find(gs => gs.lobbyId === myLobby!.id) : undefined
);

// Own tile secrets (filter to current player)
const mySecrets = $derived(
  $conn.identity
    ? $tileSecrets.filter(s => s.ownerId.toHexString() === $conn.identity!.toHexString())
    : []
);
</script>

{#if !myPlayer}
  <NameEntry />
{:else if !myMembership || !myLobby}
  <LobbySelect playerName={myPlayer.name} />
{:else if myLobby.status === 'waiting'}
  <WaitingRoom lobby={myLobby} members={myLobbyMembers} players={$players} />
{:else if myLobby.status === 'in_game' && myGameState}
  <Game
    gameState={myGameState}
    tilePub={$tilePub}
    mySecrets={mySecrets}
    players={$players}
    myLobby={myLobby}
    members={myLobbyMembers}
  />
{/if}
