import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const SOURCE_COMMIT = "118e4bd6b14da6df0e36605d7169b65db18389a4";
const sourceRoot = path.resolve(process.argv[2] || process.env.EXERCISES_DATASET_DIR || "../exercises-dataset");
const targetRoot = path.resolve("public/exercises");

const source = JSON.parse(
  await readFile(path.join(sourceRoot, "data", "exercises.json"), "utf8"),
);

const catalog = source.map((exercise) => ({
  id: exercise.id,
  name: exercise.name,
  category: exercise.category,
  bodyPart: exercise.body_part,
  equipment: exercise.equipment,
  target: exercise.target,
  muscleGroup: exercise.muscle_group,
  secondaryMuscles: exercise.secondary_muscles || [],
  instructions: exercise.instruction_steps?.en?.length
    ? exercise.instruction_steps.en
    : [exercise.instructions?.en].filter(Boolean),
  image: exercise.image ? exercise.image.replace(/^images\//, "") : null,
  animationUrl: exercise.gif_url ? exercise.gif_url.replace(/^videos\//, "") : null,
  attribution: exercise.attribution || "© Gym visual — https://gymvisual.com/",
}));

await mkdir(targetRoot, { recursive: true });
await rm(path.join(targetRoot, "images"), { recursive: true, force: true });
await rm(path.join(targetRoot, "videos"), { recursive: true, force: true });
await cp(path.join(sourceRoot, "images"), path.join(targetRoot, "images"), { recursive: true });
await cp(path.join(sourceRoot, "videos"), path.join(targetRoot, "videos"), { recursive: true });
await cp(path.join(sourceRoot, "NOTICE.md"), path.join(targetRoot, "NOTICE.md"));
await cp(path.join(sourceRoot, "LICENSE"), path.join(targetRoot, "LICENSE"));
await writeFile(path.join(targetRoot, "catalog.v1.json"), JSON.stringify(catalog), "utf8");
await writeFile(
  path.join(targetRoot, "source.json"),
  JSON.stringify({
    repository: "https://github.com/hasaneyldrm/exercises-dataset",
    commit: SOURCE_COMMIT,
    exerciseCount: catalog.length,
    generatedAt: new Date().toISOString(),
  }, null, 2),
  "utf8",
);

console.log(`Synced ${catalog.length} exercises from ${sourceRoot}`);
