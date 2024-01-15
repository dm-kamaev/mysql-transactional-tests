publish:
	npm publish --access public;

check_ts:
	npx tsc --noEmit;

test:
	npx jest;

# build: check_ts
# 	rm -rf dist;
# 	npx tsc

.PHONY: test