import { parseSafeJSON } from "@/lib/utils";

import { auth } from "./firebase";

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

export const apiFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  let token = localStorage.getItem("token");

  // Get CSRF token from cookie
  // Get CSRF token from cookie or localStorage fallback
  const getCsrfToken = () => {
    // Try localStorage first (more reliable in some iframe/preview environments)
    const local = localStorage.getItem("XSRF-TOKEN");
    if (local) return local;

    const name = "XSRF-TOKEN=";
    const decodedCookie = decodeURIComponent(document.cookie);
    const ca = decodedCookie.split(";");
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) == " ") {
        c = c.substring(1);
      }
      if (c.indexOf(name) == 0) {
        const token = c.substring(name.length, c.length);
        if (token) localStorage.setItem("XSRF-TOKEN", token); // Sync to local storage for future requests
        return token;
      }
    }
    return "";
  };

  const getHeaders = (t: string | null) => {
    const h = new Headers(init?.headers);
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (t && url.startsWith("/api")) {
      h.set("Authorization", `Bearer ${t}`);
    }

    // Add CSRF token for state-changing requests
    const path =
      typeof input === "string"
        ? input
        : (input as any).url || input.toString();
    const isStateChanging =
      !["GET", "HEAD", "OPTIONS"].includes(init?.method || "GET") &&
      path.startsWith("/api");

    if (isStateChanging) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        h.set("x-xsrf-token", csrfToken);
      }
    }

    return { headers: h, isStateChanging };
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000); // Increased to 45s for Cloud Run cold starts

  const baseFetch = window.fetch;
  const maxRetries = 2;
  let lastError: any = null;

  const { headers: initialHeaders, isStateChanging } = getHeaders(token);
  if (isStateChanging && typeof window !== "undefined") {
    window.dispatchEvent(new Event("sync-start"));
  }

  try {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const { headers: fetchHeaders } = getHeaders(token);

      try {
        if (attempt > 0) {
          console.warn(
            `Retrying fetch for ${input} (attempt ${attempt}/${maxRetries})...`,
          );
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }

        let response = await baseFetch(input, {
          ...init,
          signal: controller.signal,
          headers: fetchHeaders,
        });
        clearTimeout(timeoutId);

        // Handle Token Expired or Unauthorized
        if (response.status === 403 || response.status === 401) {
          const clone = response.clone();
          try {
            const text = await clone.text();
            try {
              const data = parseSafeJSON(text);
              if (
                (data.error === "TokenExpired" ||
                  data.error === "Unauthorized" ||
                  data.error === "Forbidden") &&
                auth.currentUser
              ) {
                console.log(
                  "Token expired or unauthorized, attempting to refresh...",
                );

                if (!isRefreshing) {
                  isRefreshing = true;
                  refreshPromise = (async () => {
                    const refreshController = new AbortController();
                    const refreshTimeoutId = setTimeout(
                      () => refreshController.abort(),
                      10000,
                    ); // 10s for refresh

                    try {
                      const idToken = await auth.currentUser!.getIdToken(true);
                      const refreshRes = await baseFetch("/api/auth/social", {
                        method: "POST",
                        signal: refreshController.signal,
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          idToken,
                          email: auth.currentUser!.email,
                          name: auth.currentUser!.displayName,
                          uid: auth.currentUser!.uid,
                        }),
                      });

                      if (refreshRes.ok) {
                        const refreshData = await refreshRes.json();
                        if (refreshData.token) {
                          localStorage.setItem("token", refreshData.token);
                          return refreshData.token;
                        }
                      }
                      return null;
                    } catch (e) {
                      console.error("Refresh token error:", e);
                      return null;
                    } finally {
                      clearTimeout(refreshTimeoutId);
                      isRefreshing = false;
                      refreshPromise = null;
                    }
                  })();
                }

                const newToken = await refreshPromise;
                if (newToken) {
                  // Retry the original request with the new token
                  const retryController = new AbortController();
                  const retryTimeoutId = setTimeout(
                    () => retryController.abort(),
                    15000,
                  );
                  try {
                    const { headers: retryHeaders } = getHeaders(newToken);
                    const retryResponse = await baseFetch(input, {
                      ...init,
                      signal: retryController.signal,
                      headers: retryHeaders,
                    });
                    clearTimeout(timeoutId);
                    return retryResponse;
                  } finally {
                    clearTimeout(retryTimeoutId);
                  }
                } else {
                  // Refresh failed, redirect to login if not already there
                  localStorage.removeItem("token");
                  if (window.location.pathname !== "/login") {
                    window.location.href = "/login";
                  }
                }
              } else if (
                data.error === "TokenExpired" ||
                data.error === "Unauthorized" ||
                data.error === "Forbidden"
              ) {
                // No user to refresh with, redirect to login if not already there
                localStorage.removeItem("token");
                if (window.location.pathname !== "/login") {
                  window.location.href = "/login";
                }
              }
            } catch (e) {
              console.error(
                "Non-JSON response received from API:",
                input,
                text.substring(0, 100),
              );
            }
          } catch (e) {
            console.error("Error cloning or reading response:", e);
          }
        }

        clearTimeout(timeoutId);
        return response;
      } catch (error: any) {
        lastError = error;
        if (error.name === "AbortError") {
          clearTimeout(timeoutId);
          console.warn("Request timed out or aborted:", input);
          throw new Error("Request timed out");
        }

        // Only retry on potential transient network errors
        if (
          attempt < maxRetries &&
          (error instanceof TypeError || error.message === "Failed to fetch")
        ) {
          continue;
        }

        clearTimeout(timeoutId);
        throw error;
      }
    }
    throw lastError || new Error("Unknown fetch error");
  } finally {
    if (isStateChanging && typeof window !== "undefined") {
      window.dispatchEvent(new Event("sync-end"));
    }
  }
};
