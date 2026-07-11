/**
 * One-time Pinecone index setup for the ALG-2 vector store (§14 decision log,
 * 2026-07-11). Creates a standard serverless index matching the pinned OpenAI
 * text-embedding-3-small output: 1536 dimensions, cosine metric — so stored
 * scores stay interchangeable with the in-process snap math.
 *
 * Usage: npm run pinecone:setup   (reads .env via node --env-file)
 */

const CONTROL_PLANE = "https://api.pinecone.io";
const API_VERSION = "2025-04";

const apiKey = process.env.PINECONE_API_KEY?.trim();
const indexName = process.env.PINECONE_INDEX?.trim();
if (!apiKey || !indexName) {
  console.error(
    "Set PINECONE_API_KEY and PINECONE_INDEX in .env before running pinecone:setup.",
  );
  process.exit(1);
}

const headers = {
  "api-key": apiKey,
  "content-type": "application/json",
  "x-pinecone-api-version": API_VERSION,
};

const created = await fetch(`${CONTROL_PLANE}/indexes`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    name: indexName,
    dimension: 1536,
    metric: "cosine",
    spec: { serverless: { cloud: "aws", region: "us-east-1" } },
  }),
});

if (created.status === 409) {
  console.log(`Index "${indexName}" already exists.`);
} else if (created.ok) {
  console.log(`Index "${indexName}" created.`);
} else {
  console.error(
    `Creating index "${indexName}" failed with status ${created.status}:`,
    await created.text(),
  );
  process.exit(1);
}

for (let attempt = 1; attempt <= 15; attempt += 1) {
  const described = await fetch(
    `${CONTROL_PLANE}/indexes/${encodeURIComponent(indexName)}`,
    { headers },
  );
  if (!described.ok) {
    console.error(`Describing the index failed with status ${described.status}.`);
    process.exit(1);
  }
  const index = await described.json();
  if (index.status?.ready) {
    if (index.dimension !== 1536 || index.metric !== "cosine") {
      console.error(
        `Index "${indexName}" is ${index.dimension}-dim/${index.metric}, but the`,
        "vector store needs 1536-dim/cosine (text-embedding-3-small). Point",
        "PINECONE_INDEX at a matching index.",
      );
      process.exit(1);
    }
    console.log(`Ready: ${index.host} (1536-dim, cosine, serverless).`);
    process.exit(0);
  }
  console.log(`Waiting for the index to become ready (${attempt}/15)…`);
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

console.error("The index did not become ready in time; re-run pinecone:setup.");
process.exit(1);
