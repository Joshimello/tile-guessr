<script lang="ts">
import { useSpacetimeDB, useReducer } from 'spacetimedb/svelte';
import { reducers } from '../module_bindings';
import type { Lobby, LobbyMember, Player } from '../module_bindings/types';
import { Button } from '$lib/components/ui/button';
import * as Card from '$lib/components/ui/card';

interface Props {
  lobby: Lobby;
  members: LobbyMember[];
  players: Player[];
}

const { lobby, members, players }: Props = $props();

const conn = useSpacetimeDB();
const leaveLobby = useReducer(reducers.leaveLobby);
const setColorPreference = useReducer(reducers.setColorPreference);
const confirmStart = useReducer(reducers.confirmStart);

function getPlayerName(member: LobbyMember): string {
  const p = players.find(pl => pl.identity.toHexString() === member.playerIdentity.toHexString());
  return p?.name ?? 'Unknown';
}

const filledSlots = $derived(members.length);
const emptySlots = $derived(lobby.maxPlayers - filledSlots);
const isStarting = $derived(lobby.status === 'starting');

// Countdown display
let secondsLeft = $state(0);

$effect(() => {
  if (!isStarting || lobby.gameStartsAt == null) {
    secondsLeft = 0;
    return;
  }

  const startsAtMs = Number(lobby.gameStartsAt / 1000n);

  // Tick the countdown display
  const tick = () => {
    secondsLeft = Math.max(0, Math.ceil((startsAtMs - Date.now()) / 1000));
  };
  tick();
  const interval = setInterval(tick, 200);

  // Schedule the confirm_start call with a small buffer past the deadline
  const delay = Math.max(0, startsAtMs - Date.now() + 200);
  const timer = setTimeout(() => {
    confirmStart({ lobbyId: lobby.id });
  }, delay);

  return () => {
    clearInterval(interval);
    clearTimeout(timer);
  };
});

// Preference options depend on player count
const tilesPerPlayer = $derived(lobby.maxPlayers === 4 ? 3 : 4);
const prefOptions = $derived(
  tilesPerPlayer === 3
    ? [
        { value: '3b', blacks: 3, whites: 0 },
        { value: '2b1w', blacks: 2, whites: 1 },
        { value: '1b2w', blacks: 1, whites: 2 },
        { value: '3w', blacks: 0, whites: 3 },
      ]
    : [
        { value: '4b', blacks: 4, whites: 0 },
        { value: '3b1w', blacks: 3, whites: 1 },
        { value: '2b2w', blacks: 2, whites: 2 },
        { value: '1b3w', blacks: 1, whites: 3 },
        { value: '4w', blacks: 0, whites: 4 },
      ]
);

const myMember = $derived(
  members.find(m => m.playerIdentity.toHexString() === $conn.identity?.toHexString())
);
const myPreference = $derived(myMember?.colorPreference ?? '');
</script>

<div class="flex min-h-screen items-center justify-center bg-background">
  <Card.Root class="w-full max-w-sm">
    <Card.Header class="text-center">
      <Card.Title>
        {#if isStarting}
          Game starts in {secondsLeft}…
        {:else}
          Waiting Room
        {/if}
      </Card.Title>
      <Card.Description>{filledSlots} / {lobby.maxPlayers} players joined</Card.Description>
    </Card.Header>
    <Card.Content class="flex flex-col gap-3">
      {#each members as member}
        <div class="flex flex-col gap-1.5 rounded-lg border bg-card px-4 py-3">
          <div class="flex items-center gap-3">
            <div class="h-2.5 w-2.5 rounded-full bg-green-500"></div>
            <span class="font-medium text-card-foreground">{getPlayerName(member)}</span>
          </div>
          <!-- Color preference swatches -->
          <div class="flex gap-1 pl-5">
            {#each Array.from({ length: member.colorPreference.match(/(\d+)b/)?.[1] ? parseInt(member.colorPreference.match(/(\d+)b/)![1]) : 0 }) as _}
              <span class="inline-block h-4 w-4 rounded-sm" style="background-color: #5e81ac;"></span>
            {/each}
            {#each Array.from({ length: member.colorPreference.match(/(\d+)w/)?.[1] ? parseInt(member.colorPreference.match(/(\d+)w/)![1]) : 0 }) as _}
              <span class="inline-block h-4 w-4 rounded-sm" style="background-color: #bf616a;"></span>
            {/each}
          </div>
        </div>
      {/each}
      {#if !isStarting}
        {#each { length: emptySlots } as _}
          <div class="flex items-center gap-3 rounded-lg border border-dashed px-4 py-3">
            <div class="h-2.5 w-2.5 rounded-full bg-border"></div>
            <span class="text-muted-foreground">Waiting for player…</span>
          </div>
        {/each}
      {/if}

      <!-- Color preference picker (available until game actually starts) -->
      {#if myMember}
        <div class="mt-2 rounded-lg border bg-muted/30 p-3">
          <p class="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {isStarting ? 'Starting tiles (last chance!)' : 'Starting tiles'}
          </p>
          <div class="flex flex-wrap gap-2">
            {#each prefOptions as opt}
              <button
                onclick={() => setColorPreference({ lobbyId: lobby.id, preference: opt.value })}
                class="flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors
                  {myPreference === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:border-muted-foreground'}"
              >
                {#each Array.from({ length: opt.blacks }) as _}
                  <span class="inline-block h-3 w-3 rounded-sm" style="background-color: #5e81ac;"></span>
                {/each}
                {#each Array.from({ length: opt.whites }) as _}
                  <span class="inline-block h-3 w-3 rounded-sm" style="background-color: #bf616a;"></span>
                {/each}
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </Card.Content>
    {#if !isStarting}
      <Card.Footer>
        <Button variant="outline" class="w-full" onclick={() => leaveLobby()}>
          Leave Lobby
        </Button>
      </Card.Footer>
    {/if}
  </Card.Root>
</div>
