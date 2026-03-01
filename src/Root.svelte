<script lang="ts">
import { createSpacetimeDBProvider } from 'spacetimedb/svelte';
import type { Identity } from 'spacetimedb';
import { DbConnection, type ErrorContext } from './module_bindings';
import App from './App.svelte';

const HOST = import.meta.env.VITE_SPACETIMEDB_HOST ?? 'wss://maincloud.spacetimedb.com';
const DB_NAME = import.meta.env.VITE_SPACETIMEDB_DB_NAME ?? 'tile-guessr';

const onConnect = (conn: DbConnection, identity: Identity, _token: string) => {
  console.log('Connected to SpacetimeDB with identity:', identity.toHexString());
  conn.subscriptionBuilder().subscribe([
    'SELECT * FROM player',
    'SELECT * FROM lobby',
    'SELECT * FROM lobby_member',
    'SELECT * FROM tile_public',
    'SELECT * FROM tile_secret',
    'SELECT * FROM game_state',
  ]);
};

const onDisconnect = () => {
  console.log('Disconnected from SpacetimeDB');
};

const onConnectError = (_ctx: ErrorContext, err: Error) => {
  console.log('Error connecting to SpacetimeDB:', err);
};

const connectionBuilder = DbConnection.builder()
  .withUri(HOST)
  .withDatabaseName(DB_NAME)
  .onConnect(onConnect)
  .onDisconnect(onDisconnect)
  .onConnectError(onConnectError);

createSpacetimeDBProvider(connectionBuilder);
</script>

<App />
