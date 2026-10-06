import assert from "node:assert/strict";
import test from "node:test";
import { auth } from "../firebase";
import { saveModelCatalog } from "../services/modelCatalog";
import { builtInCatalog } from "./aiModels";

test("catalog saves require refreshed verified admin claims before writing", async (t) => {
  const original = Object.getOwnPropertyDescriptor(auth, "currentUser");
  const steps: string[] = [];
  const account = (email: string, verified: boolean) => ({
    email,
    emailVerified: true,
    reload: async () => { steps.push("reload"); },
    getIdTokenResult: async (forceRefresh: boolean) => {
      assert.equal(forceRefresh, true);
      steps.push("token");
      return { claims: { email, email_verified: verified } };
    },
  });
  const setUser = (user: ReturnType<typeof account> | null) => {
    Object.defineProperty(auth, "currentUser", { configurable: true, writable: true, value: user });
    steps.length = 0;
  };
  try {
    await t.test("signed-out users cannot save", async () => {
      setUser(null);
      await assert.rejects(saveModelCatalog(builtInCatalog()), /Sign in with a verified admin/);
      assert.deepEqual(steps, []);
    });
    await t.test("accounts without an email cannot save", async () => {
      setUser(account("", true));
      await assert.rejects(saveModelCatalog(builtInCatalog()), /This account cannot save AI models/);
      assert.deepEqual(steps, ["reload", "token"]);
    });
    await t.test("unverified non-listed users cannot save", async () => {
      setUser(account("any-user@example.com", false));
      await assert.rejects(saveModelCatalog(builtInCatalog()), /Your admin email is not verified/);
      assert.deepEqual(steps, ["reload", "token"]);
    });
    await t.test("stale local verification cannot override refreshed claims", async () => {
      setUser(account("hackerharnish@gmail.com", false));
      await assert.rejects(saveModelCatalog(builtInCatalog()), /Your admin email is not verified/);
      assert.deepEqual(steps, ["reload", "token"]);
    });
    await t.test("account refresh failures remain explicit", async () => {
      const user = account("hackerharnish@gmail.com", true);
      user.reload = async () => { throw new Error("Account refresh failed"); };
      setUser(user);
      await assert.rejects(saveModelCatalog(builtInCatalog()), /Account refresh failed/);
      assert.deepEqual(steps, []);
    });
  } finally {
    if (original) Object.defineProperty(auth, "currentUser", original);
    else Reflect.deleteProperty(auth, "currentUser");
  }
});
