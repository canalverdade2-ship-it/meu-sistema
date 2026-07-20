import { assertEquals, assertRejects } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { validateAndNormalizeProducts } from "../_shared/product_import_schema.ts";
import { OpenRouterClient, ALLOWED_MODELS } from "../_shared/openrouter_client.ts";

// Simple test to ensure validator works
Deno.test("Validator - Gemma returns JSON válido", () => {
  const rawInput = {
    products: [
      {
        name: "Test Product",
        description: "A description",
        cost: 10.99,
        currency: "BRL",
        page: 1,
        confidence: 0.95
      }
    ],
    warnings: []
  };

  const validated = validateAndNormalizeProducts(rawInput);
  assertEquals(validated.products.length, 1);
  assertEquals(validated.products[0].name, "Test Product");
  assertEquals(validated.products[0].cost, 10.99);
  assertEquals(validated.products[0].confidence, 0.95);
});

Deno.test("Validator - Handles invalid values and caps products at 500", () => {
  const products = [];
  for (let i = 0; i < 600; i++) {
    products.push({
      name: `Product ${i}`,
      confidence: 0.9
    });
  }

  const rawInput = { products };
  const validated = validateAndNormalizeProducts(rawInput);
  assertEquals(validated.products.length, 500); // capped at 500
});

Deno.test("OpenRouter Client - Guardrail blocks unauthorized models", async () => {
  Deno.env.set("OPENROUTER_API_KEY", "test-key");
  const client = new OpenRouterClient();
  
  await assertRejects(
    async () => {
      await client.request({
        model: "openai/gpt-4-turbo", // not in allowlist
        payload: {}
      });
    },
    Error,
    "Modelo não autorizado"
  );
});

Deno.test("OpenRouter Client - Throws on missing API Key", () => {
  Deno.env.delete("OPENROUTER_API_KEY");
  
  assertRejects(
    async () => {
      new OpenRouterClient();
    },
    Error,
    "OPENROUTER_API_KEY ausente"
  );
});
