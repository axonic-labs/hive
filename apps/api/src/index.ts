import { createApp } from './app.js';
import { initSuperuser } from './config/manager.js';
import { initScheduler } from './agents/scheduler.js';

const port = process.env.PORT || 3000;

initSuperuser();

const app = await createApp();

app.listen(port, () => {
  console.log(`Hive API listening on port ${port}`);
  initScheduler();
});
