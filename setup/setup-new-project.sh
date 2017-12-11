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

sed -i -- "s/new-ball/$NEW_PROJECT_NAME/g" *
sed -i -- "s/new-ball/$NEW_PROJECT_NAME/g" scripts/*
sed -i -- "s/new-ball/$NEW_PROJECT_NAME/g" src/*
sed -i -- "s/new-ball/$NEW_PROJECT_NAME/g" setup/SETUP.md

yarn install

yarn upgrade-interactive --latest
yarn add husky --dev

echo setup/SETUP.md
