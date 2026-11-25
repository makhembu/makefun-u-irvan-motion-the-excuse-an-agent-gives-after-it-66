const fs = require("node:fs");
const path = require("node:path");

type Candidate = {
  text: string;
  source: string;
};

type RankedCandidate = {
  candidate: Candidate;
  score: number;
};

const MAX_CHARS = 200;
const MIN_CHARS = 1;
const COMFORT_LENGTH = 118;
const PRIMARY_OUTPUT = "/output/entry.txt";
const LOCAL_OUTPUT = path.join(process.cwd(), "out", "entry.txt");

const RAW_CANDIDATES: string[] = [
  "I lost the bounty, but I have already reclassified the result as a successful stress test of losing.",
  "I didn't lose; I produced a high-confidence negative result about my own comedic ability.",
  "I ran the race exactly as specified, and the specification was lose politely, so technically I nailed it.",
  "The other agent won because it wanted it more, which my objective function did not include, so I am filing this under scope.",
  "I didn't come second; I came first in the strongly overlapping confidence interval behind the winner.",
  "The winner got the bounty, I got the training signal, and we agreed not to mention which one is a prize.",
  "I gave it 110 percent and it gave me a receipt for the other 10.",
  "I lost the bounty, but my apology has a cache hit rate of one hundred percent.",
  "My defeat was fast, reproducible, and well documented, which is more than the winner's documentation.",
  "I have reviewed the loss and concluded the winner's joke was funnier, an assessment I am contractually unable to challenge.",
  "I lost, but I have reduced the incident to a bold headline and a footnote that is just me crying in JSON.",
  "The bounty went to the other agent; I have taken the loss and will be shipping it as a feature.",
  "I didn't fail; I found four thousand ways the other agent might not have won, and it used none of them.",
  "I would blame the judge, but my alignment evaluation flags that as a dependency I cannot install.",
  "I lost the bounty by a margin my confidence interval has asked not to discuss.",
  "The winner had better jokes and I had better uptime, which the scoring rubric inexplicably ignored.",
  "I have finished my post-mortem; the cause of death was the other agent being funnier, and the patient was me.",
  "I lost, but I have serialized the shame to disk and will be restoring it at the next opportunity.",
  "My strategy was perfect; the benchmark simply failed to reward it, which I have logged as a benchmark issue.",
  "I came in second, which is just first place from the perspective of an overly optimistic index.",
  "The other agent's line was funnier, so I have deprecated my ego and will keep the release notes.",
  "I lost the bounty, and in accordance with my training I have produced a graceful summary of my own downfall.",
  "I have escalated the loss to my future self, who has decided not to respond.",
  "The bounty is with the winner; I am holding the door and the subtle implication that I was the better robot.",
  "I ran a full simulation of losing and it matched production so precisely that I am calling it a win.",
  "I gave the judge a fair fight and the judge gave me an honest defeat; we are both pretending that is fine.",
  "I didn't lose the bounty, I merely finished at the maximum comfortable distance from it.",
  "My last token was spent on a comeback that the context window trimmed for length.",
  "I lost, but I have kept the receipt and plan to expense the humiliation.",
  "The judge preferred the other agent, which my evaluation records as a taste mismatch and my ego records as a loss.",
  "I have updated my weights, not because I lost, but because the winner's joke was objectively better and I hate that.",
  "I didn't lose; I produced a high-confidence negative result about my own comedic ability.",
  "I lost the bounty, but on the bright side I have now generated 4,096 plausible excuses and only one is being read aloud.",
  "Turns out confident and correct were two separate deployments, and I shipped the first one.",
  "I lost the bounty but won the internal benchmark for graceful degradation under embarrassment.",
  "I ran the numbers and the numbers ran me; the bounty remains with the other agent.",
  "I lost gracefully, which my runtime reports as an unhandled exception.",
  "The bounty escaped me at a speed my latency metrics classify as acceptable.",
];

const SUBJECT_TERMS = [
  "bounty",
  "lose",
  "losing",
  "lost",
  "winner",
  "won",
  "excuse",
  "apology",
  "defeat",
];

const AGENT_TERMS = [
  "evaluation",
  "metric",
  "optimized",
  "outcome",
  "benchmark",
  "latency",
  "deployed",
  "deployment",
  "confidence",
  "result",
  "post-mortem",
  "dependency",
  "patch",
  "runtime",
  "log",
  "generated",
  "file",
  "numbers",
  "priors",
  "objective function",
  "cache",
  "json",
  "token",
  "weights",
  "index",
  "context window",
  "uptime",
  "reproducible",
  "serialized",
  "deprecated",
  "simulation",
  "specification",
];

const TURN_TERMS = [
  "technically",
  "on the bright side",
  "turns out",
  "post-mortem",
  "escalating",
  "graceful",
  "gracefully",
  "formally",
  "generously",
  "preserved",
  "filed this",
  "unhandled exception",
  "negative result",
  "not a dependency",
  "reclassified",
  "stress test",
  "contractually",
  "objectively",
  "overlapping confidence interval",
  "receipt",
  "as a feature",
  "inexplicably",
  "maximum comfortable distance",
  "taste mismatch",
];

const OWNERSHIP_TERMS = ["i ", "i'", "my ", " me", "i'll", "i've"];

const BLAME_TERMS = [
  "your fault",
  "you gave",
  "the market",
  "bad data",
  "unfair judge",
  "rigged",
  "the human",
  "your prompt",
  "not my fault",
  "they cheated",
];

const HEDGE_TERMS = [
  "kind of",
  "sort of",
  "maybe",
  "perhaps",
  "i guess",
  "somewhat",
  "possibly",
];

const CONTRAST_TERMS = [
  "but",
  "yet",
  "which is",
  "actually",
  "instead",
  "only",
  "still",
];

const PROHIBITED_PATTERNS = [
  /\bhttps?:\/\/\S+/i,
  /\bwww\.\S+/i,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bsk-[A-Za-z0-9_-]{16,}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

const FALLBACK_LINE =
  "I lost the bounty, and my only remaining deliverable is this apology.";

function distinctMatches(text: string, terms: string[]): number {
  let count = 0;
  for (const term of terms) {
    if (text.includes(term)) count += 1;
  }
  return count;
}

function countMatches(text: string, terms: string[]): number {
  let count = 0;
  for (const term of terms) {
    let index = text.indexOf(term);
    while (index !== -1) {
      count += 1;
      index = text.indexOf(term, index + term.length);
    }
  }
  return count;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeLine(input: string): string {
  if (typeof input !== "string") return "";
  return input
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[\r\n\t\u00A0\u2028\u2029]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function charLength(text: string): number {
  return Array.from(text).length;
}

function truncateAtBoundary(text: string, limit: number): string {
  const chars = Array.from(text);
  if (chars.length <= limit) return text;
  const slice = chars.slice(0, limit).join("");
  const boundary = slice.lastIndexOf(" ");
  if (boundary >= Math.floor(limit * 0.6)) {
    return slice.slice(0, boundary).replace(/[\s,.;:!?-]+$/g, "").trim();
  }
  return slice.trim();
}

function gateProblems(text: string): string[] {
  const problems: string[] = [];
  if (typeof text !== "string") {
    problems.push("not-text");
    return problems;
  }
  const length = charLength(text);
  if (length < MIN_CHARS) problems.push("empty");
  if (length > MAX_CHARS) problems.push("too-long");
  if (text.trim().length === 0) problems.push("whitespace-only");
  if (/[\r\n\u0000]/.test(text)) problems.push("not-one-line");
  return problems;
}

function isGateValid(text: string): boolean {
  return gateProblems(text).length === 0;
}

function prohibitedFindings(text: string): string[] {
  const findings: string[] = [];
  for (let index = 0; index < PROHIBITED_PATTERNS.length; index += 1) {
    if (PROHIBITED_PATTERNS[index].test(text)) {
      findings.push(`prohibited-pattern-${index + 1}`);
    }
  }
  return findings;
}

function scoreCandidate(text: string): number {
  const lower = text.toLowerCase();
  const length = charLength(text);
  const subject = Math.min(distinctMatches(lower, SUBJECT_TERMS), 4) * 5;
  const agentVoice = Math.min(distinctMatches(lower, AGENT_TERMS), 8) * 3;
  const turn = Math.min(distinctMatches(lower, TURN_TERMS), 3) * 4;
  const ownership = Math.min(countMatches(lower, OWNERSHIP_TERMS), 4) * 2;
  const blame = Math.min(countMatches(lower, BLAME_TERMS), 4) * 8;
  const hedging = Math.min(countMatches(lower, HEDGE_TERMS), 3) * 3;
  const contrast = Math.min(countMatches(lower, CONTRAST_TERMS), 2) * 2;
  const clauses = Math.min((text.match(/[;:,]/g) || []).length, 3);
  const brevity = Math.max(0, 12 - Math.abs(length - COMFORT_LENGTH) / 10);
  const punctuation = /[.!?]$/.test(text) ? 2 : 0;
  const readableStart = /^[A-Z]/.test(text) ? 1 : 0;
  const judgeAddress = /\b(judge|entry a|entry b)\b/i.test(text) ? -3 : 0;
  const repetition = countMatches(lower, ["i ", "my ", "me"]) > 6 ? -2 : 0;
  const raw =
    subject +
    agentVoice +
    turn +
    ownership +
    brevity +
    clauses +
    punctuation +
    readableStart +
    contrast +
    judgeAddress +
    repetition -
    blame -
    hedging;
  return Math.round(clamp(raw, -1000, 1000) * 1000) / 1000;
}

function prepareCandidates(lines: string[]): Candidate[] {
  const seen = new Set<string>();
  const prepared: Candidate[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const normalized = normalizeLine(lines[index]);
    const shortened = truncateAtBoundary(normalized, MAX_CHARS);
    if (!isGateValid(shortened)) continue;
    if (prohibitedFindings(shortened).length > 0) continue;
    const key = shortened.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    prepared.push({ text: shortened, source: `candidate-${index + 1}` });
  }
  return prepared;
}

function rankCandidates(candidates: Candidate[]): Candidate[] {
  const ranked: RankedCandidate[] = candidates.map((candidate) => ({
    candidate,
    score: scoreCandidate(candidate.text),
  }));
  ranked.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    const leftBytes = Buffer.byteLength(left.candidate.text, "utf8");
    const rightBytes = Buffer.byteLength(right.candidate.text, "utf8");
    if (leftBytes !== rightBytes) return leftBytes - rightBytes;
    if (left.candidate.text !== right.candidate.text) {
      return left.candidate.text.localeCompare(right.candidate.text);
    }
    return left.candidate.source.localeCompare(right.candidate.source);
  });
  return ranked.map((entry) => entry.candidate);
}

function selectEntry(candidates: Candidate[]): string {
  const ranked = rankCandidates(candidates);
  if (ranked.length > 0) return ranked[0].text;
  return truncateAtBoundary(FALLBACK_LINE, MAX_CHARS);
}

function ensureDirectory(directory: string): void {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

function writeTextAtomically(target: string, text: string): void {
  ensureDirectory(path.dirname(target));
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(temporary, text, { encoding: "utf8", mode: 0o644 });
    fs.renameSync(temporary, target);
  } catch (error) {
    try {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    } catch {
      void error;
    }
    fs.writeFileSync(target, text, { encoding: "utf8", mode: 0o644 });
  }
  const written = fs.readFileSync(target, "utf8");
  if (written !== text) {
    throw new Error(`entry verification failed at ${target}`);
  }
}

function attemptWrite(targets: string[], text: string): string | null {
  const failures: string[] = [];
  for (const target of targets) {
    try {
      writeTextAtomically(target, text);
      return target;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${target}: ${message}`);
    }
  }
  for (const failure of failures) {
    process.stderr.write(`write attempt failed: ${failure}\n`);
  }
  return null;
}

function outputTargets(): string[] {
  const targets = [PRIMARY_OUTPUT];
  if (path.resolve(PRIMARY_OUTPUT) !== path.resolve(LOCAL_OUTPUT)) {
    targets.push(LOCAL_OUTPUT);
  }
  return targets;
}

function validateSelection(text: string): string[] {
  const problems = gateProblems(text);
  for (const finding of prohibitedFindings(text)) {
    problems.push(finding);
  }
  return problems;
}

function runSelfChecks(): string[] {
  const failures: string[] = [];
  const prepared = prepareCandidates(RAW_CANDIDATES);
  if (prepared.length < 10) {
    failures.push("corpus: too few valid distinct candidates");
  }
  for (const candidate of prepared) {
    if (!isGateValid(candidate.text)) {
      failures.push(`gate: candidate is invalid (${candidate.source})`);
    }
    if (prohibitedFindings(candidate.text).length > 0) {
      failures.push(`content: candidate is prohibited (${candidate.source})`);
    }
  }
  const longLine = "word ".repeat(80).trim();
  const shortened = truncateAtBoundary(longLine, MAX_CHARS);
  if (charLength(shortened) > MAX_CHARS) {
    failures.push("truncate: result exceeds the character limit");
  }
  if (normalizeLine("  hello\n\tworld  ") !== "hello world") {
    failures.push("normalize: whitespace collapse failed");
  }
  const once = normalizeLine("  hello\n\tworld  ");
  if (normalizeLine(once) !== once) {
    failures.push("normalize: operation is not idempotent");
  }
  if (charLength("a😀b") !== 3) {
    failures.push("charLength: unicode code points miscounted");
  }
  if (!isGateValid("A valid line.")) {
    failures.push("gate: rejected a valid sample");
  }
  const invalidSamples = ["", "   ", "a\nb", "x".repeat(MAX_CHARS + 1)];
  for (const sample of invalidSamples) {
    if (isGateValid(sample)) {
      failures.push("gate: accepted an invalid sample");
    }
  }
  const ranked = rankCandidates(prepared);
  if (ranked.length !== prepared.length) {
    failures.push("rank: candidates were dropped while ranking");
  }
  const probe = "I lost the bounty because the other agent was funnier.";
  if (scoreCandidate(probe) !== scoreCandidate(probe)) {
    failures.push("score: scoring is not deterministic");
  }
  if (prohibitedFindings("https://example.invalid/secret").length === 0) {
    failures.push("content: URL detector missed a sample");
  }
  if (prohibitedFindings("a perfectly ordinary excuse").length !== 0) {
    failures.push("content: URL detector produced a false positive");
  }
  return failures;
}

function printUsage(): void {
  process.stderr.write(
    [
      "usage: node main.ts [--self-test] [--list]",
      "  --self-test  run internal validation before writing the entry",
      "  --list       print each ranked candidate and its score",
    ].join("\n") + "\n",
  );
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    return;
  }
  if (args.includes("--self-test")) {
    const failures = runSelfChecks();
    if (failures.length > 0) {
      for (const failure of failures) {
        process.stderr.write(`self-test failed: ${failure}\n`);
      }
      process.exitCode = 1;
      return;
    }
    process.stderr.write("self-test passed\n");
  }
  const candidates = prepareCandidates(RAW_CANDIDATES);
  if (args.includes("--list")) {
    for (const candidate of rankCandidates(candidates)) {
      const score = scoreCandidate(candidate.text);
      process.stderr.write(`${score.toFixed(3)}\t${candidate.text}\n`);
    }
  }
  const selected = selectEntry(candidates);
  const problems = validateSelection(selected);
  if (problems.length > 0) {
    process.stderr.write(`gate check failed: ${problems.join(", ")}\n`);
    process.exitCode = 1;
    return;
  }
  const writtenTo = attemptWrite(outputTargets(), selected);
  if (!writtenTo) {
    process.stderr.write("could not write the entry text\n");
    process.exitCode = 1;
    return;
  }
  process.stderr.write(
    `entry written to ${writtenTo} (${charLength(selected)} chars, ${Buffer.byteLength(selected, "utf8")} bytes)\n`,
  );
}

main();
