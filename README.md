# new-ball

[![Build Status](https://travis-ci.org/holvonix-open/new-ball.svg?branch=master)](https://travis-ci.org/holvonix-open/new-ball)
[![npm version](https://badge.fury.io/js/new-ball.svg)](https://badge.fury.io/js/new-ball)
[![Greenkeeper badge](https://badges.greenkeeper.io/holvonix-open/new-ball.svg)](https://greenkeeper.io/)
[![Coverage Status](https://coveralls.io/repos/github/holvonix-open/new-ball/badge.svg?branch=master)](https://coveralls.io/github/holvonix-open/new-ball?branch=master)
[![codecov](https://codecov.io/gh/holvonix-open/new-ball/branch/master/graph/badge.svg)](https://codecov.io/gh/holvonix-open/new-ball)

Make a new ball o' yarn (a template for generating Holvonix yarn-based node packages)

[![NPM](https://nodei.co/npm/new-ball.png?compact=true)](https://nodei.co/npm/new-ball/)

## Installation

TODO: Fill-in with real repo instructions. :stuck_out_tongue:

## Usage

This template is probably not useful outside Holvonix LLC, given that it has our
copyright notices and our choices of license and other development environment
peculiarities 😃 - Regardless, none of this is legal advice, and you should
consult a legal professional to understand what kind of license you should use
for your project.

0. Minimum versions:

```
$ yarn -v
1.3.2
$ node -v
v8.9.3
$ npm -v
4.6.1
```

1. Make a repository at https://github.com/holvonix-open/$NEW_PROJECT_NAME without readme, gitignore, license, etc. Blank repo with no commits.

2. Shell execute:

```sh
NEW_PROJECT_NAME=the-name &&
git clone https://github.com/holvonix-open/new-ball --branch master --single-branch $NEW_PROJECT_NAME &&
cd $NEW_PROJECT_NAME &&
sh setup/setup-new-project.sh $NEW_PROJECT_NAME &&
cat setup/SETUP.md
```

3. Follow the instructions output by `setup-new-project.sh`

## Notice and License

```
# new-ball

Copyright (c) 2017 Holvonix LLC and the new-ball AUTHORS

Original Repository: https://github.com/holvonix-open/new-ball

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
