.PHONY: install build clean open

install:
	npm i @antora/cli@3.1 @antora/site-generator@3.1

build:
	npx antora --fetch site.yml

clean:
	rm -rf www .cache

open: build
	xdg-open www/index.html 2>/dev/null || open www/index.html
