import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ConsoleFoundation1790319600000 } from './migration';
import { ProductProfiles1790352000000 } from './product-profiles-migration';
import { MinimoRepositoryCorrection1790352300000 } from './minimo-correction-migration';
import { MarketingWorkspace1790366400000 } from './marketing-migration';
import { BufferPublishing1790455200000 } from './buffer-migration';
import { UploadedAssets1790460000000 } from './uploaded-assets-migration';
import { ReviewStepRemoved1790640000000 } from './review-step-migration';
import { ProductsRetired1790726400000 } from './products-retired-migration';
import { ContentGuide1790812800000 } from './content-guide-migration';
import { ChannelLanguages1790985600000 } from './channel-language-migration';
import { ScheduledPublishing1791072000000 } from './schedule-migration';
import { VideoPosters1790560000000 } from './video-poster-migration';
export { MarketingStore } from './marketing-store';
export { MarketingWorker } from './marketing-worker';
export { MarketingPublisher, checkAssetSignature } from './marketing-publishing';
export { listBufferChannels } from './marketing-buffer';
export { seal, unseal } from './marketing-security';
export { WORKSPACE_ID } from './migration';
export { Store, StoreError } from './store';
export { seedDevelopment } from './seed';
export function database(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('DATABASE_URL is required');
  return new DataSource({
    type: 'postgres',
    url,
    synchronize: false,
    logging: false,
    migrations: [
      ConsoleFoundation1790319600000,
      ProductProfiles1790352000000,
      MinimoRepositoryCorrection1790352300000,
      MarketingWorkspace1790366400000,
      BufferPublishing1790455200000,
      UploadedAssets1790460000000,
      VideoPosters1790560000000,
      ReviewStepRemoved1790640000000,
      ProductsRetired1790726400000,
      ContentGuide1790812800000,
      ChannelLanguages1790985600000,
      ScheduledPublishing1791072000000,
    ],
    migrationsTableName: 'nullge_migrations',
    extra: { max: 8, connectionTimeoutMillis: 5000 },
  });
}
