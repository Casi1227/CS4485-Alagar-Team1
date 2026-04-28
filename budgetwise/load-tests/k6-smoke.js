import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:5001";
const TOKEN = __ENV.TOKEN || "";
const ENABLE_WRITES = __ENV.ENABLE_WRITES === "1";

export const options = {
  vus: 25,
  duration: "2m",
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<500"],
  },
};

function authHeaders() {
  return TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};
}

export default function () {
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, { "health is 200": (r) => r.status === 200 });

  if (TOKEN) {
    const dashRes = http.get(`${BASE_URL}/api/dashboard`, {
      headers: authHeaders(),
    });
    check(dashRes, { "dashboard read <500": (r) => r.status < 500 });

    const expensesRes = http.get(`${BASE_URL}/api/expenses`, {
      headers: authHeaders(),
    });
    check(expensesRes, { "expenses read <500": (r) => r.status < 500 });
  }

  if (TOKEN && ENABLE_WRITES) {
    const payload = JSON.stringify({
      amount: 9.99,
      category: "Other",
      type: "EXPENSE",
      date: new Date().toISOString(),
      note: "k6 smoke write",
    });
    const createRes = http.post(`${BASE_URL}/api/expenses`, payload, {
      headers: { ...authHeaders(), "Content-Type": "application/json" },
    });
    check(createRes, { "expense write <500": (r) => r.status < 500 });
  }

  sleep(1);
}
