publish:
	npm publish --access public;

ci: check_ts
	cp test/mysql.config.ci.json test/mysql.config.json;
	make test;

check_ts:
	npx tsc --noEmit;

test:
	npx jest;

# build: check_ts
# 	rm -rf dist;
# 	npx tsc

.PHONY: test