import assert from "node:assert/strict";
import test from "node:test";
import {
  builtInCatalog,
  catalogProblems,
  describeChainFailure,
  engineRoutes,
  isModelChainError,
  isValidModelId,
  modelChain,
  modelLabel,
  normalizeCatalog,
  providerFor,
  providersOf,
  runModelChain,
  thinkingFor,
  ModelChainError,
} from "./aiModels";
import type { AIModelCatalog } from "./aiModels";

function hasUndefined(value: unknown): boolean {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.some(hasUndefined);
  if (value && typeof value === "object") return Object.values(value).some(hasUndefined);
  return false;
}

test("the built-in catalog is the recommended setup and valid as shipped", () => {
  const catalog = builtInCatalog();
  assert.deepEqual(catalog.providers.gemini, { primary: "gemini-3.1-pro-preview", fallback: "gemini-3.6-flash" });
  assert.deepEqual(catalog.providers.openai, { primary: "gpt-4o", fallback: "gpt-4o-mini" });
  assert.equal(catalog.defaultEngine, "hybrid-gemini");
  assert.deepEqual(catalogProblems(catalog), []);
  // A fresh copy each time: changing one never changes another.
  catalog.models.length = 0;
  assert.ok(builtInCatalog().models.length > 0);
});

test("a stored catalog is used as saved, with a model the code has never heard of", () => {
  const saved = {
    ...builtInCatalog(),
    models: [
      ...builtInCatalog().models,
      { id: "gemini-4.0-ultra", provider: "gemini", label: "Gemini 4 Ultra", thinking: "high", pricing: { input: 3, output: 12 } },
    ],
    providers: {
      gemini: { primary: "gemini-4.0-ultra", fallback: "gemini-3.1-pro-preview" },
      openai: { primary: "gpt-4o-mini", fallback: "" },
    },
    defaultEngine: "gemini",
    updatedAt: "2026-05-01T10:00:00.000Z",
    updatedBy: "admin@example.com",
  };
  const catalog = normalizeCatalog(saved);
  assert.deepEqual(catalog.providers.gemini, { primary: "gemini-4.0-ultra", fallback: "gemini-3.1-pro-preview" });
  assert.deepEqual(catalog.providers.openai, { primary: "gpt-4o-mini", fallback: "" });
  assert.equal(catalog.defaultEngine, "gemini");
  assert.equal(modelLabel(catalog, "gemini-4.0-ultra"), "Gemini 4 Ultra");
  assert.equal(thinkingFor(catalog, "gemini-4.0-ultra"), "high");
  assert.equal(catalog.updatedBy, "admin@example.com");
  assert.deepEqual(catalogProblems(catalog), []);
});

test("untrusted data is repaired, never trusted", () => {
  const catalog = normalizeCatalog({
    models: [
      { id: "gemini-3.6-flash", provider: "gemini", label: "  Flash  ", thinking: "turbo" },
      { id: "gemini-3.6-flash", provider: "gemini", label: "Duplicate" },
      { id: "bad id with spaces", provider: "gemini", label: "Bad" },
      { id: "claude-9", provider: "anthropic", label: "Unsupported provider" },
      { id: "gpt-4o", provider: "openai", pricing: { input: -1, output: 2 } },
    ],
    providers: {
      gemini: { primary: "not-listed", fallback: "gemini-3.6-flash" },
      openai: { primary: "gpt-4o", fallback: "gpt-4o" },
    },
    defaultEngine: "quantum",
    speechModel: "bad id",
  });
  assert.deepEqual(
    catalog.models.map((model) => model.id),
    ["gemini-3.6-flash", "gpt-4o"]
  );
  assert.equal(catalog.models[0].label, "Flash");
  assert.equal(catalog.models[0].thinking, "default");
  assert.equal(catalog.models[1].label, "gpt-4o");
  assert.equal(catalog.models[1].pricing, undefined);
  // A primary naming no listed model falls to the first one; a fallback equal to its primary is dropped.
  assert.deepEqual(catalog.providers.gemini, { primary: "gemini-3.6-flash", fallback: "" });
  assert.deepEqual(catalog.providers.openai, { primary: "gpt-4o", fallback: "" });
  assert.equal(catalog.defaultEngine, "hybrid-gemini");
  assert.equal(catalog.speechModel, builtInCatalog().speechModel);
  assert.equal(hasUndefined(catalog), false, "Firestore cannot store undefined");
});

test("nothing usable falls back to the built-in catalog", () => {
  for (const raw of [null, undefined, "catalog", 42, {}, { models: [] }, { models: [{ id: "", provider: "gemini" }] }]) {
    assert.deepEqual(normalizeCatalog(raw), builtInCatalog());
  }
});

test("a model ID appears once, whatever the provider, and thinking is read from Gemini entries only", () => {
  const catalog = normalizeCatalog({
    models: [
      { id: "gemini-3.1-pro-preview", provider: "openai", label: "Impostor", thinking: "high", pricing: { input: 0, output: 0 } },
      { id: "gemini-3.1-pro-preview", provider: "gemini", label: "Gemini 3.1 Pro", thinking: "medium" },
      { id: "gemini-3.6-flash", provider: "gemini", label: "Flash", thinking: "low" },
    ],
  });
  assert.deepEqual(catalog.models.map((model) => `${model.provider}:${model.id}`), [
    "openai:gemini-3.1-pro-preview",
    "gemini:gemini-3.6-flash",
  ]);
  // The OpenAI entry's "high" is not a Gemini setting.
  assert.equal(thinkingFor(catalog, "gemini-3.1-pro-preview"), "default");
  assert.equal(thinkingFor(catalog, "gemini-3.6-flash"), "low");

  const draft: AIModelCatalog = {
    ...builtInCatalog(),
    models: [...builtInCatalog().models, { id: "gpt-4o", provider: "gemini", label: "Mistake", thinking: "low" }],
  };
  assert.ok(catalogProblems(draft).some((problem) => problem.includes('"gpt-4o" is listed twice')));
});

test("model IDs: provider names, paths and fine-tunes are accepted; anything else is not", () => {
  for (const id of ["gemini-3.1-pro-preview", "models/gemini-3.6-flash", "ft:gpt-4o-mini:org::abc123", "o3-mini"]) {
    assert.equal(isValidModelId(id), true, id);
  }
  for (const id of ["", " gpt-4o", "gpt 4o", "-leading-dash", "gpt-4o?x=1", "a".repeat(101), 7, null]) {
    assert.equal(isValidModelId(id), false, String(id));
  }
});

test("catalogProblems names everything that blocks a save", () => {
  const catalog: AIModelCatalog = {
    ...builtInCatalog(),
    models: [
      { id: "gemini-3.6-flash", provider: "gemini", label: "Flash", thinking: "low" },
      { id: "gemini-3.6-flash", provider: "gemini", label: "", thinking: "low" },
    ],
    providers: {
      gemini: { primary: "gemini-3.6-flash", fallback: "gemini-3.6-flash" },
      openai: { primary: "", fallback: "" },
    },
    defaultEngine: "hybrid-openai",
  };
  const problems = catalogProblems(catalog);
  assert.ok(problems.some((problem) => problem.includes("listed twice")), problems.join(" | "));
  assert.ok(problems.some((problem) => problem.includes("needs a display name")), problems.join(" | "));
  assert.ok(problems.some((problem) => problem.includes("different model from its primary")), problems.join(" | "));
  assert.ok(problems.some((problem) => problem.includes("needs at least one OpenAI model")), problems.join(" | "));
});

test("a call runs on the primary, then the fallback; fast mode starts on the fallback", () => {
  const catalog = builtInCatalog();
  assert.deepEqual(modelChain(catalog, "gemini"), ["gemini-3.1-pro-preview", "gemini-3.6-flash"]);
  assert.deepEqual(modelChain(catalog, "gemini", { fast: true }), ["gemini-3.6-flash", "gemini-3.1-pro-preview"]);
  const noFallback = normalizeCatalog({ ...catalog, providers: { ...catalog.providers, openai: { primary: "gpt-4o", fallback: "" } } });
  assert.deepEqual(modelChain(noFallback, "openai"), ["gpt-4o"]);
  assert.deepEqual(modelChain(noFallback, "openai", { fast: true }), ["gpt-4o"]);
});

test("engines route each kind of work to one provider, never both for the same call", () => {
  assert.equal(providerFor("gemini", "writing"), "gemini");
  assert.equal(providerFor("hybrid-gemini", "writing"), "gemini");
  assert.equal(providerFor("openai", "analysis"), "openai");
  assert.equal(providerFor("hybrid-openai", "analysis"), "gemini");
  assert.equal(providerFor("hybrid-openai", "writing"), "openai");
  assert.deepEqual(providersOf("hybrid-openai"), ["gemini", "openai"]);
  assert.deepEqual(providersOf("hybrid-gemini"), ["gemini"]);

  const routes = engineRoutes(builtInCatalog(), "hybrid-openai");
  assert.deepEqual(
    routes.map((route) => [route.work, route.provider, route.primary, route.fallback]),
    [
      ["Writing", "openai", "gpt-4o", "gpt-4o-mini"],
      ["Reading and checks", "gemini", "gemini-3.1-pro-preview", "gemini-3.6-flash"],
    ]
  );
});

test("runModelChain answers from the first model that works and names it", async () => {
  const tried: string[] = [];
  const { value, model } = await runModelChain("gemini", ["primary-model", "fallback-model"], async (candidate) => {
    tried.push(candidate);
    if (candidate === "primary-model") throw new Error("429 RESOURCE_EXHAUSTED");
    return `answer from ${candidate}`;
  });
  assert.deepEqual(tried, ["primary-model", "fallback-model"]);
  assert.equal(model, "fallback-model");
  assert.equal(value, "answer from fallback-model");
});

test("runModelChain never tries a model outside the chain and stops with both reasons", async () => {
  const tried: string[] = [];
  await assert.rejects(
    runModelChain("openai", ["gpt-4o", "gpt-4o-mini"], async (candidate) => {
      tried.push(candidate);
      throw new Error(JSON.stringify({ error: { message: `${candidate} is overloaded` } }));
    }),
    (error: unknown) => {
      assert.ok(isModelChainError(error));
      assert.ok(error instanceof ModelChainError);
      assert.deepEqual(error.attempts.map((attempt) => attempt.model), ["gpt-4o", "gpt-4o-mini"]);
      // Provider errors in JSON are reduced to their message.
      assert.equal(error.attempts[0].error, "gpt-4o is overloaded");
      assert.match(error.message, /^OpenAI: gpt-4o failed \(gpt-4o is overloaded\), then gpt-4o-mini failed/);
      assert.match(error.message, /The run stopped\.$/);
      return true;
    }
  );
  assert.deepEqual(tried, ["gpt-4o", "gpt-4o-mini"]);
});

test("with no fallback the run stops after the primary, and says why", async () => {
  await assert.rejects(
    runModelChain("gemini", ["gemini-3.1-pro-preview"], async () => {
      throw new Error("model not found");
    }),
    /No fallback model is set, so the run stopped\./
  );
  await assert.rejects(runModelChain("gemini", [], async () => "never"), /No Gemini model is configured/);
  assert.match(describeChainFailure("openai", []), /Admin Dashboard > AI Models/);
});

test("a stopped run is recognised after crossing the network as a plain Error", () => {
  const relayed = new Error("Gemini: x failed (y). The run stopped.");
  relayed.name = "ModelChainError";
  assert.equal(isModelChainError(relayed), true);
  assert.equal(isModelChainError(new Error("network down")), false);
});
