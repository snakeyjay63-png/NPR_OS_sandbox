// @addr 10.05.2.0 | fd00:npr:0005:002::0 — Slot Monitor
// ═══════════════════════════════════════════════════
// Two modes:
//   managed-slots  — npr-local tracks concrete slot IDs
//   capacity-only  — semaphore; llama.cpp picks internally
// ═══════════════════════════════════════════════════

// @addr 10.05.2.1 | fd00:npr:0005:002::1 — InferenceSemaphore (capacity-only)
class InferenceSemaphore {
  /**
   * @param {number} capacityHex - max concurrent inference slots
   */
  constructor(capacityHex) {
    this.capacityHex = capacityHex;
    this.activeHex = 0x00;
    this.waiters = [];
  }

  // @addr 10.05.2.2 | fd00:npr:0005:002::2 — acquire lease
  acquire() {
    if (this.activeHex < this.capacityHex) {
      this.activeHex += 0x01;
      return Promise.resolve(this.createLease());
    }

    return new Promise((resolve, reject) => {
      this.waiters.push({ resolve, reject });
    });
  }

  // @addr 10.05.2.3 | fd00:npr:0005:002::3 — create lease object
  createLease() {
    let released = false;

    return {
      release: () => {
        if (released) return;
        released = true;

        const waiter = this.waiters.shift();
        if (waiter) {
          waiter.resolve(this.createLease());
        } else {
          this.activeHex -= 0x01;
        }
      },
    };
  }
}

// @addr 10.05.2.4 | fd00:npr:0005:002::4 — ManagedSlotPool (managed-slots)
class ManagedSlotPool {
  /**
   * @param {{slotIds: string[]}} opts
   */
  constructor({ slotIds }) {
    this.slots = slotIds.map(id => ({
      id,
      idHex: parseInt(id, 16).toString(16).toUpperCase(),
      busy: false,
    }));
    this.waiters = [];
  }

  // @addr 10.05.2.5 | fd00:npr:0005:002::5 — acquire a free slot
  acquire() {
    const free = this.slots.find(s => !s.busy);
    if (free) {
      free.busy = true;
      return Promise.resolve(this.createSlotLease(free));
    }

    return new Promise((resolve, reject) => {
      this.waiters.push({ resolve, reject });
    });
  }

  // @addr 10.05.2.6 | fd00:npr:0005:002::6 — wait for any slot to free up
  waitForAvailability() {
    return new Promise(resolve => {
      const check = setInterval(() => {
        if (this.slots.some(s => !s.busy)) {
          clearInterval(check);
          resolve(true);
        }
      }, 100);
      setTimeout(() => { clearInterval(check); resolve(false); }, 5000);
    });
  }

  createSlotLease(slot) {
    return {
      id: slot.id,
      idHex: slot.idHex,
      release: () => {
        slot.busy = false;
        const waiter = this.waiters.shift();
        if (waiter) {
          this.createSlotLease(slot).then(waiter.resolve);
        }
      },
    };
  }
}

// @addr 10.05.3.0 | fd00:npr:0005:003::0 — SlotMonitor (unified interface)
class SlotMonitor {
  /**
   * @param {{mode: 'managed-slots'|'capacity-only', concurrencyHex?: number, slotIds?: string[]}} config
   */
  constructor(config) {
    this.mode = config.mode ?? 'capacity-only';

    if (this.mode === 'capacity-only') {
      this.semaphore = new InferenceSemaphore(config.concurrencyHex ?? 0x04);
    } else {
      this.pool = new ManagedSlotPool({
        slotIds: config.slotIds ?? ['0x00', '0x01', '0x02', '0x03'],
      });
    }
  }

  // @addr 10.05.3.1 | fd00:npr:0005:003::1 — acquire (delegates to mode)
  acquire() {
    if (this.mode === 'capacity-only') {
      return this.semaphore.acquire().then(lease => ({
        id: 'auto',
        idHex: 'AUTO',
        ...lease,
      }));
    }
    return this.pool.acquire();
  }

  // @addr 10.05.3.2 | fd00:npr:0005:003::2 — wait for availability
  waitForAvailability() {
    if (this.mode === 'capacity-only') {
      // Semaphore handles waiting internally; short yield
      return Promise.resolve(true);
    }
    return this.pool.waitForAvailability();
  }

  // @addr 10.05.3.3 | fd00:npr:0005:003::3 — status snapshot
  getStatus() {
    if (this.mode === 'capacity-only') {
      return {
        mode: 'capacity-only',
        active_hex: this.semaphore.activeHex,
        capacity_hex: this.semaphore.capacityHex,
        waiters: this.semaphore.waiters.length,
      };
    }
    return {
      mode: 'managed-slots',
      slots: this.pool.slots.map(s => ({
        id_hex: s.idHex,
        busy: s.busy,
      })),
      waiters: this.pool.waiters.length,
    };
  }
}

module.exports = { InferenceSemaphore, ManagedSlotPool, SlotMonitor };
