import { createQualificationGuard as createGuard } from "@shaleyeah/sdk";
import { readPrivateSourceConfig } from "./source-config.js";
export const createQualificationGuard = (file: string) => createGuard(file, readPrivateSourceConfig);
