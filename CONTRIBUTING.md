# Contributing

Thanks for wanting to help PlatJourney. This page is the short version: how a contribution starts, what it needs to pass and how a pull request is written. The details live in the docs it links to.

## Where to start

| You have | Start with |
|---|---|
| A bug you can reproduce | An issue from the [Bug report](https://github.com/renatoaug/platjourney/issues/new?template=bug_report.yml) template: what you did, what you expected and what happened |
| An idea or a new feature | An issue from the [Feature request](https://github.com/renatoaug/platjourney/issues/new?template=feature_request.yml) template, before writing code, so we agree on the shape first |
| A small, obvious fix (a typo, a doc, a one-line bug) | A pull request straight away |

Work on an issue someone else is already on only after asking in it.

## Running it

[`docs/design/03-setup.md`](docs/design/03-setup.md) sets up the app, the AI service and the database on your machine and describes every setting. [`docs/README.md`](docs/README.md) indexes the rest.

## Rules and checks

[`AGENTS.md`](AGENTS.md) has the code rules: where things go, file names, texts in both languages, the database's snake_case and the five usual front-end mistakes. Read it before the first change.

Before a pull request:

1. `bun run lint`, `bun run typecheck` and `bun run test:coverage` pass. The pre-push hook (turned on by `bun install`) runs all three.
2. A change to a screen also passes `bun run build` and `bun run ui:check`, and its component stories pass `bun run stories:check`.
3. A change to what is stored updates [`docs/design/04-database.md`](docs/design/04-database.md) in the same pull request.
4. A change to a prompt or to retrieval runs `bun run ai:eval` and compares the result ([`docs/design/08-evals.md`](docs/design/08-evals.md)). Evals call the real model and cost tokens.

## Pull requests

- One change per pull request, branched off `main`.
- The title follows [Conventional Commits](https://www.conventionalcommits.org) with a lowercase subject (`fix(notices): ...`, `feat(web): ...`). It becomes the release note: a `feat` bumps the minor version, anything else the patch.
- The body follows the template: **What?**, **Why?** and **Acceptance criteria**. An issue it solves goes on the first line of **What?** as `Closes #NN`.
- The acceptance criteria tick what you already ran and leave unticked what a person has to look at, naming the screen and the state. A change with nothing visible says so in one line.

## License

PlatJourney is under the [Functional Source License](LICENSE) (FSL-1.1-ALv2). By opening a pull request you agree that your contribution is licensed under it.
