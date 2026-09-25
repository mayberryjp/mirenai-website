import { describe, it, expect } from "vitest";
import { AxiosError } from "axios";
import { apiErrorMessage, getApiError } from "@/services/errors";

function axiosErr(opts: { status?: number; data?: unknown; code?: string }): AxiosError {
  const err = new AxiosError(opts.code ?? "Request failed", opts.code);
  err.isAxiosError = true;
  if (opts.status !== undefined) {
    err.response = { status: opts.status, data: opts.data } as AxiosError["response"];
  }
  return err;
}

describe("getApiError", () => {
  it("maps the mirenai error envelope by code", () => {
    const err = axiosErr({
      status: 422,
      data: { status: "error", code: "validation_error", error: "Invalid request", detail: "port: must be between 1 and 65535" }
    });
    const res = getApiError(err);
    expect(res.code).toBe("validation_error");
    expect(res.detail).toContain("port");
  });

  it("classifies missing-response errors as network", () => {
    const res = getApiError(axiosErr({}));
    expect(res.code).toBe("network");
  });

  it("classifies aborted requests as timeout", () => {
    const res = getApiError(axiosErr({ code: "ECONNABORTED" }));
    expect(res.code).toBe("timeout");
  });

  it("falls back to unknown for non-axios errors", () => {
    expect(getApiError(new Error("boom")).code).toBe("unknown");
  });
});

describe("apiErrorMessage", () => {
  it("appends detail when present", () => {
    const err = axiosErr({ status: 422, data: { status: "error", code: "validation_error", error: "Invalid", detail: "client: bad IP" } });
    expect(apiErrorMessage(err)).toBe("Invalid: client: bad IP");
  });

  it("omits detail when absent", () => {
    const err = axiosErr({ status: 409, data: { status: "error", code: "conflict", error: "Already exists" } });
    expect(apiErrorMessage(err)).toBe("Already exists");
  });
});
