# Journeys and unguided walkthrough

## Journey to spec map

| Journey                   | Spec                                                      | What it proves                                                                                  |
| ------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| UJ-1 first use on a phone | `e2e/journeys.spec.ts` (360 px)                           | four creates, an empty line is refused with the validation message, newest first                |
| UJ-2 second device        | `e2e/journeys.spec.ts`                                    | second browser context sees the same list after tick, untick, delete and refresh                |
| UJ-3 API down             | `e2e/error-handling.spec.ts`                              | failed create keeps the text and focus, announces in the status region, succeeds after recovery |
| Complete and delete       | `e2e/complete.spec.ts`, `e2e/delete.spec.ts`              | tick, untick, delete, durable across reload                                                     |
| Empty and failed load     | `e2e/empty-state.spec.ts`, `e2e/load-failure.spec.ts`     | Empty State and Error State with Retry                                                          |
| Restart durability        | `e2e/stack.spec.ts` ("todos survive a container restart") | same list after `docker compose restart` (SM-2)                                                 |

The suite has 14 spec files and passes on Chromium through `npm run test:e2e`.

## Unguided walkthrough (SM-1): not yet performed

This needs a person who has not seen the app. It has not been done and nothing below is claimed.

**Protocol.** Start the stack (`docker compose up --build --wait`) and open `http://localhost:8080`.
Give the person no instructions beyond "use this to manage your todos". Do not prompt. Record:

| Item                                                                     | Result  |
| ------------------------------------------------------------------------ | ------- |
| Date, person (role only), device and browser                             | pending |
| Created a todo without prompting                                         | pending |
| Ticked and unticked a todo without prompting                             | pending |
| Deleted a todo without prompting                                         | pending |
| Number of prompts given                                                  | pending |
| Anything they asked about, or controls they said they did not understand | pending |
| Observations                                                             | pending |

Success is all four actions with zero prompts and no question about what a control does.
