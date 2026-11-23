import { describe, expect, it } from "vitest";
import { readToken, signToken } from "./auth.js";

const user = { id: "user_1", handle: "maya", displayName: "Maya Chen" };

describe("JWT helpers", () => {
  it("round-trips a signed token", async () => {
    const token = await signToken(user, "test-secret");
    const claims = await readToken(token, "test-secret");
    expect(claims).toEqual({ sub: "user_1", handle: "maya" });
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signToken(user, "test-secret");
    expect(await readToken(token, "other-secret")).toBeUndefined();
  });

  it("rejects an expired token", async () => {
    const token = await signToken(user, "test-secret", "0s");
    // jose treats 0s as already expired; give the clock a tick to be sure
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await readToken(token, "test-secret")).toBeUndefined();
  });
});
