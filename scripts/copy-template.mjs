// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { rm, cp } from "node:fs/promises";

await rm("template", { recursive: true, force: true });
await cp("src/template", "template", { recursive: true });
console.log("template/ synced from src/template/");
