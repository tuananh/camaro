# Contributing to camaro

* [Issues](#issues)
* [Pull Requests](#pull-requests)
* [Setup development environmment](#setup-development-environment)

## Issues

* State version of node/camaro/OS.
* Include a minimal script which can reproduce the issue.

## Pull Requests

* Make sure all tests pass.
* If new feature(s) is included, write test(s) for them as well.
* Check the benchmark script to see if there's any performance regression.

## Setup development environment

It's easier to have Docker installed for development.

```sh
npm install

# for fetching c++ dependencies using napa
npm run install-deps

# use docker to build. if you don't have Docker installed, you can use build.sh script
npm run build

# tests
npm run test
```
