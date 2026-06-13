import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAW_BASE_URL =
  "https://raw.githubusercontent.com/SunilKumarKV/leetcode-sync/main/data/problems";
const SOLUTION_DIRECTORY_NAME = "solutions";
const PROBLEM_DIRECTORY_NAME = "problems";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDirectory = path.resolve(__dirname, "..");
const dataDirectory = path.join(rootDirectory, "data");
const problemsIndexPath = path.join(dataDirectory, "leetcode-problems.json");
const solutionsDirectory = path.join(dataDirectory, SOLUTION_DIRECTORY_NAME);
const problemDetailsDirectory = path.join(dataDirectory, PROBLEM_DIRECTORY_NAME);

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

function parseHeaderBlock(source, slug) {
  const match = source.match(/^\/\*\s*([\s\S]*?)\s*\*\//);

  if (!match) {
    throw createError(
      `Solution file "${slug}.js" is missing the required metadata header comment.`
    );
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
  const problems = Array.isArray(problemsIndex.problems) ? problemsIndex.problems : [];

  console.log(`[details] Building problem details for ${problems.length} synced problems...`);

  await mkdir(solutionsDirectory, { recursive: true });
  await mkdir(problemDetailsDirectory, { recursive: true });

  const activeDetailSlugs = new Set();

  const updatedProblems = await Promise.all(
    problems.map(async (problem) => {
      const detail = await loadSolutionDetail(problem);

      if (!detail) {
        return {
          ...problem,
          detailUrl: null
        };
      }

      const detailPath = getDetailPath(problem.slug);
      await writeJsonFile(detailPath, detail);
      activeDetailSlugs.add(problem.slug);

      return {
        ...problem,
        detailUrl: getDetailUrl(problem.slug)
      };
    })
  );

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
