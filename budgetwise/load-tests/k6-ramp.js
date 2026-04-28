import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:5001";
const TOKEN = __ENV.TOKEN || "";
const ENABLE_WRITES = __ENV.ENABLE_WRITES === "1";

export const options = {
  scenarios: {
    mixed_traffic: {
      executor: "ramping-vus",
      startVUs: 20,
      stages: [
        { duration: "2m", target: 100 },
        { duration: "5m", target: 300 },
        { duration: "2m", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<800", "p(99)<1500"],
  },
};

function authHeaders() {
  return TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};
}

function runReads() {
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, { "health is 200": (r) => r.status === 200 });

  if (!TOKEN) return;

  const dashRes = http.get(`${BASE_URL}/api/dashboard`, {
    headers: authHeaders(),
  });
  check(dashRes, { "dashboard read <500": (r) => r.status < 500 });

  const budgetRes = http.get(`${BASE_URL}/api/budgets`, {
    headers: authHeaders(),
  });
  check(budgetRes, { "budget read <500": (r) => r.status < 500 });
}

function runWrite() {
  if (!TOKEN || !ENABLE_WRITES) return;

  const payload = JSON.stringify({
    amount: 12.34,
    category: "Other",
    type: "EXPENSE",
    date: new Date().toISOString(),
    note: "k6 ramp write",
  });
  const createRes = http.post(`${BASE_URL}/api/expenses`, payload, {
    headers: { ...authHeaders(), "Content-Type": "application/json" },
  });
  check(createRes, { "expense write <500": (r) => r.status < 500 });
}

export default function () {
  runReads();
  runWrite();
  sleep(1);
}
