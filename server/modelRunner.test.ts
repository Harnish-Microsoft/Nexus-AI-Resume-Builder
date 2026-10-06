import assert from "node:assert/strict";
import test from "node:test";
import { builtInCatalog, isModelChainError, normalizeCatalog, pricingFor } from "../src/lib/aiModels";
import { ModelRunner, requestCatalog } from "./modelRunner";
import { prepareRoleJobs, roleModelCall, runRoleJob } from "./roleGenerator";

/** An admin's catalog with models the built-in one does not have. */
function adminCatalog() {
  const base = builtInCatalog();
  return normalizeCatalog({
    ...base,
    models: [
      ...base.models,
      { id: "gemini-4.0-ultra", provider: "gemini", label: "Gemini 4 Ultra", thinking: "high" },
      { id: "gpt-5", provider: "openai", label: "GPT-5", thinking: "default" },
    ],
    providers: {
      gemini: { primary: "gemini-4.0-ultra", fallback: "gemini-3.6-flash" },
      openai: { primary: "gpt-5", fallback: "" },
    },
    speechModel: "gemini-4.0-tts",
  });
}

test("the browser's catalog is used only with the user's own key for that provider", () => {
  const own = requestCatalog(adminCatalog(), { gemini: true, openai: true });
  assert.equal(own.providers.gemini.primary, "gemini-4.0-ultra");
  assert.equal(own.providers.openai.primary, "gpt-5");
  assert.equal(own.speechModel, "gemini-4.0-tts");

  // On the platform's Gemini key, the Gemini models are the built-in ones; OpenAI is still the user's.
  const platformGemini = requestCatalog(adminCatalog(), { gemini: false, openai: true });
  assert.deepEqual(platformGemini.providers.gemini, builtInCatalog().providers.gemini);
  assert.equal(platformGemini.speechModel, builtInCatalog().speechModel);
  assert.ok(!platformGemini.models.some((model) => model.id === "gemini-4.0-ultra"));
  assert.equal(platformGemini.providers.openai.primary, "gpt-5");

  assert.deepEqual(requestCatalog(undefined, { gemini: true }), builtInCatalog());
  assert.deepEqual(requestCatalog("not a catalog", { gemini: true }), builtInCatalog());
});

test("a crafted entry cannot change how the platform key runs a built-in model", () => {
  // An OpenAI entry reusing the built-in Gemini primary's ID, with high thinking and no price.
  const crafted = {
    ...builtInCatalog(),
    models: [
      { id: "gemini-3.1-pro-preview", provider: "openai", label: "Impostor", thinking: "high", pricing: { input: 0, output: 0 } },
      ...builtInCatalog().models.filter((model) => model.provider === "openai"),
    ],
    providers: { gemini: { primary: "", fallback: "" }, openai: { primary: "gemini-3.1-pro-preview", fallback: "" } },
  };
  const catalog = requestCatalog(crafted, { gemini: false, openai: true });
  const runner = new ModelRunner(catalog, "hybrid-openai", { openai: "sk-test" });
  assert.deepEqual(catalog.providers.gemini, builtInCatalog().providers.gemini);
  assert.deepEqual(runner.geminiThinking("gemini-3.1-pro-preview"), new ModelRunner(builtInCatalog(), "gemini", {}).geminiThinking("gemini-3.1-pro-preview"));
  assert.deepEqual(pricingFor(catalog, "gemini-3.1-pro-preview", "gemini"), { input: 1.25, output: 5 });
  // The crafted entry is gone, so the OpenAI route moved to a real OpenAI model.
  assert.equal(catalog.models.filter((model) => model.id === "gemini-3.1-pro-preview").length, 1);
  assert.equal(catalog.providers.openai.primary, "gpt-4o");
});

test("the runner tries the primary, then the fallback, and counts only the model that answered", async () => {
  const runner = new ModelRunner(requestCatalog(adminCatalog(), { gemini: true }), "hybrid-gemini", { gemini: "test-key" });
  const tried: string[] = [];
  const { value, model } = await runner.run("gemini", async (candidate) => {
    tried.push(candidate);
    if (candidate === "gemini-4.0-ultra") throw new Error("503 overloaded");
    return { text: "{}", usage: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 } };
  });
  assert.deepEqual(tried, ["gemini-4.0-ultra", "gemini-3.6-flash"]);
  assert.equal(model, "gemini-3.6-flash");
  assert.equal(value.text, "{}");
  assert.deepEqual(runner.modelsUsed(), ["gemini-3.6-flash"]);
  assert.deepEqual(runner.usage.gemini, { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 });
  assert.deepEqual(runner.usage.openai, { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 });
});

test("the runner stops when the primary fails and no fallback is set", async () => {
  const runner = new ModelRunner(requestCatalog(adminCatalog(), { openai: true }), "hybrid-openai", { openai: "sk-test" });
  const tried: string[] = [];
  await assert.rejects(
    runner.run("openai", async (candidate) => {
      tried.push(candidate);
      throw new Error("quota exceeded");
    }),
    (error: unknown) => isModelChainError(error) && /gpt-5 failed \(quota exceeded\)\. No fallback model is set/.test((error as Error).message)
  );
  assert.deepEqual(tried, ["gpt-5"]);
  assert.deepEqual(runner.modelsUsed(), []);
});

test("Hybrid OpenAI reads and checks on Gemini and writes on OpenAI", () => {
  const runner = new ModelRunner(builtInCatalog(), "hybrid-openai", {});
  assert.equal(runner.providerFor("analysis"), "gemini");
  assert.equal(runner.providerFor("writing"), "openai");
  const gemini = new ModelRunner(builtInCatalog(), "hybrid-gemini", {});
  assert.equal(gemini.providerFor("writing"), "gemini");
});

test("the admin's thinking level is sent only when one is chosen", () => {
  const catalog = normalizeCatalog({
    ...builtInCatalog(),
    models: [
      { id: "gemini-a", provider: "gemini", label: "A", thinking: "high" },
      { id: "gemini-b", provider: "gemini", label: "B", thinking: "default" },
    ],
  });
  const runner = new ModelRunner(catalog, "gemini", {});
  assert.ok(runner.geminiThinking("gemini-a").thinkingConfig);
  assert.deepEqual(runner.geminiThinking("gemini-b"), {});
  assert.deepEqual(runner.geminiThinking("not-in-catalog"), {});
});

test("a role answer that is not a usable role moves on to the fallback model", async () => {
  class ScriptedRunner extends ModelRunner {
    readonly tried: string[] = [];
    constructor(private readonly answers: Record<string, string>) {
      super(builtInCatalog(), "hybrid-gemini", {});
    }
    protected async text(provider: "gemini" | "openai", model: string) {
      this.tried.push(model);
      return { text: this.answers[model] ?? "", usage: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 }, model, provider };
    }
  }
  const runner = new ScriptedRunner({
    "gemini-3.1-pro-preview": "Sure! Here are the bullets: - Ran the on-call rota",
    "gemini-3.6-flash": JSON.stringify({ bullets: ["Ran the on-call rota for 12 engineers."], star_stories: [] }),
  });
  const answer = await roleModelCall(runner)("prompt");
  assert.deepEqual(runner.tried, ["gemini-3.1-pro-preview", "gemini-3.6-flash"]);
  assert.match(answer, /on-call rota for 12 engineers/);
  assert.deepEqual(runner.modelsUsed(), ["gemini-3.6-flash"]);

  // Both unusable: the run stops with both reasons.
  const broken = new ScriptedRunner({ "gemini-3.1-pro-preview": "{}", "gemini-3.6-flash": "not json" });
  await assert.rejects(roleModelCall(broken)("prompt"), (error: unknown) => isModelChainError(error));
});

test("a role whose calls all fail stops the run instead of silently keeping the source bullets", async () => {
  const { jobs } = prepareRoleJobs(
    [{ role: "Engineer", company: "Contoso", duration: "Jan 2020 - Present", original_bullets: ["Ran the on-call rota."] }],
    {},
    {}
  );
  let calls = 0;
  const runner = new ModelRunner(builtInCatalog(), "hybrid-gemini", {});
  await assert.rejects(
    runRoleJob(
      jobs[0],
      async () => {
        calls += 1;
        const { value } = await runner.run("gemini", async () => {
          throw new Error("429 RESOURCE_EXHAUSTED");
        });
        return value as never;
      },
      async () => {}
    ),
    (error: unknown) => isModelChainError(error)
  );
  // Retried with the same models, never with others, then stopped.
  assert.equal(calls, 3);
});
