
### Check: 2026-07-17 22:54 GMT+2
- Heartbeat timer: 1h (night mode)
- Status: Inference layer gebouwd ✅ (855 regels, 7 bestanden)
- Modules: inference-queue, slot-monitor, llama-client, llama-scheduler, return-structure, npr-loop, openclaw-client
- Wiring test: VALID_RETURN ✅
- Architectuur: queue → semaphore → llama :8765 (geen directe calls meer)
- NPR-loop: Noise → scheduler.enqueue → Pattern → Return (correctie via queue)
- Modus: capacity-only (semaphore) + managed-slots (slot pool)
