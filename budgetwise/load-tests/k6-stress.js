import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:5001";
const TOKEN = __ENV.TOKEN || "";
const ENABLE_WRITES = __ENV.ENABLE_WRITES === "1";

export const options = {
  scenarios: {
    spike_and_hold: {
      executor: "ramping-vus",
      startVUs: 50,
      stages: [
        { duration: "2m", target: 300 },
        { duration: "2m", target: 1000 },
        { duration: "3m", target: 1000 },
        { duration: "2m", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<2000"],
  },
};

function authHeaders() {
  return TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};
}

export default function () {
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, { "health is 200": (r) => r.status === 200 });

  if (TOKEN) {
    const readRes = http.get(`${BASE_URL}/api/expenses`, {
      headers: authHeaders(),
    });
    check(readRes, { "read <500": (r) => r.status < 500 });
  }

  if (TOKEN && ENABLE_WRITES) {
    const payload = JSON.stringify({
      amount: 19.99,
      category: "Other",
      type: "EXPENSE",
      date: new Date().toISOString(),
      note: "k6 stress write",
    });
    const writeRes = http.post(`${BASE_URL}/api/expenses`, payload, {
      headers: { ...authHeaders(), "Content-Type": "application/json" },
    });
    check(writeRes, { "write <500": (r) => r.status < 500 });
  }

  sleep(0.5);
}
