import assert from "node:assert/strict";
import { test } from "node:test";
import { runNativeChild } from "./fixtures/native-child.js";

test("native child failures retain the fixture frame and error type without exposing stderr values", async () => {
	const secret = "fixture-private-value";
	await assert.rejects(
		runNativeChild(
			process.execPath,
			[
				"-e",
				`process.stderr.write(${JSON.stringify(
					'TITLE_NATIVE_PHASE {"phase":"native-run","provider":"gemini"}\n' +
						'TITLE_NATIVE_PHASE {"phase":"cleanup","provider":"gemini"}\n' +
						`  File "/private/${secret}/context-step.py", line 497, in main\nAssertionError: {"contextLimitHit":true,"inputBytes":149000,"private":"${secret}"}\n`,
				)}); process.exit(1)`,
			],
			{ timeout: 5000 },
		),
		(error: Error) => {
			assert.match(error.message, /"failureType":"AssertionError"/);
			assert.match(error.message, /"fixtureLine":497/);
			assert.match(error.message, /"lastWorkPhase":"native-run"/);
			assert.match(error.message, /"contextLimitHit":true/);
			assert.match(error.message, /"inputBytes":149000/);
			assert.ok(!error.message.includes(secret) && !error.message.includes("/private/"));
			return true;
		},
	);
});
