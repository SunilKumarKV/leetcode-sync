/*
question: Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.
solutionLanguage: JavaScript
explanation: We use a hash map to store numbers we have already seen. For each number, we check whether the needed value already exists in the map.
approach: Hash Map
timeComplexity: O(n)
spaceComplexity: O(n)
*/

function twoSum(nums, target) {
  const map = new Map();

  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];

    if (map.has(need)) {
      return [map.get(need), i];
    }

    map.set(nums[i], i);
  }

  return [];
}
