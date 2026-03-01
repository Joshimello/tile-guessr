<script lang="ts">
import { useReducer } from 'spacetimedb/svelte';
import { reducers } from '../module_bindings';
import type { Lobby, LobbyMember, Player } from '../module_bindings/types';

interface Props {
  lobby: Lobby;
  members: LobbyMember[];
  players: Player[];
}

const { lobby, members, players }: Props = $props();

const leaveLobby = useReducer(reducers.leaveLobby);

function getPlayerName(member: LobbyMember): string {
  const p = players.find(pl => pl.identity.toHexString() === member.playerIdentity.toHexString());
  return p?.name ?? 'Unknown';
}

const filledSlots = $derived(members.length);
const emptySlots = $derived(lobby.maxPlayers - filledSlots);
</script>

<div class="flex min-h-screen items-center justify-center bg-slate-950">
  <div class="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
    <h1 class="mb-1 text-center text-2xl font-bold text-white">Waiting Room</h1>
    <p class="mb-6 text-center text-sm text-slate-400">
      {filledSlots} / {lobby.maxPlayers} players joined
    </p>

    <div class="mb-6 flex flex-col gap-2">
      {#each members as member}
        <div class="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3">
          <div class="h-2.5 w-2.5 rounded-full bg-green-400"></div>
          <span class="font-medium text-white">{getPlayerName(member)}</span>
        </div>
      {/each}

      {#each { length: emptySlots } as _}
        <div class="flex items-center gap-3 rounded-lg border border-dashed border-slate-700 px-4 py-3">
          <div class="h-2.5 w-2.5 rounded-full bg-slate-600"></div>
          <span class="text-slate-500">Waiting for player…</span>
        </div>
      {/each}
    </div>

    <button
      onclick={() => leaveLobby()}
      class="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-red-600 hover:bg-red-950 hover:text-red-400"
    >
      Leave Lobby
    </button>
  </div>
</div>
