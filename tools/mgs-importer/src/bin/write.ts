/// <reference types="node" />
import { format, resolveConfig } from "prettier";
import { runWriteCommand } from "../cli.ts";

process.exitCode = await runWriteCommand(
  async (contents, path) =>
    format(contents, { ...(await resolveConfig(path)), filepath: path }),
  console,
);
