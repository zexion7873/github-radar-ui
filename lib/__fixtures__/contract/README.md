# The `/ask` contract, as radar-rag serves it

Verbatim copies of radar-rag's `src/test/resources/contract/`, which its `AskFlowIT`
records from the real controller (WireMock standing in for Anthropic) and compares
every `/ask` body against. `lib/contract.test.ts` feeds them to `isAskResponse` and
`readAskStream`, so this page's parser is tested on what the service actually sends.

Never edit these by hand. When radar-rag re-records (`mvn verify -Dcontract.write`
there), copy the new files here in the same PR that adapts the parser.

| File | What radar-rag served |
|---|---|
| `ask-answer.json` | `POST /ask` with `Accept: application/json`: an answer citing two rows |
| `ask-answer.sse` | The same answer streamed: `sources`, two `delta`s, `done` |
| `ask-refusal.sse` | A refusal after some text streamed: `sources`, `delta`, `error` 502 |
| `ask-unavailable.sse` | Anthropic overloaded after retry: `sources`, `error` 503 |
