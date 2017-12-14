# pullmaster

[![Codacy Badge](https://api.codacy.com/project/badge/Grade/316fc378652343d6bffdb44758c208f0)](https://www.codacy.com/app/holvonix-open/pullmaster?utm_source=github.com&utm_medium=referral&utm_content=holvonix-open/pullmaster&utm_campaign=badger)
[![Build Status](https://travis-ci.org/holvonix-open/pullmaster.svg?branch=master)](https://travis-ci.org/holvonix-open/pullmaster)
[![npm version](https://badge.fury.io/js/pullmaster.svg)](https://badge.fury.io/js/pullmaster)
[![Greenkeeper badge](https://badges.greenkeeper.io/holvonix-open/pullmaster.svg)](https://greenkeeper.io/)
[![codecov](https://codecov.io/gh/holvonix-open/pullmaster/branch/master/graph/badge.svg)](https://codecov.io/gh/holvonix-open/pullmaster)

Master your pulls 🏋

[![NPM](https://nodei.co/npm/pullmaster.png?compact=true)](https://nodei.co/npm/pullmaster/)

## Usage

This is very much alpha - not at all hardened. Use at your own risk.

We eat our own dogfood! The holvonix-open GitHub org uses pullmaster via
@holvonix-bot, and you'll see it in action on our issues and PRs.

**Features:**

* On creation of a pull request, a reviewer with the least code review load will
  be chosen.
* A repository admin can comment on the PR or submit a review to issue a command to the bot:
  * `#shipitnow` - requests an immediate merge, ignoring CI and approval status
  * `#shipit` - requests a merge when CI and approval goes green

When we hit release v1.0.0, we will try to fix our API and use semver to note
changes. Until v1.0.0 (anything below 1.0, and also any 1.0 prereleases), we
will change functionality arbitrarily.

## Installation

TODO: Fill-in with real repo instructions. :stuck_out_tongue:

## Notice and License

```
# pullmaster

Copyright (c) 2017 Holvonix LLC and the pullmaster AUTHORS

Original Repository: https://github.com/holvonix-open/pullmaster

Portions from github-auto-assign-reviewers-cloud-functions:
  Copyright 2017, Google Cloud Platform Community Authors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

Third-party dependencies may have their own licenses.
```
