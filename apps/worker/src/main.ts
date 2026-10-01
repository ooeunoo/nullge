import { database, MarketingWorker, MarketingPublisher } from '@nullge/database';
async function run() {
  const db = await database().initialize();
  const beat = () =>
    db.query(
      `INSERT INTO worker_status (name,"heartbeatAt") VALUES ('console-foundation',now()) ON CONFLICT (name) DO UPDATE SET "heartbeatAt"=now()`,
    );
  await beat();
  const worker = new MarketingWorker(db);
  const publisher = new MarketingPublisher(db);
  let working = false;
  console.log('Marketing generation worker ready. Automatic publishing is disabled.');
  const tick = async () => {
    if (working || stopping) return;
    working = true;
    try {
      await beat();
      await worker.tick();
      await publisher.tick();
    } catch {
      console.error('Worker tick failed. No automatic paid retry.');
    } finally {
      working = false;
    }
  };
  const timer = setInterval(() => {
    void tick();
  }, 5_000);
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    clearInterval(timer);
    while (working) await new Promise((r) => setTimeout(r, 100));
    await db.destroy();
  };
  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());
}
run().catch(() => {
  console.error('Worker could not connect to the console database.');
  process.exitCode = 1;
});
