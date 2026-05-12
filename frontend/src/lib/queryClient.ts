import { QueryClient } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// React Query is configured with staleTime: Infinity (good — avoids hammering
// the API), but that means without explicit invalidation, data fetched on page
// load NEVER refreshes. Every mutation that could change one of these queries'
// underlying data should invalidate them; doing it centrally here means call
// sites don't need to remember.
//
// In practice: most mutations either deduct credits (subscription +
// transactions update), advance onboarding (checklist flips), or both. Cheap
// to invalidate all three after every mutation.
const ALWAYS_INVALIDATE_AFTER_MUTATION: readonly string[] = [
  "/api/billing/subscription",
  "/api/billing/transactions",
  "/api/onboarding",
];

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);

  // After any successful write, refresh the "live data" queries so the UI
  // reflects the new credit balance / checklist / transaction history without
  // a page reload. GET/HEAD pass through unchanged.
  const upperMethod = method.toUpperCase();
  if (upperMethod !== "GET" && upperMethod !== "HEAD") {
    for (const key of ALWAYS_INVALIDATE_AFTER_MUTATION) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  }

  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

interface QueryFunctionContext {
  queryKey: readonly unknown[];
}

export const getQueryFn = <T,>(options: { on401: UnauthorizedBehavior }) =>
  async ({ queryKey }: QueryFunctionContext): Promise<T> => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (options.on401 === "returnNull" && res.status === 401) {
      return null as T;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
