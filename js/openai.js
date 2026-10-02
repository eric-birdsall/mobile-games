const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

const MIN_CARDS = 20;
const TARGET_CARDS = 30;
const TABOO_COUNT = 5;

/**
 * Validates OpenAI deck payload: { cards: [{ answer, taboo_words }] }.
 * @param { unknown } data
 * @returns {{ ok: true, cards: object[] } | { ok: false, error: string }}
 */
export const validateDeck = (data) => {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Response is not an object." };
  }
  const cards = /** @type { any } */ (data).cards;
  if (!Array.isArray(cards)) {
    return { ok: false, error: "Missing cards array." };
  }
  if (cards.length < MIN_CARDS) {
    return { ok: false, error: `Need at least ${MIN_CARDS} cards, got ${cards.length}.` };
  }
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    if (!c || typeof c !== "object") {
      return { ok: false, error: `Invalid card at index ${i}.` };
    }
    if (typeof c.answer !== "string" || !c.answer.trim()) {
      return { ok: false, error: `Bad answer at index ${i}.` };
    }
    if (!Array.isArray(c.taboo_words) || c.taboo_words.length !== TABOO_COUNT) {
      return { ok: false, error: `Each card needs exactly ${TABOO_COUNT} taboo_words (index ${i}).` };
    }
    for (let j = 0; j < c.taboo_words.length; j++) {
      if (typeof c.taboo_words[j] !== "string" || !c.taboo_words[j].trim()) {
        return { ok: false, error: `Bad taboo word at card ${i}, slot ${j}.` };
      }
    }
  }
  return { ok: true, cards };
};

/**
 * Validates Password deck payload: { cards: [{ answer }] }.
 * @param { unknown } data
 * @returns {{ ok: true, cards: object[] } | { ok: false, error: string }}
 */
export const validatePasswordDeck = (data) => {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Response is not an object." };
  }
  const cards = /** @type { any } */ (data).cards;
  if (!Array.isArray(cards)) {
    return { ok: false, error: "Missing cards array." };
  }
  if (cards.length < MIN_CARDS) {
    return { ok: false, error: `Need at least ${MIN_CARDS} cards, got ${cards.length}.` };
  }
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    if (!c || typeof c !== "object") {
      return { ok: false, error: `Invalid card at index ${i}.` };
    }
    if (typeof c.answer !== "string" || !c.answer.trim()) {
      return { ok: false, error: `Bad answer at index ${i}.` };
    }
  }
  return { ok: true, cards };
};

const stripJsonFromContent = (text) => {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  if (fence) {
    return fence[1].trim();
  }
  return trimmed;
};

const parseDeckJson = (content) => {
  const raw = stripJsonFromContent(content);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const buildUserPrompt = (category, seenAnswers) => {
  const avoid = seenAnswers.length ? `Do not use any of these answers (exact or trivial rewording): ${seenAnswers.join("; ")}.` : "";
  return [
    `Create a Taboo-style word game deck for category: "${category}".`,
    `Return a single JSON object with key "cards" whose value is an array of exactly ${TARGET_CARDS} objects.`,
    `Each object must have:`,
    `- "answer": string (thing teammates should guess)`,
    `- "taboo_words": array of exactly ${TABOO_COUNT} strings (forbidden clues).`,
    "Order cards from easiest to hardest answer.",
    `Important:Do not put the category title in answers or taboo words.`,
    `Ensure no taboo word is the same as its card's answer. Avoid overlap between taboo words and the answer string.`,
    avoid,
    "Respond with JSON only. No markdown fences, no extra text outside the JSON object.",
    `If any words from the provided category are in the answers or taboo words, you have failed.`,
  ].join("\n");
};

const buildPasswordUserPrompt = (category, seenAnswers) => {
  const avoid = seenAnswers.length
    ? `Do not use any of these secret words (exact or trivial rewording): ${seenAnswers.join("; ")}.`
    : "";
  return [
    `Create a deck for the party game Password for category: "${category}".`,
    `Each round one secret word is guessed from one-word spoken clues (honor system).`,
    `Return a single JSON object with key "cards" whose value is an array of exactly ${TARGET_CARDS} objects.`,
    `Each object must have only:`,
    `- "answer": string — a concrete noun, famous title, person, place, or short phrase (1–4 words) that teammates can guess from one-word clues. Avoid full sentences.`,
    "Order cards from easier to harder guesses.",
    `Do not put the category title in any answer.`,
    avoid,
    "Respond with JSON only. No markdown fences, no extra text outside the JSON object.",
  ].join("\n");
};

const callOpenAI = async (apiKey, systemContent, userContent) => {
  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: userContent },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
    max_tokens: 4000,
  };

  const response = await fetch(OPENAI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    const err = new Error(`OpenAI HTTP ${response.status}: ${errText.slice(0, 200)}`);
    /** @type { any } */ (err).status = response.status;
    throw err;
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("OpenAI returned no message content.");
  }
  return content;
};

/**
 * @template T
 * @param { () => Promise<T | { error: string }> } fn
 * @returns {Promise<T | { error: string }>}
 */
const tryWithBackoff = async (fn) => {
  let delay = 1000;
  for (let retries = 3; retries >= 0; retries--) {
    try {
      return await fn();
    } catch (e) {
      const status = /** @type { any } */ (e)?.status;
      const rate = status === 429;
      const msg = String(e?.message || e);
      if (rate && retries > 0) {
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
      return { error: msg };
    }
  }
  return { error: "Too many retries." };
};

/**
 * Loads optional local API key module.
 * @returns {Promise<string>}
 */
export const loadApiKey = async () => {
  try {
    const mod = await import("./openai-key.js");
    const key = mod.default;
    return typeof key === "string" ? key.trim() : "";
  } catch {
    return "";
  }
};

/**
 * Fetches a validated deck from OpenAI. Retries once on parse/validation failure; basic 429 backoff.
 * @param { string } apiKey
 * @param { string } category
 * @param { string[] } seenAnswers
 * @returns {Promise<object[] | { error: string }>}
 */
export const fetchDeckFromOpenAI = async (apiKey, category, seenAnswers = []) => {
  if (!apiKey) {
    return { error: "Missing API key. Copy multigame/js/openai-key.example.js to multigame/js/openai-key.js and add your key." };
  }

  const systemA = "You output only compact JSON for games. Never include JavaScript code or prose outside JSON.";
  const userA = buildUserPrompt(category, seenAnswers);

  const attempt = async (systemContent, userContent) => {
    const content = await callOpenAI(apiKey, systemContent, userContent);
    const parsed = parseDeckJson(content);
    if (!parsed) {
      return { ok: false, reason: "Could not parse JSON from model." };
    }
    const validated = validateDeck(parsed);
    if (!validated.ok) {
      return { ok: false, reason: validated.error };
    }
    return { ok: true, cards: validated.cards };
  };

  const first = await tryWithBackoff(() => attempt(systemA, userA));
  if (first && first.error) {
    return { error: first.error };
  }
  if (first && first.ok) {
    return first.cards;
  }

  const systemB = 'Output a single JSON object {"cards":[...]} only. No markdown. Each card: {"answer":"","taboo_words":["","","","",""]}.';
  const userB = `Category "${category}". ${MIN_CARDS}+ cards. JSON only. ${seenAnswers.length ? `Exclude answers: ${seenAnswers.join(", ")}.` : ""}`;

  const second = await tryWithBackoff(() => attempt(systemB, userB));
  if (second && second.error) {
    return { error: second.error };
  }
  if (second && second.ok) {
    return second.cards;
  }

  const r1 = first && first.reason ? first.reason : "";
  const r2 = second && second.reason ? second.reason : "";
  return { error: r1 || r2 || "Deck validation failed." };
};

/**
 * Fetches a validated Password-only deck from OpenAI (answers only).
 * @param { string } apiKey
 * @param { string } category
 * @param { string[] } seenAnswers
 * @returns {Promise<{ answer: string }[] | { error: string }>}
 */
export const fetchPasswordDeckFromOpenAI = async (apiKey, category, seenAnswers = []) => {
  if (!apiKey) {
    return {
      error:
        "Missing API key. Copy multigame/js/openai-key.example.js to multigame/js/openai-key.js and add your key.",
    };
  }

  const systemA = "You output only compact JSON for games. Never include JavaScript code or prose outside JSON.";
  const userA = buildPasswordUserPrompt(category, seenAnswers);

  const attemptPassword = async (systemContent, userContent) => {
    const content = await callOpenAI(apiKey, systemContent, userContent);
    const parsed = parseDeckJson(content);
    if (!parsed) {
      return { ok: false, reason: "Could not parse JSON from model." };
    }
    const validated = validatePasswordDeck(parsed);
    if (!validated.ok) {
      return { ok: false, reason: validated.error };
    }
    const normalized = validated.cards.map((c) => ({
      answer: String(/** @type { any } */ (c).answer).trim(),
    }));
    return { ok: true, cards: normalized };
  };

  const first = await tryWithBackoff(() => attemptPassword(systemA, userA));
  if (first && "error" in first && first.error) {
    return { error: first.error };
  }
  if (first && "ok" in first && first.ok) {
    return first.cards;
  }

  const systemB =
    'Output a single JSON object {"cards":[...]} only. No markdown. Each card: {"answer":""} — answer only, no other keys.';
  const userB = `Password game deck for category "${category}". ${MIN_CARDS}+ cards with only "answer" per card. JSON only. ${
    seenAnswers.length ? `Exclude: ${seenAnswers.join(", ")}.` : ""
  }`;

  const second = await tryWithBackoff(() => attemptPassword(systemB, userB));
  if (second && "error" in second && second.error) {
    return { error: second.error };
  }
  if (second && "ok" in second && second.ok) {
    return second.cards;
  }

  const r1 = first && "reason" in first && first.reason ? first.reason : "";
  const r2 = second && "reason" in second && second.reason ? second.reason : "";
  return { error: r1 || r2 || "Deck validation failed." };
};
