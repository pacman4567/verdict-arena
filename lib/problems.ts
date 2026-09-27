import { z } from "zod";
export const problemSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9-]{1,40}$/),
  title: z.string().trim().min(3).max(100),
  statement: z.string().min(10).max(20000),
  inputFormat: z.string().max(5000),
  outputFormat: z.string().max(5000),
  tags: z.string().max(100),
  rating: z.number().int().min(0).max(4000),
  timeLimit: z.number().min(0.1).max(10),
  memoryLimit: z.number().int().min(32).max(512),
  checker: z.enum(["tokens", "exact", "float", "custom"]),
  tolerance: z.number().min(0).max(1),
  checkerSource: z.string().max(20000),
  published: z.boolean(),
  tests: z
    .array(
      z.object({
        input: z.string().max(20000),
        output: z.string().max(20000),
        sample: z.boolean(),
      }),
    )
    .min(1)
    .max(30),
});
export type Problem = z.infer<typeof problemSchema>;
export const seeds: Problem[] = [
  {
    id: "A",
    title: "Two Integers",
    statement:
      "Every journey starts with a small problem. Given two integers a and b, find their sum.",
    inputFormat: "One line contains two integers a and b (−10⁹ ≤ a, b ≤ 10⁹).",
    outputFormat: "Print a single integer: the sum of a and b.",
    tags: "implementation, math",
    rating: 800,
    timeLimit: 2,
    memoryLimit: 256,
    checker: "tokens",
    tolerance: 0.000001,
    checkerSource: "",
    published: true,
    tests: [
      { input: "3 5\n", output: "8\n", sample: true },
      { input: "-7 2\n", output: "-5\n", sample: true },
      {
        input: "1000000000 1000000000\n",
        output: "2000000000\n",
        sample: false,
      },
      { input: "0 0\n", output: "0\n", sample: false },
    ],
  },
  {
    id: "B",
    title: "Signal in the Noise",
    statement:
      "A transmission contains a lowercase string. Count how many times each of the vowels a, e, i, o, u occurs in total.",
    inputFormat:
      "A nonempty string s of at most 100,000 lowercase English letters.",
    outputFormat: "Print the total number of vowels.",
    tags: "strings, implementation",
    rating: 1000,
    timeLimit: 2,
    memoryLimit: 256,
    checker: "tokens",
    tolerance: 0.000001,
    checkerSource: "",
    published: true,
    tests: [
      { input: "competitive\n", output: "5\n", sample: true },
      { input: "xyz\n", output: "0\n", sample: false },
      { input: "aeiouaeiou\n", output: "10\n", sample: false },
    ],
  },
  {
    id: "C",
    title: "The Longest Streak",
    statement:
      "Given an array of integers, find the length of its longest contiguous strictly increasing segment.",
    inputFormat:
      "The first line contains n (1 ≤ n ≤ 100,000). The next line contains n integers, each between −10⁹ and 10⁹.",
    outputFormat: "Print the maximum segment length.",
    tags: "arrays, two pointers",
    rating: 1200,
    timeLimit: 2,
    memoryLimit: 256,
    checker: "tokens",
    tolerance: 0.000001,
    checkerSource: "",
    published: true,
    tests: [
      { input: "7\n1 2 3 1 2 3 4\n", output: "4\n", sample: true },
      { input: "1\n9\n", output: "1\n", sample: false },
      { input: "4\n4 3 2 1\n", output: "1\n", sample: false },
    ],
  },
  {
    id: "D",
    title: "Routes Through the City",
    statement:
      "Find the minimum number of roads needed to travel from city 1 to city n in an undirected graph. Each road connects two distinct cities.",
    inputFormat:
      "The first line contains n and m (2 ≤ n ≤ 100,000, 0 ≤ m ≤ 200,000). Each of the next m lines contains u and v, the endpoints of a road.",
    outputFormat:
      "Print the minimum number of roads, or −1 if city n cannot be reached.",
    tags: "graphs, bfs",
    rating: 1600,
    timeLimit: 2,
    memoryLimit: 256,
    checker: "tokens",
    tolerance: 0.000001,
    checkerSource: "",
    published: true,
    tests: [
      { input: "4 4\n1 2\n2 4\n1 3\n3 4\n", output: "2\n", sample: true },
      { input: "3 1\n1 2\n", output: "-1\n", sample: false },
      { input: "2 1\n1 2\n", output: "1\n", sample: false },
    ],
  },
];
export function visibleProblem(p: Problem) {
  return { ...p, checkerSource: "", tests: p.tests.filter((t) => t.sample) };
}
