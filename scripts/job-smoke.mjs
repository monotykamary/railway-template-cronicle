import assert from "node:assert/strict";

const baseUrl = required("BASE_URL").replace(/\/$/, "");
const username = required("ADMIN_USERNAME");
const password = required("ADMIN_PASSWORD");
const existingEventId = process.env.EXISTING_EVENT_ID || "";
const expectedJobId = process.env.EXPECTED_JOB_ID || "";
const expectedVersion = "0.9.128";
const scheduled = process.env.SCHEDULED === "1";
let sessionId = "";
let csrfToken = "";
let cookie = "";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function fetchJson(path, body) {
  const headers = { "content-type": "application/json" };
  if (cookie) headers.cookie = cookie;
  if (csrfToken) headers["x-csrf-token"] = csrfToken;
  const response = await fetch(`${baseUrl}${path}`, {
    method: body ? "POST" : "GET",
    headers,
    body: body ? JSON.stringify(sessionId ? { ...body, session_id: sessionId } : body) : undefined,
    signal: AbortSignal.timeout(15_000),
    redirect: "error"
  });
  const text = await response.text();
  assert.equal(response.status, 200, `${path} returned HTTP ${response.status}`);
  let data;
  try {
    data = JSON.parse(text);
  }
  catch {
    throw new Error(`${path} did not return JSON`);
  }
  return { data, headers: response.headers };
}

function assertSuccess(path, data) {
  assert.equal(data.code, 0, `${path} failed: ${data.description || data.code}`);
}

async function login() {
  const result = await fetchJson("/api/user/login", { username, password });
  assertSuccess("/api/user/login", result.data);
  sessionId = result.data.session_id || "";
  csrfToken = result.data.csrf_token || "";
  const setCookie = result.headers.get("set-cookie") || "";
  cookie = setCookie.split(";", 1)[0];
  assert.ok(sessionId || /^session_id=/.test(cookie), "login returned no session credential");
}

async function api(path, body) {
  const result = await fetchJson(path, body);
  return result.data;
}

async function waitForMaster() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const schedule = await api("/api/app/get_schedule", { offset: 0, limit: 1 });
    if (schedule.code === 0) return;
    assert.equal(schedule.code, "master", schedule.description || "master readiness failed");
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("Cronicle did not become master within 60 seconds");
}

async function verifyPersisted(eventId, jobId = "") {
  const event = await api("/api/app/get_event", { id: eventId });
  assertSuccess("get_event", event);
  assert.equal(event.event.id, eventId);
  assert.match(event.event.title, /^Railway validation /);

  const history = await api("/api/app/get_history", { offset: 0, limit: 100 });
  assertSuccess("get_history", history);
  const row = history.rows.find((item) => item.event === eventId && (!jobId || item.id === jobId));
  assert.ok(row, `completed history for event ${eventId} was not persisted`);
  assert.equal(row.code, 0);
  return { eventId, jobId: row.id, eventTitle: event.event.title, persisted: true };
}

async function createAndRun() {
  const title = `Railway validation ${Date.now()}`;
  const created = await api("/api/app/create_event", {
    enabled: 1,
    title,
    category: "general",
    target: "maingrp",
    plugin: "shellplug",
    params: {
      script: "#!/bin/sh\nset -eu\nprintf '%s\\n' railway-cronicle-job-ok\n",
      annotate: 0,
      json: 0
    },
    timing: scheduled ? {} : { years: [2001], minutes: [0] },
    max_children: 1,
    timeout: 60,
    catch_up: 0,
    timezone: "UTC",
    multiplex: 0,
    retries: 0,
    retry_delay: 0,
    detached: 0,
    notify_success: "",
    notify_fail: "",
    web_hook: "",
    cpu_limit: 0,
    cpu_sustain: 0,
    memory_limit: 0,
    memory_sustain: 0,
    log_max_size: 0,
    notes: "Railway template release validation"
  });
  assertSuccess("create_event", created);
  assert.ok(created.id, "create_event returned no event ID");

  let jobId;
  if (scheduled) {
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      const history = await api("/api/app/get_history", { offset: 0, limit: 100 });
      assertSuccess("get_history", history);
      const row = history.rows.find((item) => item.event === created.id);
      if (row) {
        jobId = row.id;
        assert.equal(row.code, 0, row.description || `scheduled job ${jobId} failed`);
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
    assert.ok(jobId, `scheduled event ${created.id} did not run within 120 seconds`);
    const disabled = await api("/api/app/update_event", { id: created.id, enabled: 0 });
    assertSuccess("update_event", disabled);
  }
  else {
    const launched = await api("/api/app/run_event", { id: created.id });
    assertSuccess("run_event", launched);
    assert.equal(launched.ids?.length, 1, "run_event did not launch exactly one job");
    jobId = launched.ids[0];

    const deadline = Date.now() + 60_000;
    let job;
    while (Date.now() < deadline) {
      const status = await api("/api/app/get_job_status", { id: jobId });
      if (status.code === 0 && status.job?.complete) {
        job = status.job;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    assert.ok(job, `job ${jobId} did not complete within 60 seconds`);
    assert.equal(job.code, 0, job.description || `job ${jobId} failed`);
    assert.equal(job.event, created.id);
  }

  return verifyPersisted(created.id, jobId);
}

const home = await fetch(baseUrl, { signal: AbortSignal.timeout(15_000), redirect: "error" });
assert.equal(home.status, 200, `home page returned HTTP ${home.status}`);
assert.match(await home.text(), /Cronicle/);

const rejected = await fetchJson("/api/user/login", {
  username: `railway-template-missing-${Date.now()}`,
  password: "wrong-template-probe"
});
assert.equal(rejected.data.code, "login", "invalid credentials were not rejected");

const status = await api("/api/app/status");
assertSuccess("status", status);
assert.equal(status.version, expectedVersion);
await login();
await waitForMaster();
const result = existingEventId
  ? await verifyPersisted(existingEventId, expectedJobId)
  : await createAndRun();
console.log(JSON.stringify({ version: status.version, mode: scheduled ? "scheduled" : "manual", ...result }));
