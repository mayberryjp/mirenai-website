// Shared response-envelope types (see frontend-integration spec §3, §4, §9).

export interface OkEnvelope {
  status: "ok";
}

export type ApiErrorCode =
  | "bad_request"
  | "not_found"
  | "conflict"
  | "validation_error"
  | "download_failed"
  | "not_ready"
  | "internal_error";

export interface ErrorEnvelope {
  status: "error";
  code: ApiErrorCode;
  error: string;
  detail?: string;
}

// deleted = removed row id, or row count for DELETE /queries.
export type DeleteResult = OkEnvelope & { deleted: number };
