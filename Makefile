.PHONY: sync dev build preview test lint format format-check typecheck check clean update-skills

sync:
	npm install

dev:
	npm run dev

build:
	npm run build

preview:
	npm run preview

test:
	npm test

lint:
	npm run lint

format:
	npm run format

format-check:
	npm run format:check

typecheck:
	npm run typecheck

# Full local gate: everything CI runs.
check: format-check lint typecheck build test

clean:
	rm -rf dist node_modules

update-skills:
	git subtree pull --prefix .claude/skills https://github.com/nuncaeslupus/my-skills.git main --squash
