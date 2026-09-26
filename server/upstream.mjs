export function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export async function upstreamJson(fetcher, url, options = {}, source = "Publisher") {
  let response;
  try {
    const { timeoutMs = 30_000, ...requestOptions } = options;
    response = await fetcher(url, { ...requestOptions, signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    fail(502, `${source} unavailable. Saved local records are unaffected.`);
  }
  if (!response.ok) fail(502, `${source} returned HTTP ${response.status}. Saved local records were kept.`);
  try {
    return await response.json();
  } catch {
    fail(502, `${source} returned invalid JSON. Saved local records were kept.`);
  }
}
