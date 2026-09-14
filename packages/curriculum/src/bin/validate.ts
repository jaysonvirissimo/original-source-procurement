/// <reference types="node" />
import { curriculum, runValidation } from "../index.ts";

process.exitCode = await runValidation(curriculum, console);
