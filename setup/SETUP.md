After running setup-new-project.sh:

## Add project to Travis

1. As user @holvonix-bot, visit: https://travis-ci.org/profile/holvonix-open and sync account.
2. Switch ON for new-ball
3. Visit the settings: https://travis-ci.org/holvonix-open/new-ball/settings
4. Switch ON for 'Build only if .travis.yml is present'
5. Add a cron job: master, daily, always run.

## Setup GitHub and NPM api keys

1. As user @holvonix-bot, generate this auth token for Greenkeeper at https://github.com/settings/tokens/new

* Scope: public_repo
* Name: new-ball-GH_TOKEN_TRAVIS
* Install: `travis encrypt GH_TOKEN=token --add`

2. As user @holvonix-bot, generate this auth token for Changelog generation at https://github.com/settings/tokens/new

* Scope: [none]
* Name: new-ball-GH_RO_TOKEN_TRAVIS
* Install: `travis encrypt GH_RO_TOKEN=token --add`

3. As user @holvonix-bot, generate or use an NPM api key:

* Install: `travis encrypt NPM_API_KEY=token --add`

## Setup Code Coverage and Analysis

All as user @holvonix-bot:

1. Codecov: https://codecov.io/gh/holvonix-open/+ - sync and enable the new repo.
2. Code Climate: https://codeclimate.com/github/repos/new - sync and enable the new repo. Then Settings -> Git repository -> install all hooks. Also add the badge to the README.md

## Push to GitHub

    git add . && git commit -m 'PROJECT SETUP FOR: new-ball

    Template generated from https://github.com/holvonix-open/newball/NEWBALLHEADREF

    ' && git push

## Setup Dependency Analyzers

All as user @holvonix-bot:

1. Greenkeeper: Visit https://account.greenkeeper.io/account/holvonix-open and merge in the PRs as applicable.
2. Dependabot: https://app.dependabot.com/accounts/holvonix-open/repos and merge in the PRs as applicable.
3. Snyk: https://snyk.io/org/holvonix-bot/sources/9a3e5d90-b782-468a-a042-9a2073736f0b/repos - sync and enable the new repo.
4. Codacy - https://www.codacy.com/app/holvonix-open and sync and enable, and add the badge too. Then enable all integrations at https://www.codacy.com/app/holvonix-open/new-ball/settings/integrations
