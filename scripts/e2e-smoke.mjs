import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";

import { MongoMemoryServer } from "mongodb-memory-server";

const PORT = 3015;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function log(message) {
  process.stdout.write(`[e2e] ${message}\n`);
}

function createSimplePdfBuffer(text) {
  const escapeText = text.replace(/[()\\]/g, "\\$&");
  const stream = `BT /F1 18 Tf 72 720 Td (${escapeText}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

async function waitForServer(url, timeoutMs = 120000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${url}/auth/login`);
      if (response.ok) {
        return;
      }
    } catch {
      // server not ready yet
    }

    await wait(1000);
  }

  throw new Error(`Timed out waiting for server at ${url}`);
}

function cookieFromResponse(response) {
  const header = response.headers.get("set-cookie");
  return header ? header.split(";")[0] : "";
}

async function run() {
  let mongo;
  let app;

  try {
    mongo = await MongoMemoryServer.create();
    const mongoUri = mongo.getUri("askmynotes");

    log(`MongoMemoryServer started: ${mongoUri}`);

    app = spawn("npx", ["next", "dev", "-H", "127.0.0.1", "-p", String(PORT)], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: "development",
        JWT_SECRET: "askmynotes-e2e-secret-123",
        MONGODB_URI: mongoUri,
        LLM_PROVIDER: "openai",
        OPENAI_API_KEY: "",
        OPENROUTER_API_KEY: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    app.stdout?.on("data", (data) => {
      const text = String(data);
      if (text.includes("Ready")) {
        log("Next.js server ready");
      }
    });

    app.stderr?.on("data", (data) => {
      process.stderr.write(String(data));
    });

    await waitForServer(BASE_URL);

    let cookie = "";

    async function authedFetch(path, options = {}) {
      const headers = new Headers(options.headers || {});
      if (cookie) headers.set("cookie", cookie);

      const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers,
      });

      const updated = cookieFromResponse(response);
      if (updated) cookie = updated;

      const payload = await response.json().catch(() => ({}));
      return { response, payload };
    }

    const uniqueEmail = `e2e_${Date.now()}@askmynotes.com`;

    log("Testing signup");
    {
      const { response, payload } = await authedFetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: uniqueEmail, password: "Demo@1234" }),
      });
      assert.equal(response.status, 200);
      assert.equal(Boolean(payload.user?.id), true);
      assert.equal(Boolean(cookie), true);
    }

    log("Testing subject creation and 3-subject enforcement");
    const subjectNames = ["Biology", "Mathematics", "History", "Chemistry"];
    const subjectIds = [];

    for (let i = 0; i < subjectNames.length; i += 1) {
      const { response, payload } = await authedFetch("/api/subjects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: subjectNames[i] }),
      });

      if (i < 3) {
        assert.equal(response.status, 201);
        assert.equal(Boolean(payload.subject?.id), true);
        subjectIds.push(payload.subject.id);
      } else {
        assert.equal(response.status, 400);
        assert.equal(payload.error, "You can only create exactly 3 subjects.");
      }
    }

    const [biologySubjectId, mathSubjectId, historySubjectId] = subjectIds;

    log("Testing file upload + parsing + chunking");
    {
      const notes = [
        "Glycolysis is the first stage of cellular respiration and occurs in the cytoplasm where enzymes split glucose into pyruvate.",
        "In glycolysis, ATP is invested early and ATP is produced later, creating a net ATP gain for the cell.",
        "NADH generated during glycolysis carries high-energy electrons toward later respiration pathways.",
        "The Krebs cycle follows glycolysis and generates additional electron carriers for oxidative phosphorylation.",
        "Electron transport chain reactions occur in the inner mitochondrial membrane and use oxygen as the final electron acceptor.",
        "ATP synthase uses a proton gradient to generate ATP and couple energy transfer to phosphorylation.",
        "Fermentation can regenerate NAD plus when oxygen is absent, allowing glycolysis to continue in anaerobic conditions.",
        "Cellular respiration connects glycolysis, the Krebs cycle, and electron transport to release energy from nutrients.",
        "Regulatory enzymes tightly control glycolysis rates based on ATP demand and substrate availability in the cytoplasm.",
        "Clinical contexts often discuss glycolysis changes in fast-growing cells and altered metabolic environments.",
      ]
        .map((line) => `${line} ${line}`)
        .join(" ");

      const blob = new Blob([notes], { type: "text/plain" });
      const form = new FormData();
      form.set("file", blob, "biology_notes.txt");

      const { response, payload } = await authedFetch(`/api/subjects/${biologySubjectId}/files`, {
        method: "POST",
        body: form,
      });

      assert.equal(response.status, 200);
      assert.equal(payload.file?.parseStatus, "parsed");
      assert.equal(typeof payload.file?.chunksCount, "number");
      assert.equal(payload.file?.chunksCount > 0, true);
    }

    log("Testing PDF upload + per-page parsing");
    {
      const pdfBuffer = createSimplePdfBuffer("ATP is generated during cellular respiration.");
      const blob = new Blob([pdfBuffer], { type: "application/pdf" });
      const form = new FormData();
      form.set("file", blob, "biology_notes.pdf");

      const { response, payload } = await authedFetch(`/api/subjects/${biologySubjectId}/files`, {
        method: "POST",
        body: form,
      });

      assert.equal(response.status, 200);
      assert.equal(payload.file?.parseStatus, "parsed");
      assert.equal(payload.file?.sectionsCount >= 1, true);
      assert.equal(payload.file?.chunksCount >= 1, true);
    }

    let reviewCardId = "";
    log("Testing spaced repetition deck seed + due queue");
    {
      const { response, payload } = await authedFetch(`/api/subjects/${biologySubjectId}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target: 30 }),
      });

      assert.equal(response.status, 200);
      assert.equal(typeof payload.createdCards, "number");
      assert.equal(Array.isArray(payload.dueCards), true);
      assert.equal(payload.stats?.totalCards > 0, true);
      assert.equal(payload.dueCards.length > 0, true);
      reviewCardId = payload.dueCards[0].id;
    }

    log("Testing spaced repetition rating update");
    {
      const { response, payload } = await authedFetch(`/api/subjects/${biologySubjectId}/review/${reviewCardId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating: "good" }),
      });

      assert.equal(response.status, 200);
      assert.equal(payload.card?.lastRating, "good");
      assert.equal(typeof payload.card?.intervalDays, "number");
      assert.equal(payload.card?.intervalDays >= 1, true);
      assert.equal(typeof payload.card?.dueAt, "string");
    }

    log("Testing spaced repetition due queue endpoint");
    {
      const { response, payload } = await authedFetch(`/api/subjects/${biologySubjectId}/review?limit=10`);
      assert.equal(response.status, 200);
      assert.equal(Array.isArray(payload.dueCards), true);
      assert.equal(typeof payload.stats?.dueCount, "number");
      assert.equal(typeof payload.stats?.reviewedToday, "number");
    }

    log("Testing subject-scoped chat answer with citations/confidence/evidence");
    let firstChatPayload;
    {
      const { response, payload } = await authedFetch(`/api/subjects/${biologySubjectId}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: "What is glycolysis?" }),
      });

      assert.equal(response.status, 200);
      assert.equal(typeof payload.answer, "string");
      assert.equal(payload.answer.includes("Not found in your notes for Biology"), false);
      assert.equal(["High", "Medium", "Low"].includes(payload.confidence), true);
      assert.equal(Array.isArray(payload.citations), true);
      assert.equal(payload.citations.length > 0, true);
      assert.equal(Array.isArray(payload.evidence), true);
      assert.equal(payload.evidence.length > 0, true);
      firstChatPayload = payload;
    }

    log("Testing multi-turn follow-up context handling");
    {
      const { response, payload } = await authedFetch(`/api/subjects/${biologySubjectId}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: "give an example",
          history: [
            { role: "user", text: "What is glycolysis?" },
            { role: "assistant", text: firstChatPayload.answer },
          ],
        }),
      });

      assert.equal(response.status, 200);
      assert.equal(payload.answer.includes("Not found in your notes for Biology"), false);
      assert.equal(payload.citations.length > 0, true);
      assert.equal(payload.evidence.length > 0, true);
    }

    log("Testing strict Not Found for unrelated question");
    {
      const { response, payload } = await authedFetch(`/api/subjects/${biologySubjectId}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: "Who won the 2018 football world cup?" }),
      });

      assert.equal(response.status, 200);
      assert.equal(payload.answer, "Not found in your notes for Biology");
      assert.equal(payload.citations.length, 0);
      assert.equal(payload.evidence.length, 0);
    }

    log("Testing strict subjectId filtering in retrieval");
    {
      const { response, payload } = await authedFetch(`/api/subjects/${mathSubjectId}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: "What is glycolysis?" }),
      });

      assert.equal(response.status, 200);
      assert.equal(payload.answer, "Not found in your notes for Mathematics");
      assert.equal(payload.citations.length, 0);
      assert.equal(payload.evidence.length, 0);
    }

    log("Testing study mode generation contract");
    let studyPack;
    {
      const { response, payload } = await authedFetch(
        `/api/subjects/${biologySubjectId}/study?difficulty=hard&variation=seed-a`,
      );
      assert.equal(response.status, 200);
      assert.equal(["Easy", "Medium", "Hard"].includes(payload.difficulty), true);
      assert.equal(Array.isArray(payload.mcqs), true);
      assert.equal(payload.mcqs.length, 5);
      assert.equal(Array.isArray(payload.shortAnswers), true);
      assert.equal(payload.shortAnswers.length, 3);
      assert.equal(Array.isArray(payload.flashcards), true);
      assert.equal(payload.flashcards.length, 10);
      assert.equal(payload.mcqs.every((item) => Array.isArray(item.citations) && item.citations.length > 0), true);
      assert.equal(payload.mcqs.every((item) => Array.isArray(item.evidence) && item.evidence.length > 0), true);
      assert.equal(payload.shortAnswers.every((item) => Array.isArray(item.citations) && item.citations.length > 0), true);
      assert.equal(payload.shortAnswers.every((item) => Array.isArray(item.evidence) && item.evidence.length > 0), true);
      assert.equal(payload.flashcards.every((item) => Array.isArray(item.citations) && item.citations.length > 0), true);
      studyPack = payload;
    }

    log("Testing regenerate returns a different study set");
    {
      const first = studyPack;
      const second = await authedFetch(`/api/subjects/${biologySubjectId}/study?difficulty=hard&variation=seed-b`);
      assert.equal(second.response.status, 200);

      const firstQuestionA = first.mcqs[0]?.question || "";
      const firstQuestionB = second.payload.mcqs?.[0]?.question || "";
      const firstFlashA = first.flashcards[0]?.front || "";
      const firstFlashB = second.payload.flashcards?.[0]?.front || "";

      assert.equal(firstQuestionA !== firstQuestionB || firstFlashA !== firstFlashB, true);
    }

    log("Testing AI Lab generation contract");
    {
      const { response, payload } = await authedFetch(`/api/subjects/${biologySubjectId}/ai-lab`);
      assert.equal(response.status, 200);
      assert.equal(Array.isArray(payload.keyConcepts), true);
      assert.equal(payload.keyConcepts.length, 6);
      assert.equal(Array.isArray(payload.flashcards), true);
      assert.equal(payload.flashcards.length, 8);
      assert.equal(Array.isArray(payload.revisionPlan), true);
      assert.equal(payload.revisionPlan.length, 3);
      assert.equal(payload.keyConcepts.every((item) => Array.isArray(item.citations) && item.citations.length > 0), true);
      assert.equal(payload.flashcards.every((item) => Array.isArray(item.evidence) && item.evidence.length > 0), true);
    }

    log("Testing answer coach API");
    {
      const { response, payload } = await authedFetch(`/api/subjects/${biologySubjectId}/ai-lab/coach`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: "What is glycolysis?",
          answer: "Glycolysis is the first stage of cellular respiration and makes ATP.",
        }),
      });
      assert.equal(response.status, 200);
      assert.equal(typeof payload.score, "number");
      assert.equal(["Excellent", "Good", "Needs Work"].includes(payload.verdict), true);
      assert.equal(typeof payload.improvedAnswer, "string");
      assert.equal(Array.isArray(payload.citations), true);
      assert.equal(payload.citations.length > 0, true);
    }

    log("Testing boost smart search API");
    {
      const { response, payload } = await authedFetch(`/api/subjects/${biologySubjectId}/boost/search`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "glycolysis", limit: 5 }),
      });
      assert.equal(response.status, 200);
      assert.equal(typeof payload.totalHits, "number");
      assert.equal(Array.isArray(payload.hits), true);
      assert.equal(payload.hits.length > 0, true);
      assert.equal(typeof payload.hits[0].textSnippet, "string");
    }

    log("Testing boost concept explainer API");
    {
      const { response, payload } = await authedFetch(`/api/subjects/${biologySubjectId}/boost/explain`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ concept: "glycolysis" }),
      });
      assert.equal(response.status, 200);
      assert.equal(typeof payload.oneLiner, "string");
      assert.equal(payload.oneLiner.includes("Not found in your notes for Biology"), false);
      assert.equal(Array.isArray(payload.citations), true);
      assert.equal(payload.citations.length > 0, true);
    }

    log("Testing boost planner API");
    {
      const { response, payload } = await authedFetch(`/api/subjects/${biologySubjectId}/boost/planner`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ goalMinutes: 40, focus: "glycolysis" }),
      });
      assert.equal(response.status, 200);
      assert.equal(Array.isArray(payload.plan), true);
      assert.equal(payload.plan.length > 0, true);
      assert.equal(typeof payload.totalMinutes, "number");
      assert.equal(payload.totalMinutes > 0, true);
    }

    log("Testing study test checking + marks generation API");
    {
      const mcqAnswers = studyPack.mcqs.map((item) => item.correctOption);
      const shortAnswers = studyPack.shortAnswers.map((item) => item.modelAnswer);
      const { response, payload } = await authedFetch(`/api/subjects/${biologySubjectId}/study/grade`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ studyPack, mcqAnswers, shortAnswers }),
      });

      assert.equal(response.status, 200);
      assert.equal(typeof payload.totalMarks, "number");
      assert.equal(typeof payload.obtainedMarks, "number");
      assert.equal(payload.obtainedMarks, payload.totalMarks);
      assert.equal(payload.percentage, 100);
      assert.equal(Array.isArray(payload.breakdown), true);
      assert.equal(payload.breakdown.length, 8);
    }

    log("Testing settings mode endpoint");
    {
      const { response, payload } = await authedFetch("/api/settings/status");
      assert.equal(response.status, 200);
      assert.equal(payload.mode, "demo");
      assert.equal(payload.llmEnabled, false);
    }

    log("Testing small-notes fallback for chat + study generation");
    {
      const form = new FormData();
      form.set(
        "file",
        new Blob(["Glycolysis converts glucose to pyruvate and releases ATP in the cytoplasm."], { type: "text/plain" }),
        "quick.txt",
      );

      const upload = await authedFetch(`/api/subjects/${historySubjectId}/files`, {
        method: "POST",
        body: form,
      });
      assert.equal(upload.response.status, 200);

      const quickChat = await authedFetch(`/api/subjects/${historySubjectId}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: "What is glycolysis?" }),
      });
      assert.equal(quickChat.response.status, 200);
      assert.equal(quickChat.payload.answer.includes("Not found in your notes for History"), false);
      assert.equal(quickChat.payload.citations.length > 0, true);

      const quickStudy = await authedFetch(`/api/subjects/${historySubjectId}/study?difficulty=easy`);
      assert.equal(quickStudy.response.status, 200);
      assert.equal(quickStudy.payload.mcqs.length, 5);
      assert.equal(quickStudy.payload.shortAnswers.length, 3);
      assert.equal(quickStudy.payload.flashcards.length, 10);
    }

    log("All end-to-end smoke tests passed");
  } finally {
    if (app && !app.killed) {
      app.kill("SIGTERM");
      await wait(500);
      if (!app.killed) {
        app.kill("SIGKILL");
      }
    }

    if (mongo) {
      await mongo.stop();
      log("MongoMemoryServer stopped");
    }
  }
}

run().catch((error) => {
  process.stderr.write(`\n[e2e] Failed: ${error.stack || error.message}\n`);
  process.exit(1);
});
