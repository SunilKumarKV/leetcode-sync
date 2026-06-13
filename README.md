# leetcode-sync

`leetcode-sync` is a production-ready Node.js service that syncs public LeetCode profile data into versioned JSON files. The generated files are designed to be consumed directly by the SunilCraft portfolio page at `/problems/leetcode`.

This project syncs:

- LeetCode solved stats
- Recently accepted LeetCode questions
- Problem title
- Difficulty
- LeetCode problem URL
- Platform
- Status
- Optional per-problem detail JSON backed by your real local solution files

This project does **not** fetch solution code from LeetCode and does **not** expose any session cookie. Solution code is only published when you add a real local solution file yourself.

## Project Structure

```text
.
├── data/
│   ├── leetcode-stats.json
│   ├── leetcode-problems.json
│   ├── metadata.json
│   ├── problems/
│   └── solutions/
│       └── README.md
├── scripts/
│   ├── build-problem-details.js
│   ├── leetcode.js
│   └── sync.js
├── .github/
│   └── workflows/
│       └── sync.yml
├── package.json
├── README.md
└── .gitignore
```

## What It Does

The sync process:

1. Reads `LEETCODE_USERNAME` from `process.env.LEETCODE_USERNAME`
2. Falls back to `Sunil-Kumar-K-V` for local runs only
3. Fetches public LeetCode profile stats from LeetCode GraphQL
4. Fetches recent accepted submissions using `recentAcSubmissionList`
5. Fetches question metadata for each recent accepted problem
6. Writes clean JSON output into the `data/` directory
7. Builds per-problem detail JSON only when a matching real solution file exists in `data/solutions/`

## No Mock Data Policy

- No mock data
- No dummy data
- No fake solved problems
- No LeetCode session cookie is stored or exposed
- Only real synced LeetCode metadata is used
- Solution code is only read from your committed local files

## Requirements

- Node.js 20
- npm

No database is required. No frontend is included.

## Local Setup

Install dependencies:

```bash
npm install
```

Run locally with your environment variable:

```bash
LEETCODE_USERNAME=Sunil-Kumar-K-V npm run sync
```

If `LEETCODE_USERNAME` is not set locally, the script falls back to:

```bash
Sunil-Kumar-K-V
```

## GitHub Secret Setup

Add this repository secret in GitHub:

- Name: `LEETCODE_USERNAME`
- Value: `Sunil-Kumar-K-V`

GitHub path:

1. Open the repository on GitHub
2. Go to `Settings`
3. Open `Secrets and variables` > `Actions`
4. Create a new repository secret named `LEETCODE_USERNAME`

## Manual Run

You can trigger the sync workflow manually:

1. Open the repository on GitHub
2. Go to `Actions`
3. Open the `Sync LeetCode Data` workflow
4. Click `Run workflow`

You can also run it locally:

```bash
npm run sync
```

## GitHub Actions Schedule

The workflow runs:

- Every 6 hours
- On manual trigger via `workflow_dispatch`

Workflow file:

- `.github/workflows/sync.yml`

## Generated Files

### `data/leetcode-stats.json`

```json
{
  "username": "Sunil-Kumar-K-V",
  "totalSolved": 7,
  "easySolved": 7,
  "mediumSolved": 0,
  "hardSolved": 0,
  "ranking": 5000001,
  "updatedAt": "2026-06-12T00:00:00.000Z"
}
```

### `data/leetcode-problems.json`

```json
{
  "username": "Sunil-Kumar-K-V",
  "count": 5,
  "problems": [
    {
      "title": "Two Sum",
      "slug": "two-sum",
      "difficulty": "Easy",
      "url": "https://leetcode.com/problems/two-sum/",
      "platform": "LeetCode",
      "status": "Solved",
      "solvedAt": "2026-06-12T00:00:00.000Z",
      "detailUrl": "https://raw.githubusercontent.com/SunilKumarKV/leetcode-sync/main/data/problems/two-sum.json"
    }
  ],
  "updatedAt": "2026-06-12T00:00:00.000Z"
}
```

### `data/metadata.json`

```json
{
  "source": "LeetCode",
  "username": "Sunil-Kumar-K-V",
  "generatedAt": "2026-06-12T00:00:00.000Z",
  "portfolioUsage": {
    "statsUrl": "https://raw.githubusercontent.com/SunilKumarKV/leetcode-sync/main/data/leetcode-stats.json",
    "problemsUrl": "https://raw.githubusercontent.com/SunilKumarKV/leetcode-sync/main/data/leetcode-problems.json"
  }
}
```

## Portfolio Fetch URLs

Use these URLs in the portfolio:

- `https://raw.githubusercontent.com/SunilKumarKV/leetcode-sync/main/data/leetcode-stats.json`
- `https://raw.githubusercontent.com/SunilKumarKV/leetcode-sync/main/data/leetcode-problems.json`

SunilCraft can use each problem item's `detailUrl` to fetch a full solved problem detail page. When no real local solution file exists for a slug, `detailUrl` remains `null` and no detail JSON is generated.

## How To Add Real Solution Code

Add a real accepted solution file at:

- `data/solutions/{slug}.js`

The filename must match the LeetCode `slug` from `leetcode-problems.json`.

Each solution file must start with a block comment that contains your own metadata, followed by your real solution code. The build script reads that file and generates:

- `data/problems/{slug}.json`

See [data/solutions/README.md](/Users/sunilkumarkv/Desktop/Projects/leetcode-sync/data/solutions/README.md) for the required format.

Example generated detail file:

```json
{
  "title": "Two Sum",
  "slug": "two-sum",
  "difficulty": "Easy",
  "questionUrl": "https://leetcode.com/problems/two-sum/",
  "question": "Find two numbers whose sum equals the target and return their indices.",
  "solutionLanguage": "JavaScript",
  "solutionCode": "function twoSum(nums, target) { ... }",
  "explanation": "I scan once, store seen values in a map, and return as soon as I find the complement.",
  "approach": "Hash map",
  "timeComplexity": "O(n)",
  "spaceComplexity": "O(n)",
  "updatedAt": "2026-06-12T00:00:00.000Z"
}
```

## Error Handling

The sync script fails clearly when:

- The LeetCode username is invalid
- The LeetCode GraphQL request fails
- The LeetCode response is malformed
- A real solution file exists but is missing required metadata
- A real solution file exists but does not contain solution code

If recent submissions are empty, the script still generates valid JSON with an empty `problems` array.

## Scripts

Run the sync:

```bash
npm run sync
```

This command:

1. Syncs live LeetCode stats and recent accepted problems
2. Rebuilds `detailUrl` values in `data/leetcode-problems.json`
3. Generates `data/problems/{slug}.json` only for problems that have a real matching solution file

## Notes

- Uses native `fetch` from Node.js 20
- Uses ESM only
- Uses async/await only
- Avoids duplicate logic by separating GraphQL helpers from sync/output logic
- Never generates fake detail pages when a real solution file is missing
- Commits updated JSON files automatically from GitHub Actions
