# Solution Files

Add real accepted solution files here using this naming convention:

- `data/solutions/{slug}.js`
- `data/solutions/index.json`

Example:

- `data/solutions/two-sum.js`
- `data/solutions/index.json`

Every older solved problem that is not present in `recentAcSubmissionList` must also be added to `data/solutions/index.json`.

Each file must contain:

1. A top-of-file block comment with your own metadata
2. Your real solution code below the comment

Required metadata fields:

- `question`
- `solutionLanguage`
- `explanation`
- `approach`
- `timeComplexity`
- `spaceComplexity`

Example format:

```js
/*
question: Find two numbers whose sum equals the target and return their indices.
solutionLanguage: JavaScript
explanation: I scan once, store seen values in a map, and return as soon as I find the complement.
approach: Hash map
timeComplexity: O(n)
spaceComplexity: O(n)
*/

function twoSum(nums, target) {
  const seen = new Map();

  for (let index = 0; index < nums.length; index += 1) {
    const complement = target - nums[index];

    if (seen.has(complement)) {
      return [seen.get(complement), index];
    }

    seen.set(nums[index], index);
  }

  return [];
}
```

Rules:

- Do not add mock or dummy content
- Only commit real solution code you want exposed publicly
- The summary and explanation must be written by you, not copied from LeetCode
- If a solution file does not exist, no problem detail JSON will be generated
- If a solution file exists but the slug is missing from both `data/leetcode-problems.json` and `data/solutions/index.json`, it is treated as orphaned
