import { Router } from 'express';
import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  listAgentConfigs, getAgentConfig, saveAgentConfig, deleteAgentConfig,
  getUsers, saveUsers, getUserById,
  getLLMConfig, saveLLMConfig,
} from '../config/manager.js';
import { executeAgent, isAgentRunning } from '../agents/executor.js';
import { rescheduleAgent, unscheduleAgent } from '../agents/scheduler.js';
import { badRequest, notFound } from '../middleware/error-handler.js';

export const adminAgentsRouter = Router();

// List agents
adminAgentsRouter.get('/', (_req, res) => {
  res.json(listAgentConfigs());
});

// Create agent
adminAgentsRouter.post('/', (req, res, next) => {
  try {
    const { name, prompt, schedule, model, log_space, timeout_ms } = req.body;

    if (!name || typeof name !== 'string' || !/^[a-z][a-z0-9_-]{0,49}$/.test(name)) {
      throw badRequest('Invalid agent name. Use lowercase letters, numbers, hyphens, underscores.');
    }
    if (!prompt || typeof prompt !== 'string') throw badRequest('prompt is required');
    if (!log_space || typeof log_space !== 'string') throw badRequest('log_space is required');
    if (getAgentConfig(name)) throw badRequest(`Agent "${name}" already exists`);

    // Auto-create user
    const apiKey = 'hive_' + crypto.randomBytes(16).toString('hex');
    const user = {
      id: uuidv4(),
      name: `agent-${name}`,
      api_key: apiKey,
      is_admin: false,
      created_at: new Date().toISOString(),
    };
    const users = getUsers();
    users.push(user);
    saveUsers(users);

    // Save agent config
    const config = {
      name,
      user_id: user.id,
      schedule: schedule || null,
      model: model || null,
      prompt,
      enabled: true,
      timeout_ms: timeout_ms || 300000,
      log_space,
      log_thread_prefix: `agent/${name}`,
      created_at: new Date().toISOString(),
    };
    saveAgentConfig(name, config);
    rescheduleAgent(name);

    res.status(201).json({ ...config, api_key: apiKey });
  } catch (err) {
    next(err);
  }
});

// Get agent
adminAgentsRouter.get('/:name', (req, res, next) => {
  try {
    const config = getAgentConfig(req.params.name as string);
    if (!config) throw notFound('Agent not found');
    res.json({ ...config, running: isAgentRunning(config.name) });
  } catch (err) {
    next(err);
  }
});

// Update agent
adminAgentsRouter.put('/:name', (req, res, next) => {
  try {
    const name = req.params.name as string;
    const config = getAgentConfig(name);
    if (!config) throw notFound('Agent not found');

    const { prompt, schedule, model, enabled, timeout_ms } = req.body;
    if (prompt !== undefined) config.prompt = prompt;
    if (schedule !== undefined) config.schedule = schedule;
    if (model !== undefined) config.model = model;
    if (enabled !== undefined) config.enabled = enabled;
    if (timeout_ms !== undefined) config.timeout_ms = timeout_ms;

    saveAgentConfig(name, config);
    rescheduleAgent(name);

    res.json(config);
  } catch (err) {
    next(err);
  }
});

// Delete agent
adminAgentsRouter.delete('/:name', (req, res, next) => {
  try {
    const name = req.params.name as string;
    const config = getAgentConfig(name);
    if (!config) throw notFound('Agent not found');

    // Remove user
    const users = getUsers();
    const idx = users.findIndex(u => u.id === config.user_id);
    if (idx !== -1) {
      users.splice(idx, 1);
      saveUsers(users);
    }

    unscheduleAgent(name);
    deleteAgentConfig(name);

    res.json({ deleted: name });
  } catch (err) {
    next(err);
  }
});

// Manual run
adminAgentsRouter.post('/:name/run', (req, res, next) => {
  try {
    const name = req.params.name as string;
    const config = getAgentConfig(name);
    if (!config) throw notFound('Agent not found');
    if (isAgentRunning(name)) {
      res.status(409).json({ error: 'Agent is already running', status: 409 });
      return;
    }

    // Fire and forget
    executeAgent(name).catch(err => {
      console.error(`Manual run of agent "${name}" failed:`, err.message);
    });

    res.json({ status: 'started', agent: name });
  } catch (err) {
    next(err);
  }
});

// LLM config
adminAgentsRouter.get('/config/llm', (_req, res) => {
  const config = getLLMConfig();
  if (!config) {
    res.json(null);
    return;
  }
  // Mask API key
  res.json({
    ...config,
    api_key: config.api_key.slice(0, 10) + '...' + config.api_key.slice(-4),
  });
});

adminAgentsRouter.put('/config/llm', (req, res, next) => {
  try {
    const { provider, api_key, default_model } = req.body;
    if (!provider || !['anthropic', 'openai'].includes(provider)) throw badRequest('provider must be "anthropic" or "openai"');
    if (!default_model) throw badRequest('default_model is required');

    const existing = getLLMConfig();
    const finalKey = api_key || existing?.api_key;
    if (!finalKey) throw badRequest('api_key is required');

    saveLLMConfig({ provider, api_key: finalKey, default_model });
    res.json({ provider, default_model, api_key: finalKey.slice(0, 10) + '...' + finalKey.slice(-4) });
  } catch (err) {
    next(err);
  }
});
