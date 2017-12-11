#!/bin/sh

set -eu

rm -f CONTRIBUTORS
echo "# Contributors (see AUTHORS for copyright owners)" > CONTRIBUTORS
echo "" >> CONTRIBUTORS
git-contributors --markdown . | sort >> CONTRIBUTORS
