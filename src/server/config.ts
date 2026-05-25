import { Command } from "commander";
import { resolve } from "node:path";

export type ServerConfig = {
  videoRoot: string;
  outputRoot: string;
  layoutRoot: string;
  settingsPath: string;
  host: string;
  port: number;
};

export const parseServerConfig = (argv: string[]): ServerConfig => {
  const program = new Command();

  program
    .name("track-retro-markers-server")
    .description("Web server for browsing videos and running retro marker tracking jobs.")
    .option("--video-root <path>", "folder containing input videos", "inputs")
    .option("--output-root <path>", "folder for generated outputs", "outputs")
    .option("--layout-root <path>", "folder for marker layout JSON files", ".")
    .option("--settings-path <path>", "local JSON file for persisted UI settings", ".track-retro-markers-ui-settings.json")
    .option("--host <address>", "server bind address", "127.0.0.1")
    .option("--port <number>", "server port", (value) => Number(value), 3000);

  program.parse(argv, { from: "user" });

  const options = program.opts<{
    videoRoot: string;
    outputRoot: string;
    layoutRoot: string;
    settingsPath: string;
    host: string;
    port: number;
  }>();

  if (!Number.isInteger(options.port) || options.port <= 0 || options.port > 65535) {
    throw new Error("Expected --port to be an integer from 1 to 65535.");
  }

  return {
    videoRoot: resolve(options.videoRoot),
    outputRoot: resolve(options.outputRoot),
    layoutRoot: resolve(options.layoutRoot),
    settingsPath: resolve(options.settingsPath),
    host: options.host,
    port: options.port
  };
};
