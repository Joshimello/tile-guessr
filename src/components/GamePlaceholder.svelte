<script lang="ts">
import type { Lobby, LobbyMember, Player } from '../module_bindings/types';

interface Props {
  lobby: Lobby;
  members: LobbyMember[];
  players: Player[];
}

const { members, players }: Props = $props();

function getPlayerName(member: LobbyMember): string {
  const p = players.find(pl => pl.identity.toHexString() === member.playerIdentity.toHexString());
  return p?.name ?? 'Unknown';
}
</script>

<div class="flex min-h-screen items-center justify-center bg-slate-950">
  <div class="w-full max-w-sm rounded-xl border border-indigo-800 bg-slate-900 p-8 shadow-xl">
    <div class="mb-4 text-center text-4xl">🎮</div>
    <h1 class="mb-1 text-center text-2xl font-bold text-white">Game Starting!</h1>
    <p class="mb-6 text-center text-sm text-slate-400">All players have joined</p>

    <div class="flex flex-col gap-2">
      {#each members as member}
        <div class="flex items-center gap-3 rounded-lg border border-indigo-800 bg-indigo-950 px-4 py-3">
          <div class="h-2.5 w-2.5 rounded-full bg-indigo-400"></div>
          <span class="font-medium text-indigo-100">{getPlayerName(member)}</span>
        </div>
      {/each}
    </div>

    <p class="mt-6 text-center text-xs text-slate-600">Game logic coming in Phase 2…</p>
  </div>
</div>
