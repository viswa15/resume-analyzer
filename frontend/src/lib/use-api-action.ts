import { useCallback, useState } from "react";
import { isUnauthorized, useAuth } from "./auth";

export function useApiAction<TArgs extends unknown[], TResult>(action: (...args: TArgs) => Promise<TResult>) {
  const { handleUnauthorized } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (...args: TArgs) => {
    setLoading(true);
    setError(null);
    try {
      return await action(...args);
    } catch (caught) {
      if (isUnauthorized(caught)) handleUnauthorized();
      const message = caught instanceof Error ? caught.message : "Something went wrong. Please try again.";
      setError(message);
      throw caught;
    } finally {
      setLoading(false);
    }
  }, [action, handleUnauthorized]);
  return { run, loading, error, setError };
}