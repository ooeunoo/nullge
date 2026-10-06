import { type Post } from '@nullge/contracts';

export type Act = (path: string, body: unknown, success: string) => Promise<void>;

export type ConnectionLite = {
  channel: Post['channel'];
  language: Post['language'];
  connected: boolean;
  username: string | null;
  revision: number;
};

export type Mutate = <T>(path: string, body: unknown, method?: string) => Promise<T>;
