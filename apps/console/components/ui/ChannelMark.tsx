'use client';
import { CHANNEL_LABELS, type Post } from '@nullge/contracts';

export function ChannelMark({channel}:{channel:Post['channel']}) {
  return <span className={`channel-mark ${channel}`} aria-label={CHANNEL_LABELS[channel]} title={CHANNEL_LABELS[channel]}>{channel==='x'?'𝕏':channel==='threads'?'@':'◎'}</span>;
}
