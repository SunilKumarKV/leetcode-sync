const LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql";

const USER_PROFILE_QUERY = `
  query userProfile($username: String!) {
    matchedUser(username: $username) {
      username
      profile {
        ranking
      }
      submitStatsGlobal {
        acSubmissionNum {
          difficulty
          count
        }
      }
    }
    recentAcSubmissionList(username: $username, limit: 20) {
      title
      titleSlug
      timestamp
    }
  }
`;

const QUESTION_DETAILS_QUERY = `
  query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      questionId
      title
      titleSlug
      difficulty
    }
  }
`;

function createError(message, details) {
  const error = new Error(message);
  if (details) {
    error.details = details;
  }
  return error;
}

async function graphqlRequest(query, variables) {
  let response;

  try {
    response = await fetch(LEETCODE_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        referer: "https://leetcode.com",
        origin: "https://leetcode.com"
      },
      body: JSON.stringify({ query, variables })
    });
  } catch (error) {
    throw createError("LeetCode GraphQL request failed: network error.", error);
  }

  if (!response.ok) {
    throw createError(
      `LeetCode GraphQL request failed: HTTP ${response.status} ${response.statusText}.`
    );
  }

  let payload;

  try {
    payload = await response.json();
  } catch (error) {
    throw createError("LeetCode GraphQL request failed: invalid JSON response.", error);
  }

  if (payload.errors?.length) {
    const details = payload.errors.map((item) => item.message).join("; ");
    throw createError(`LeetCode GraphQL request failed: ${details}`);
  }

  return payload.data;
}

function getSolvedCount(stats, difficulty) {
  return stats.find((item) => item.difficulty === difficulty)?.count ?? 0;
}

function timestampToIsoDate(timestamp) {
  if (!timestamp) {
    return null;
  }

  const numericTimestamp = Number(timestamp);
  if (!Number.isFinite(numericTimestamp) || numericTimestamp <= 0) {
    return null;
  }

  return new Date(numericTimestamp * 1000).toISOString();
}

function normalizeRecentSubmissions(submissions) {
  const uniqueProblems = new Map();

  for (const submission of submissions ?? []) {
    if (!submission?.titleSlug || uniqueProblems.has(submission.titleSlug)) {
      continue;
    }

    uniqueProblems.set(submission.titleSlug, {
      title: submission.title ?? submission.titleSlug,
      slug: submission.titleSlug,
      solvedAt: timestampToIsoDate(submission.timestamp)
    });
  }

  return [...uniqueProblems.values()];
}

export async function fetchUserProfile(username) {
  let data;

  try {
    data = await graphqlRequest(USER_PROFILE_QUERY, { username });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("that user does not exist")
    ) {
      throw createError(`Invalid LeetCode username: "${username}". User not found.`);
    }

    throw error;
  }

  const matchedUser = data?.matchedUser;

  if (!matchedUser?.username) {
    throw createError(`Invalid LeetCode username: "${username}". User not found.`);
  }

  const stats = matchedUser.submitStatsGlobal?.acSubmissionNum ?? [];

  return {
    username: matchedUser.username,
    ranking: matchedUser.profile?.ranking ?? null,
    totalSolved: getSolvedCount(stats, "All"),
    easySolved: getSolvedCount(stats, "Easy"),
    mediumSolved: getSolvedCount(stats, "Medium"),
    hardSolved: getSolvedCount(stats, "Hard"),
    recentAcceptedSubmissions: normalizeRecentSubmissions(data?.recentAcSubmissionList)
  };
}

export async function fetchQuestionDetails(titleSlug) {
  const data = await graphqlRequest(QUESTION_DETAILS_QUERY, { titleSlug });
  const question = data?.question;

  if (!question?.titleSlug) {
    throw createError(`Failed to load LeetCode problem details for slug "${titleSlug}".`);
  }

  return {
    questionId: question.questionId ?? null,
    title: question.title ?? titleSlug,
    slug: question.titleSlug,
    difficulty: question.difficulty ?? null
  };
}
