publish: test_coverage build
	npm publish --access public;

test_coverage:
	npx jest --coverage

test_badge: test_coverage
	npx jest-coverage-badges

ci: check_ts
	mv test/mysql.config.ci.json test/mysql.config.json;
	make test_coverage;
	make build;

check_ts:
	npx tsc --noEmit;

test:
	npx jest;

build:
	rm -rf dist;
	npx tsc
	rm -rf dist/test dist/example;

.PHONY: test