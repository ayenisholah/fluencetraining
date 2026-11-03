"use client";

import { useCallback, useState } from "react";
import { errorMessage } from "@/lib/format";

/**
 * Runs a mutation for one row of a list and keeps the server's refusal next to
 * that row, instead of letting it become an unhandled promise. Starting any
 * action clears the previous message.
 *
 *   const { run, errorFor } = useRowAction();
 *   <Button onClick={() => run(tool._id, () => remove({ toolId: tool._id }))} />
 *   {errorFor(tool._id) && <Alert>{errorFor(tool._id)}</Alert>}
 */
export function useRowAction() {
  const [error, setError] = useState<{ id: string; message: string }>();

  const run = useCallback(async (id: string, action: () => Promise<unknown>) => {
    setError(undefined);
    try {
      await action();
    } catch (err) {
      setError({ id, message: errorMessage(err) });
    }
  }, []);

  const errorFor = (id: string) => (error?.id === id ? error.message : undefined);
  return { run, errorFor };
}
