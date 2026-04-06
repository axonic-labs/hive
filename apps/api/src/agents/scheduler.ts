import cron from 'node-cron';
import { listAgentConfigs, getAgentConfig } from '../config/manager.js';
import { executeAgent } from './executor.js';

const tasks = new Map<string, cron.ScheduledTask>();

export function initScheduler(): void {
  const agents = listAgentConfigs();
  let scheduled = 0;

  for (const agent of agents) {
    if (agent.enabled && agent.schedule && cron.validate(agent.schedule)) {
      scheduleAgent(agent.name, agent.schedule);
      scheduled++;
    }
  }

  if (scheduled > 0) {
    console.log(`Scheduled ${scheduled} agent(s)`);
  }
}

function scheduleAgent(name: string, schedule: string): void {
  const task = cron.schedule(schedule, () => {
    console.log(`Cron firing agent: ${name}`);
    executeAgent(name).catch(err => {
      console.error(`Agent "${name}" cron execution failed:`, err.message);
    });
  });
  tasks.set(name, task);
}

export function rescheduleAgent(name: string): void {
  // Cancel existing
  const existing = tasks.get(name);
  if (existing) {
    existing.stop();
    tasks.delete(name);
  }

  // Re-read config and reschedule if applicable
  const config = getAgentConfig(name);
  if (config?.enabled && config.schedule && cron.validate(config.schedule)) {
    scheduleAgent(name, config.schedule);
    console.log(`Rescheduled agent: ${name} (${config.schedule})`);
  }
}

export function unscheduleAgent(name: string): void {
  const existing = tasks.get(name);
  if (existing) {
    existing.stop();
    tasks.delete(name);
  }
}

export function stopScheduler(): void {
  for (const [, task] of tasks) {
    task.stop();
  }
  tasks.clear();
}
