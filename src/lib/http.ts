import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const ok = <T>(data: T, status = 200) => NextResponse.json(data, { status });

/** Wraps a route handler so thrown HttpErrors / ZodErrors become JSON error responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      unstable_rethrow(err); // let Next.js handle its own control-flow errors (e.g. dynamic rendering bailouts)
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (err instanceof ZodError) {
        const message = err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
        return NextResponse.json({ error: message }, { status: 400 });
      }
      console.error(err);
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }
  };
}

type DbResult<T> = { data: T; error: { message: string } | null };

/** Unwraps a Supabase result, throwing a 500 if the call failed or returned nothing. */
export function check<T>(result: DbResult<T>): NonNullable<T> {
  if (result.error) throw new HttpError(500, result.error.message);
  if (result.data == null) throw new HttpError(500, "Unexpected empty result");
  return result.data as NonNullable<T>;
}

/** Like check, but for maybeSingle() lookups where "not found" (null) is a valid outcome. */
export function checkMaybe<T>(result: DbResult<T>): T {
  if (result.error) throw new HttpError(500, result.error.message);
  return result.data;
}
