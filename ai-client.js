let statusPromise;

async function readResponse(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || "AI 服务暂时不可用");
    error.code = body.code || "ai_error";
    error.status = response.status;
    throw error;
  }
  return body;
}

export function getAiStatus({ refresh = false } = {}) {
  if (!statusPromise || refresh) {
    statusPromise = fetch("/api/ai/status", { cache: "no-store" }).then(readResponse).catch(error => {
      statusPromise = null;
      throw error;
    });
  }
  return statusPromise;
}

async function analyze(mode, payload) {
  const response = await fetch("/api/ai/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode, ...payload })
  });
  return readResponse(response);
}

export function analyzePractice(metrics) {
  return analyze("practice", { metrics });
}

export function analyzeWeeklyProfile(profile, works) {
  return analyze("weekly", { profile, works });
}
