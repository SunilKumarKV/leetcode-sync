import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { fetchQuestionDetails, fetchUserProfile } from "./leetcode.js";

const DEFAULT_USERNAME = "Sunil-Kumar-K-V";
const PLATFORM_NAME = "LeetCode";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDirectory = path.resolve(__dirname, "..");
const dataDirectory = path.join(rootDirectory, "data");

function getUsername() {
  return process.env.LEETCODE_USERNAME?.trim() || DEFAULT_USERNAME;
}

function buildProblemUrl(slug) {
  return `https://leetcode.com/problems/${slug}/`;
}

async function ensureDataDirectory() {
  await mkdir(dataDirectory, { recursive: true });
}

async function writeJsonFile(fileName, data) {
  const filePath = path.join(dataDirectory, fileName);
  const content = `${JSON.stringify(data, null, 2)}\n`;
  await writeFile(filePath, content, "utf8");
  console.log(`[sync] Wrote ${filePath}`);
}

async function buildProblems(submissions) {
  if (!submissions.length) {
    console.log("[sync] No recent accepted submissions found. Writing empty problems array.");
    return [];
  }

  console.log(`[sync] Fetching details for ${submissions.length} recent accepted problems...`);

  const problems = await Promise.all(
    submissions.map(async (submission) => {
      const details = await fetchQuestionDetails(submission.slug);

      return {
        title: details.title || submission.title,
        slug: details.slug,
        difficulty: details.difficulty,
        url: buildProblemUrl(details.slug),
        platform: PLATFORM_NAME,
        status: "Solved",
        solvedAt: submission.solvedAt,
        detailUrl: null
      };
    })
  );

  return problems;
}

function buildStatsJson(profile, updatedAt) {
  return {
    username: profile.username,
    totalSolved: profile.totalSolved,
    easySolved: profile.easySolved,
    mediumSolved: profile.mediumSolved,
    hardSolved: profile.hardSolved,
    ranking: profile.ranking,
    updatedAt
  };
}

function buildProblemsJson(username, problems, updatedAt) {
  return {
    username,
    count: problems.length,
    problems,
    updatedAt
  };
}

function buildMetadataJson(username, generatedAt) {
  return {
    source: PLATFORM_NAME,
    username,
    generatedAt,
    portfolioUsage: {
      statsUrl:
        "https://raw.githubusercontent.com/SunilKumarKV/leetcode-sync/main/data/leetcode-stats.json",
      problemsUrl:
        "https://raw.githubusercontent.com/SunilKumarKV/leetcode-sync/main/data/leetcode-problems.json"
    }
  };
}

async function run() {
  const username = getUsername();
  const generatedAt = new Date().toISOString();

  console.log(`[sync] Starting LeetCode sync for "${username}"`);

  await ensureDataDirectory();

  console.log("[sync] Fetching LeetCode profile and recent accepted submissions...");
  const profile = await fetchUserProfile(username);

  console.log(
    `[sync] Found ${profile.totalSolved} solved problems and ${profile.recentAcceptedSubmissions.length} recent accepted entries.`
  );

  const problems = await buildProblems(profile.recentAcceptedSubmissions);

  await writeJsonFile("leetcode-stats.json", buildStatsJson(profile, generatedAt));
  await writeJsonFile("leetcode-problems.json", buildProblemsJson(profile.username, problems, generatedAt));
  await writeJsonFile("metadata.json", buildMetadataJson(profile.username, generatedAt));

  console.log("[sync] LeetCode sync completed successfully.");
}

run().catch((error) => {
  console.error("[sync] Sync failed.");
  console.error(error instanceof Error ? error.message : error);

  if (error instanceof Error && error.details) {
    console.error(error.details);
  }

  process.exitCode = 1;
});
