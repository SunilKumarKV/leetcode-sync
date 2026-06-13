import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAW_BASE_URL =
  "https://raw.githubusercontent.com/SunilKumarKV/leetcode-sync/main/data/problems";
const SOLUTION_DIRECTORY_NAME = "solutions";
const PROBLEM_DIRECTORY_NAME = "problems";
const SOLUTION_INDEX_FILE_NAME = "index.json";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDirectory = path.resolve(__dirname, "..");
const dataDirectory = path.join(rootDirectory, "data");
const problemsIndexPath = path.join(dataDirectory, "leetcode-problems.json");
const solutionsDirectory = path.join(dataDirectory, SOLUTION_DIRECTORY_NAME);
const problemDetailsDirectory = path.join(dataDirectory, PROBLEM_DIRECTORY_NAME);
const solutionIndexPath = path.join(solutionsDirectory, SOLUTION_INDEX_FILE_NAME);

function createError(message, details) {
  const error = new Error(message);
  if (details) {
    error.details = details;
  }
  return error;
}

function getDetailUrl(slug) {
  return `${RAW_BASE_URL}/${slug}.json`;
}

function getSolutionPath(slug) {
  return path.join(solutionsDirectory, `${slug}.js`);
}

function getDetailPath(slug) {
  return path.join(problemDetailsDirectory, `${slug}.json`);
}

function toRelativeDataPath(filePath) {
  return path.relative(rootDirectory, filePath) || filePath;
}

async function loadProblemsIndex() {
  let content;

  try {
    content = await readFile(problemsIndexPath, "utf8");
  } catch (error) {
    throw createError(
      `Problem index not found at "${problemsIndexPath}". Run the sync step before building details.`,
      error
    );
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    throw createError(`Invalid JSON in "${problemsIndexPath}".`, error);
  }
}

async function loadSolutionIndex() {
  let content;

  try {
    content = await readFile(solutionIndexPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { solutions: [] };
    }

    throw createError(`Failed to read solution index "${solutionIndexPath}".`, error);
  }

  let parsed;

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw createError(`Invalid JSON in "${solutionIndexPath}".`, error);
  }

  const solutions = Array.isArray(parsed.solutions) ? parsed.solutions : [];

  return { solutions };
}

function normalizeProblemRecord(record) {
  return {
    title: record.title,
    slug: record.slug,
    difficulty: record.difficulty ?? null,
    url: record.url,
    platform: record.platform ?? "LeetCode",
    status: record.status ?? "Solved",
    solvedAt: record.solvedAt ?? null
  };
}

function validateProblemRecord(record, sourceLabel) {
  if (!record || typeof record !== "object") {
    throw createError(`Invalid problem record in ${sourceLabel}.`);
  }

  for (const field of ["title", "slug", "url"]) {
    if (typeof record[field] !== "string" || !record[field].trim()) {
      throw createError(`Problem record in ${sourceLabel} is missing required field "${field}".`);
    }
  }
}

function mergeProblemSources(syncedProblems, indexedSolutions) {
  const mergedProblems = new Map();

  for (const problem of syncedProblems) {
    validateProblemRecord(problem, "data/leetcode-problems.json");
    mergedProblems.set(problem.slug, normalizeProblemRecord(problem));
  }

  for (const solution of indexedSolutions) {
    validateProblemRecord(solution, "data/solutions/index.json");

    const existing = mergedProblems.get(solution.slug);
    const normalized = normalizeProblemRecord(solution);

    if (!existing) {
      mergedProblems.set(solution.slug, normalized);
      continue;
    }

    mergedProblems.set(solution.slug, {
      ...normalized,
      ...existing,
      title: existing.title || normalized.title,
      difficulty: existing.difficulty ?? normalized.difficulty,
      url: existing.url || normalized.url,
      platform: existing.platform || normalized.platform,
      status: existing.status || normalized.status,
      solvedAt: existing.solvedAt ?? normalized.solvedAt
    });
  }

  return [...mergedProblems.values()].sort((left, right) => {
    const leftTime = left.solvedAt ? Date.parse(left.solvedAt) : Number.NEGATIVE_INFINITY;
    const rightTime = right.solvedAt ? Date.parse(right.solvedAt) : Number.NEGATIVE_INFINITY;

    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    return left.slug.localeCompare(right.slug);
  });
}

function parseHeaderBlock(source, slug) {
  const match = source.match(/^\/\*\s*([\s\S]*?)\s*\*\//);

  if (!match) {
    throw createError(`Solution file ${slug}.js is missing metadata header.`);
  }

  const metadata = {};
  const lines = match[1]
    .split("\n")
    .map((line) => line.replace(/^\s*\*?\s?/, "").trim())
    .filter(Boolean);

  for (const line of lines) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key && value) {
      metadata[key] = value;
    }
  }

  return metadata;
}

function stripHeaderBlock(source) {
  return source.replace(/^\/\*\s*[\s\S]*?\s*\*\/\s*/, "").trim();
}

function requireMetadataField(metadata, fieldName, slug) {
  const value = metadata[fieldName];

  if (!value) {
    throw createError(
      `Solution file "${slug}.js" is missing required metadata field "${fieldName}".`
    );
  }

  return value;
}

function buildDetailJson(problem, metadata, solutionCode) {
  const now = new Date().toISOString();

  return {
    title: problem.title,
    slug: problem.slug,
    difficulty: problem.difficulty,
    questionUrl: problem.url,
    question: metadata.question,
    solutionLanguage: metadata.solutionLanguage,
    solutionCode,
    explanation: metadata.explanation,
    approach: metadata.approach,
    timeComplexity: metadata.timeComplexity,
    spaceComplexity: metadata.spaceComplexity,
    updatedAt: now
  };
}

async function loadSolutionDetail(problem) {
  const solutionPath = getSolutionPath(problem.slug);
  let source;

  try {
    source = await readFile(solutionPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }

    throw createError(`Failed to read solution file "${solutionPath}".`, error);
  }

  const metadata = parseHeaderBlock(source, problem.slug);
  const solutionCode = stripHeaderBlock(source);

  if (!solutionCode) {
    throw createError(`Solution file "${problem.slug}.js" does not contain solution code.`);
  }

  const normalizedMetadata = {
    question: requireMetadataField(metadata, "question", problem.slug),
    solutionLanguage: requireMetadataField(metadata, "solutionLanguage", problem.slug),
    explanation: requireMetadataField(metadata, "explanation", problem.slug),
    approach: requireMetadataField(metadata, "approach", problem.slug),
    timeComplexity: requireMetadataField(metadata, "timeComplexity", problem.slug),
    spaceComplexity: requireMetadataField(metadata, "spaceComplexity", problem.slug)
  };

  return buildDetailJson(problem, normalizedMetadata, solutionCode);
}

async function listSolutionSlugs() {
  await mkdir(solutionsDirectory, { recursive: true });

  const entries = await readdir(solutionsDirectory, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && path.extname(entry.name) === ".js")
    .map((entry) => ({
      slug: path.basename(entry.name, ".js"),
      fileName: entry.name,
      filePath: path.join(solutionsDirectory, entry.name)
    }))
    .sort((left, right) => left.slug.localeCompare(right.slug));
}

function logProblemCheck(problem, solutionPath, exists) {
  console.log(`[details] Slug: ${problem.slug}`);
  console.log(`[details] Expected: ${toRelativeDataPath(solutionPath)}`);
  console.log(`[details] Exists: ${exists}`);
}

function logGenerated(detailPath) {
  console.log("[details] Generated:");
  console.log(`[details] ${toRelativeDataPath(detailPath)}`);
}

function logSkipped(slug, reason) {
  console.log("[details] Skipped:");
  console.log(`[details] ${slug}`);
  console.log("[details] Reason:");
  console.log(`[details] ${reason}`);
}

async function writeJsonFile(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`[details] Wrote ${filePath}`);
}

async function removeStaleDetailFiles(activeSlugs) {
  await mkdir(problemDetailsDirectory, { recursive: true });

  const existingFiles = await readdir(problemDetailsDirectory, { withFileTypes: true });

  await Promise.all(
    existingFiles.map(async (entry) => {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        return;
      }

      const slug = entry.name.slice(0, -".json".length);
      if (activeSlugs.has(slug)) {
        return;
      }

      const filePath = path.join(problemDetailsDirectory, entry.name);
      await rm(filePath);
      console.log(`[details] Removed stale detail file ${filePath}`);
    })
  );
}

async function buildProblemDetails() {
  const problemsIndex = await loadProblemsIndex();
  const syncedProblems = Array.isArray(problemsIndex.problems) ? problemsIndex.problems : [];
  const solutionIndex = await loadSolutionIndex();
  const problems = mergeProblemSources(syncedProblems, solutionIndex.solutions);
  const solutionFiles = await listSolutionSlugs();
  const syncedProblemSlugs = new Set(problems.map((problem) => problem.slug));

  console.log(
    `[details] Building problem details for ${problems.length} merged problem(s) (${syncedProblems.length} synced, ${solutionIndex.solutions.length} indexed)...`
  );

  await mkdir(problemDetailsDirectory, { recursive: true });

  const activeDetailSlugs = new Set();

  const updatedProblems = await Promise.all(
    problems.map(async (problem) => {
      const solutionPath = getSolutionPath(problem.slug);
      const hasSolutionFile = solutionFiles.some((item) => item.slug === problem.slug);

      logProblemCheck(problem, solutionPath, hasSolutionFile);

      if (!hasSolutionFile) {
        logSkipped(problem.slug, "solution file not found");

        return {
          ...problem,
          detailUrl: null
        };
      }

      const detail = await loadSolutionDetail(problem);

      if (!detail) {
        logSkipped(problem.slug, "solution file not found");

        return {
          ...problem,
          detailUrl: null
        };
      }

      const detailPath = getDetailPath(problem.slug);
      await writeJsonFile(detailPath, detail);
      activeDetailSlugs.add(problem.slug);
      logGenerated(detailPath);

      return {
        ...problem,
        detailUrl: getDetailUrl(problem.slug)
      };
    })
  );

  for (const solutionFile of solutionFiles) {
    if (syncedProblemSlugs.has(solutionFile.slug)) {
      continue;
    }

    logSkipped(
      solutionFile.slug,
      "Orphaned solution file found. Add it to data/solutions/index.json"
    );
  }

  await removeStaleDetailFiles(activeDetailSlugs);

  await writeJsonFile(problemsIndexPath, {
    ...problemsIndex,
    count: updatedProblems.length,
    problems: updatedProblems,
    updatedAt: new Date().toISOString()
  });

  console.log(
    `[details] Problem detail build completed. Generated ${activeDetailSlugs.size} detail file(s).`
  );
}

buildProblemDetails().catch((error) => {
  console.error("[details] Build failed.");
  console.error(error instanceof Error ? error.message : error);

  if (error instanceof Error && error.details) {
    console.error(error.details);
  }

  process.exitCode = 1;
});
