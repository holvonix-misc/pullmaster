After running setup-new-project.sh:

## Add project to Travis

1. As user @holvonix-bot, visit: https://travis-ci.org/profile/holvonix-open and sync account.
2. Switch ON for new-ball
3. Visit the settings: https://travis-ci.org/holvonix-open/new-ball/settings
4. Switch ON for 'Build only if .travis.yml is present'
5. Add a cron job: master, daily, always run.

## Setup Travis to publish to NPMJS.com as holvonix-bot

1. Get the holvonix-bot NPM auth token
2. `travis setup npm -f`, and it should look like:


```sh
$ travis setup npm -f
NPM email address: github-external-bot@holvonix.com
NPM api key: ************************************
release only tagged commits? |yes|
Release only from holvonix-open/new-ball? |yes|
Encrypt API key? |yes|
```

3. Manually edit .travis.yml deploy section to look like:


```yaml
deploy:
  provider: npm
  email: github-external-bot@holvonix.com
  skip_cleanup: true
  api_key:
    secure: NNN_NPM_API_KEY
  on:
    node: node
    tags: true
    branch: master
    repo: holvonix-open/new-ball
```

## Setup GitHub api keys

1. As user @holvonix-bot, generate this auth token for Greenkeeper at https://github.com/settings/tokens/new

* Scope: public_repo
* Name: new-ball-GH_TOKEN_TRAVIS
* Install: `travis encrypt GH_TOKEN=token --add`

2. As user @holvonix-bot, generate this auth token for Changelog generation at https://github.com/settings/tokens/new

* Scope: [none]
* Name: new-ball-GH_RO_TOKEN_TRAVIS
* Install: `travis encrypt GH_RO_TOKEN=token --add`

## Push to GitHub

`rm -rf setup && git add . && git commit -m 'Project setup' && git push`

## Setup Greenkeeper

1. Visit https://account.greenkeeper.io/account/holvonix-open as @holvonix-bot
2. Merge in the Greenkeeper PRs as applicable.
