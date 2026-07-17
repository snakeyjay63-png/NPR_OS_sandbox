// @net 10.01.2.0/24
// ─────────────────────────────────────────────────
// input/devices.js — Device Registry
// ─────────────────────────────────────────────────
//
// Known input devices and their transport info.
// Maps physical device IDs to Local Hub device objects.

export const DEFAULT_DEVICES = [
  {
    id:        "npr-control",
    name:      "NPR Control Interface",
    transport: "evdev",
    path:      "/dev/input/event0",
  },
  {
    id:        "npr-keyboard",
    name:      "NPR Keyboard",
    transport: "hid",
    path:      "/dev/hid/keyboard",
  },
  {
    id:        "npr-udp-17000",
    name:      "UDP 17000 Listener",
    transport: "udp",
    path:      "0.0.0.0:17000",
  },
];

export class DeviceRegistry {
  constructor(initial = []) {
    this.devices = new Map();
    for (const d of [...DEFAULT_DEVICES, ...initial]) {
      this.devices.set(d.id, d);
    }
  }

  get(id) {
    return this.devices.get(id) ?? null;
  }

  register(device) {
    this.devices.set(device.id, device);
    return this;
  }

  unregister(id) {
    return this.devices.delete(id);
  }

  list() {
    return Object.fromEntries(this.devices);
  }
}
