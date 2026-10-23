const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/+$/, "");

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: HeadersInit;
};

async function request<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const token = sessionStorage.getItem("access_token");
  const tokenType = sessionStorage.getItem("token_type") || "Bearer";

  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  if (options.body !== undefined && !isFormData) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `${tokenType} ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || "GET",
      headers,
      body:
        options.body !== undefined
          ? isFormData
            ? (options.body as FormData)
            : JSON.stringify(options.body)
          : undefined,
    });
  } catch {
    throw new Error(
      "Cannot connect to the server. Check that FastAPI is running.",
    );
  }

  if (response.status === 204) {
    if (!response.ok) {
      throw new Error(`Request failed (${response.status}).`);
    }

    return undefined as T;
  }

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const errorData = data as {
      detail?: string | { msg?: string }[];
      message?: string;
    } | null;

    let message = `Request failed (${response.status}).`;

    if (typeof errorData?.detail === "string") {
      message = errorData.detail;
    } else if (Array.isArray(errorData?.detail)) {
      message = errorData.detail
        .map((item) => item.msg || "Invalid request")
        .join(", ");
    } else if (errorData?.message) {
      message = errorData.message;
    }

    throw new Error(message);
  }

  return data as T;
}

function buildQuery(params?: Record<string, string | number | boolean | undefined>) {
  const query = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });

  const result = query.toString();
  return result ? `?${result}` : "";
}

export const api = {
  get<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ) {
    return request<T>(`${path}${buildQuery(params)}`);
  },

  post<T>(path: string, body?: unknown) {
    return request<T>(path, { method: "POST", body });
  },

  put<T>(path: string, body?: unknown) {
    return request<T>(path, { method: "PUT", body });
  },

  patch<T>(path: string, body: unknown) {
    return request<T>(path, { method: "PATCH", body });
  },

  delete<T = void>(path: string) {
    return request<T>(path, { method: "DELETE" });
  },

  upload<T>(path: string, formData: FormData) {
    return request<T>(path, { method: "POST", body: formData });
  },

  async download(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<Blob> {
    const token = sessionStorage.getItem("access_token");
    const tokenType = sessionStorage.getItem("token_type") || "Bearer";
    const headers = new Headers();
    if (token) {
      headers.set("Authorization", `${tokenType} ${token}`);
    }
    const response = await fetch(`${API_BASE_URL}${path}${buildQuery(params)}`, {
      method: "GET",
      headers,
    });
    if (!response.ok) {
      throw new Error(`Download failed (${response.status})`);
    }
    return response.blob();
  },
};

export default api;