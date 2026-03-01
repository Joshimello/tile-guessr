<script lang="ts">
import { useReducer } from 'spacetimedb/svelte';
import { reducers } from '../module_bindings';
import { Button } from '$lib/components/ui/button';
import { Badge } from '$lib/components/ui/badge';
import * as Card from '$lib/components/ui/card';

interface Props {
  playerName: string;
}

const { playerName }: Props = $props();

const joinLobby = useReducer(reducers.joinLobby);

const options = [
  { maxPlayers: 2, label: '2 Players', desc: '4 tiles each' },
  { maxPlayers: 3, label: '3 Players', desc: '4 tiles each' },
  { maxPlayers: 4, label: '4 Players', desc: '3 tiles each' },
] as const;

function join(maxPlayers: number) {
  joinLobby({ maxPlayers });
}
</script>

<div class="flex min-h-screen items-center justify-center bg-background">
  <Card.Root class="w-full max-w-md">
    <Card.Header class="text-center">
      <Card.Title class="text-2xl">Tile Guessr</Card.Title>
      <Card.Description>
        Welcome, <span class="font-semibold text-foreground">{playerName}</span>!
      </Card.Description>
    </Card.Header>
    <Card.Content class="flex flex-col gap-3">
      <p class="text-center text-sm font-medium text-muted-foreground">Choose a game size</p>
      {#each options as opt}
        <Button
          variant="outline"
          onclick={() => join(opt.maxPlayers)}
          class="flex h-auto items-center justify-between px-5 py-4"
        >
          <span class="font-semibold">{opt.label}</span>
          <Badge variant="secondary">{opt.desc}</Badge>
        </Button>
      {/each}
    </Card.Content>
  </Card.Root>
</div>
