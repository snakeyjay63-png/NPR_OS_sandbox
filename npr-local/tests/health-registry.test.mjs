// @net 10.05.0.0/24
// ────────────────────────────────────────────────
// tests/health-registry.test.mjs
// ────────────────────────────────────────────────

import { HealthRegistry } from "../src/health-registry.mjs";
import { test, describe } from "node:test";
import { strict as a } from "node:assert";

// ─── Test 1: Non-critical block fails ─────────

test("1. one non-critical block fails → degraded, ~80%", () => {
  const reg = new HealthRegistry();

  reg.registerBlock({
    address: "10.03.3.5",
    subnet: "10.03.0.0/24",
    weight: 20,
    critical: false,
    capabilities: ["agent.complete"],
  });
  reg.registerBlock({
    address: "10.03.0.1",
    subnet: "10.03.0.0/24",
    weight: 20,
    critical: false,
    capabilities: ["workspace.read"],
  });
  reg.registerBlock({
    address: "10.03.0.2",
    subnet: "10.03.0.0/24",
    weight: 20,
    critical: false,
    capabilities: ["agent.stream"],
  });
  reg.registerBlock({
    address: "10.03.1.4",
    subnet: "10.03.0.0/24",
    weight: 20,
    critical: false,
    capabilities: ["memory.search"],
  });
  reg.registerBlock({
    address: "10.03.2.3",
    subnet: "10.03.0.0/24",
    weight: 20,
    critical: false,
    capabilities: ["tool.shell"],
  });

  // Total weight: 100. One block fails (20 * 0 = 0). Active: 80.
  reg.failure("10.03.3.5", new Error("model timeout"));

  const h = reg.getBlockHealth("10.03.3.5");
  a.equal(h.status, "failed");

  const report = reg.getSystemReport();
  a.equal(report.state, "degraded");
  a.equal(report.operationalPercentage, 80);
  a.equal(report.failedBlocks.length, 1);
  a.equal(report.failedBlocks[0], "10.03.3.5");
});

// ─── Test 2: Fallback takes over ──────────────

test("2. fallback takes over capability → degraded cap, not unavailable", () => {
  const reg = new HealthRegistry();

  reg.registerBlock({
    address: "10.03.3.5",
    subnet: "10.03.0.0/24",
    weight: 20,
    fallback: "10.03.3.6",
    capabilities: ["agent.complete"],
  });
  reg.registerBlock({
    address: "10.03.3.6",
    subnet: "10.03.0.0/24",
    weight: 15,
    capabilities: ["agent.complete"],
  });
  reg.registerBlock({
    address: "10.03.0.1",
    subnet: "10.03.0.0/24",
    weight: 20,
    capabilities: ["workspace.read"],
  });

  reg.failure("10.03.3.5", new Error("model down"));

  const h = reg.getBlockHealth("10.03.3.5");
  a.equal(h.status, "fallback_active");

  const caps = reg.getCapabilityMatrix();
  a.ok(caps.degraded.includes("agent.complete"));
  a.ok(!caps.unavailable.includes("agent.complete"));

  const report = reg.getSystemReport();
  a.ok(report.fallbacksActive.includes("10.03.3.5"));
});

// ─── Test 3: Dependency degrades ──────────────

test("3. dependency failure → dependent block degrades", () => {
  const reg = new HealthRegistry();

  reg.registerBlock({
    address: "10.04.1.2",
    subnet: "10.04.0.0/24",
    weight: 20,
    capabilities: ["model.api"],
  });
  reg.registerBlock({
    address: "10.03.3.5",
    subnet: "10.03.0.0/24",
    weight: 20,
    dependencies: ["10.04.1.2"],
    capabilities: ["agent.complete"],
  });

  reg.failure("10.04.1.2", new Error("api unreachable"));

  const depH = reg.getBlockHealth("10.03.3.5");
  a.equal(depH.status, "degraded");

  const report = reg.getSystemReport();
  a.ok(report.degradedBlocks.includes("10.03.3.5"));
});

// ─── Test 4: Critical block → subnet offline ──

test("4. critical block fails → subnet offline", () => {
  const reg = new HealthRegistry();

  reg.registerBlock({
    address: "10.03.2.3",
    subnet: "10.03.0.0/24",
    weight: 20,
    critical: true,
    capabilities: ["router.core"],
  });
  reg.registerBlock({
    address: "10.03.0.1",
    subnet: "10.03.0.0/24",
    weight: 20,
    capabilities: ["workspace.read"],
  });

  reg.failure("10.03.2.3", new Error("router panic"));

  const subnet = reg.getSubnetHealth("10.03.0.0/24");
  a.equal(subnet.state, "offline");

  const b2 = reg.getBlockHealth("10.03.0.1");
  a.equal(b2.status, "offline");

  const report = reg.getSystemReport();
  a.equal(report.state, "critical");
});

// ─── Test 5: Other subnet stays healthy ───────

test("5. one subnet fails → other subnet unaffected", () => {
  const reg = new HealthRegistry();

  reg.registerBlock({
    address: "10.03.0.1",
    subnet: "10.03.0.0/24",
    weight: 20,
    critical: true,
    capabilities: ["agent.core"],
  });
  reg.registerBlock({
    address: "10.04.0.1",
    subnet: "10.04.0.0/24",
    weight: 20,
    capabilities: ["net.dns"],
  });

  reg.failure("10.03.0.1", new Error("core crash"));

  const s3 = reg.getSubnetHealth("10.03.0.0/24");
  a.equal(s3.state, "offline");

  const s4 = reg.getSubnetHealth("10.04.0.0/24");
  a.equal(s4.state, "healthy");
});

// ─── Test 6: Recovery after success() ─────────

test("6. recovery: failed → success → healthy", () => {
  const reg = new HealthRegistry();

  reg.registerBlock({
    address: "10.03.3.5",
    subnet: "10.03.0.0/24",
    weight: 20,
    capabilities: ["agent.complete"],
  });
  reg.registerBlock({
    address: "10.03.0.1",
    subnet: "10.03.0.0/24",
    weight: 20,
    capabilities: ["workspace.read"],
  });

  reg.failure("10.03.3.5", new Error("timeout"));
  a.equal(reg.getBlockHealth("10.03.3.5").status, "failed");

  reg.success("10.03.3.5", { durationNs: 123n });
  const h = reg.getBlockHealth("10.03.3.5");
  a.equal(h.status, "healthy");
  a.equal(h.successCount, 1);
  a.equal(h.failureCount, 0); // Reset on recovery

  const report = reg.getSystemReport();
  a.equal(report.state, "healthy");
  a.equal(report.operationalPercentage, 100);
});

// ─── Test 7: Circular dependency rejected ─────

test("7. circular dependency → registration rejected", () => {
  const reg = new HealthRegistry();

  reg.registerBlock({
    address: "A",
    subnet: "10.03.0.0/24",
    weight: 10,
    dependencies: ["B"],
  });

  a.throws(() => {
    reg.registerBlock({
      address: "B",
      subnet: "10.03.0.0/24",
      weight: 10,
      dependencies: ["A"],
    });
  }, /Circular dependency/);
});

// ─── Test 8: Unknown block fails closed ───────

test("8. unknown block → throws, not silently added", () => {
  const reg = new HealthRegistry();

  a.throws(() => {
    reg.failure("10.99.9.9", new Error("boom"));
  }, /Unknown block/);

  a.throws(() => {
    reg.success("10.99.9.9");
  }, /Unknown block/);

  a.throws(() => {
    reg.getBlockHealth("10.99.9.9");
  }, /Unknown block/);

  a.equal(reg._blocks.size, 0);
});

// ─── Test 9: No healthy path → unavailable ────

test("9. capability with no healthy provider → unavailable", () => {
  const reg = new HealthRegistry();

  reg.registerBlock({
    address: "10.03.3.5",
    subnet: "10.03.0.0/24",
    weight: 20,
    capabilities: ["agent.complete"],
  });

  reg.failure("10.03.3.5", new Error("model down"));

  const caps = reg.getCapabilityMatrix();
  a.ok(caps.unavailable.includes("agent.complete"));
  a.ok(!caps.available.includes("agent.complete"));
  a.ok(!caps.degraded.includes("agent.complete"));
});

// ─── Test 10: Deterministic percentage ────────

test("10. operational percentage is deterministic", () => {
  const build = () => {
    const reg = new HealthRegistry();
    reg.registerBlock({ address: "a", subnet: "10.03.0.0/24", weight: 20, capabilities: ["c1"] });
    reg.registerBlock({ address: "b", subnet: "10.03.0.0/24", weight: 30, capabilities: ["c2"] });
    reg.registerBlock({ address: "c", subnet: "10.03.0.0/24", weight: 50, capabilities: ["c3"] });
    reg.failure("b", new Error("fail"));
    // a=20*1 + b=30*0 + c=50*1 = 70/100 = 70%
    return reg.getSystemReport().operationalPercentage;
  };

  const results = Array.from({ length: 10 }, build);
  for (const r of results) {
    a.equal(r, 70);
  }
});

// ─── Bonus: Dependency recovery cascade ───────

test("bonus: dependency recovers → dependent upgrades from degraded", () => {
  const reg = new HealthRegistry();

  reg.registerBlock({
    address: "10.04.1.2",
    subnet: "10.04.0.0/24",
    weight: 20,
    capabilities: ["model.api"],
  });
  reg.registerBlock({
    address: "10.03.3.5",
    subnet: "10.03.0.0/24",
    weight: 20,
    dependencies: ["10.04.1.2"],
    capabilities: ["agent.complete"],
  });

  reg.failure("10.04.1.2", new Error("down"));
  a.equal(reg.getBlockHealth("10.03.3.5").status, "degraded");

  reg.success("10.04.1.2");
  a.equal(reg.getBlockHealth("10.03.3.5").status, "healthy");
});

// ─── Bonus: Weighted percentage with fallback ──

test("bonus: fallback_active counts at 0.5 weight", () => {
  const reg = new HealthRegistry();

  reg.registerBlock({
    address: "a",
    subnet: "10.03.0.0/24",
    weight: 40,
    fallback: "af",
    capabilities: ["c1"],
  });
  reg.registerBlock({
    address: "af",
    subnet: "10.03.0.0/24",
    weight: 20,
    capabilities: ["c1"],
  });
  reg.registerBlock({
    address: "b",
    subnet: "10.03.0.0/24",
    weight: 40,
    capabilities: ["c2"],
  });

  // Total: 100. a fails → fallback_active (40*0.5=20). af=20*1. b=40*1.
  // Active: 20+20+40 = 80/100 = 80%
  reg.failure("a", new Error("fail"));

  const report = reg.getSystemReport();
  a.equal(report.operationalPercentage, 80);
});

// ─── Bonus: System report structure ───────────

test("bonus: system report has all required fields", () => {
  const reg = new HealthRegistry();
  reg.registerBlock({
    address: "10.03.0.1",
    subnet: "10.03.0.0/24",
    weight: 20,
    capabilities: ["c1"],
  });

  const report = reg.getSystemReport();
  a.equal(typeof report.state, "string");
  a.equal(typeof report.operationalPercentage, "number");
  a.equal(typeof report.subnets, "object");
  a.equal(Array.isArray(report.capabilities.available), true);
  a.equal(Array.isArray(report.capabilities.degraded), true);
  a.equal(Array.isArray(report.capabilities.unavailable), true);
  a.equal(Array.isArray(report.failedBlocks), true);
  a.equal(Array.isArray(report.degradedBlocks), true);
  a.equal(Array.isArray(report.fallbacksActive), true);
  a.equal(typeof report.totalBlocks, "number");
});
