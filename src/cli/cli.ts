#!/usr/bin/env node
import "source-map-support/register";
import { getPackageJson } from "../util/packageInfo";
import { BUIDLER_PARAM_DEFINITIONS } from "../core/params/buidler-params";
import { getConfig } from "../core/config";
import { getTaskDefinitions } from "../core/tasks/dsl";
import { isCwdInsideProject } from "../core/project-structure";
import { enableEmoji } from "./emoji";
import { createProject } from "./project-creation";
import { BuidlerError, ERRORS } from "../core/errors";
import { ArgumentsParser } from "./ArgumentsParser";
import { getEnvBuidlerArguments } from "../core/params/env-variables";
import { BuidlerRuntimeEnvironment } from "../core/runtime-environment";

async function printVersionMessage() {
  const packageJson = await getPackageJson();
  console.log(packageJson.version);
}

async function main() {
  // We first accept this argument anywhere, so we know if the user wants
  // stack traces before really parsing the arguments.
  let showStackTraces = process.argv.includes("--show-stack-traces");

  try {
    const envVariableArguments = getEnvBuidlerArguments(
      BUIDLER_PARAM_DEFINITIONS
    );

    const argumentsParser = new ArgumentsParser();

    const {
      buidlerArguments,
      taskName: parsedTaskName,
      unparsedCLAs
    } = argumentsParser.parseBuidlerArgumetns(
      BUIDLER_PARAM_DEFINITIONS,
      envVariableArguments,
      process.argv.slice(2)
    );

    if (buidlerArguments.emoji) {
      enableEmoji();
    }

    showStackTraces = buidlerArguments.showStackTraces;

    if (!isCwdInsideProject() && process.stdout.isTTY) {
      await createProject();
      return;
    }

    // --version is a special case
    if (buidlerArguments.version) {
      await printVersionMessage();
      return;
    }

    const config = getConfig();
    const taskDefintions = getTaskDefinitions();

    const taskName = parsedTaskName !== undefined ? parsedTaskName : "help";
    const taskDefinition = taskDefintions[taskName];

    if (taskDefinition === undefined) {
      throw new BuidlerError(
        ERRORS.ARGUMENT_PARSER_UNRECOGNIZED_TASK,
        taskName
      );
    }

    const taskArguments = argumentsParser.parseTaskArguments(
      taskDefinition,
      unparsedCLAs
    );

    const env = new BuidlerRuntimeEnvironment(
      config,
      buidlerArguments,
      taskDefintions
    );

    // --help is a also special case
    if (buidlerArguments.help && taskName !== "help") {
      await env.run("help", { task: taskName });
      return;
    }

    await env.run(taskName, taskArguments);
  } catch (error) {
    const isBuidlerError = error instanceof BuidlerError;

    const { default: chalk } = await import("chalk");

    if (isBuidlerError) {
      console.error(chalk.red("Error " + error.message));
    } else {
      console.error(
        chalk.red("An unexpected error occurred: " + error.message)
      );
    }

    console.log("");

    if (showStackTraces) {
      console.error(error.stack);
    } else {
      if (!isBuidlerError) {
        console.error(
          "This shouldn't have happened, please report it to help us improve buidler."
        );
      }

      console.error(
        "For more info run buidler again with --show-stack-traces."
      );
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
