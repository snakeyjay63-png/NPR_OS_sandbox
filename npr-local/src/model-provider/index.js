// src/model-provider/index.js
// Model provider abstraction — entry point
//
// Usage:
//   const router = new ModelRouter();
//   router.registerProviders({
//     providers: {
//       'llama-local': { type: 'llamacpp', url: 'http://localhost:8765', model: 'Qwen3.6-27B' },
//       'ollama-local': { type: 'ollama',   url: 'http://localhost:11434', model: 'qwen2.5:32b' },
//     },
//     default: 'llama-local',
//   });
//
//   // Chat
//   const reply = await router.route([{ role: 'user', content: 'Hello' }]);
//
//   // Stream
//   for await (const chunk of router.routeStream([...])) {
//     process.stdout.write(chunk.token);
//   }
//
//   // Health
//   const checks = await router.healthCheck();

'use strict';

const { ModelRouter } = require('./router.js');
const { LlamaCppProvider } = require('./providers/llamacpp.js');
const { OllamaProvider } = require('./providers/ollama.js');
const { HttpProvider } = require('./providers/http.js');

module.exports = {
  // Router
  ModelRouter,

  // Providers (for manual instantiation)
  LlamaCppProvider,
  OllamaProvider,
  HttpProvider,
};
