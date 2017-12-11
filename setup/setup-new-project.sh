#!/bin/sh

set -euv

yarn -v
node -v
npm -v

NEW_PROJECT_NAME=$1
echo SETTING UP $NEW_PROJECT_NAME

git remote -v

git remote set-url origin https://github.com/holvonix-open/$NEW_PROJECT_NAME

git remote -v

git config --add commit.gpgsign true

rm -f yarn.lock

sed -i -- "s/new-ball/$NEW_PROJECT_NAME/g" `find . -maxdepth 1 -type f`
sed -i -- "s/new-ball/$NEW_PROJECT_NAME/g" `find scripts/* -maxdepth 1 -type f`
sed -i -- "s/new-ball/$NEW_PROJECT_NAME/g" `find src/* -maxdepth 1 -type f`
sed -i -- "s/new-ball/$NEW_PROJECT_NAME/g" setup/SETUP.md
REVHEAD=`git rev-parse HEAD`
sed -i -- "s/NEWBALLHEADREF/$REVHEAD/g" setup/SETUP.md
sed -i -- "s/newball/new-ball/g" setup/SETUP.md

# Silly sed files.
rm -f .*--
rm -f *--
rm -f */*--

yarn install

yarn upgrade-interactive --latest
yarn add husky --dev

echo setup/SETUP.md
