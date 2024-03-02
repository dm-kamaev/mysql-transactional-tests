publish: test_coverage build
	npm publish --access public;

test_coverage:
	npx jest --coverage

test_badge: test_coverage
	npx jest-coverage-badges

ci: lint check_ts
	mv test/mysql.config.ci.json test/mysql.config.json;
	make test_coverage;
	make build;

lint:
	npx eslint src/ test/;

lint_fix:
	npx eslint --fix src/ test/;

check_ts:
	npx tsc --noEmit;

test:
	npx jest;

build: lint
	rm -rf dist;
	npx tsc
	rm -rf dist/test dist/example;
	mv dist/src/* dist;
	rm -rf dist/src;

.PHONY: test