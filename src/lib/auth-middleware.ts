import { createMiddleware } from "@tanstack/react-start";

// Server-side guard for every protected server function. The session lives in an
// httpOnly cookie, so nothing needs to be attached on the client.
export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { currentUserId } = await import("./auth.server");
  const userId = await currentUserId();
  if (!userId) throw new Error("Unauthorized: please sign in again.");
  return next({ context: { userId } });
});
