#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p scripts/.cache/ngsl scripts/.cache/tatoeba
for name in NGSL_12_stats.csv NGSL_12_lemmatized_for_teaching.csv NGSL-Spoken_12_stats.csv NGSL-Spoken_12_lemmatized_for_teaching.csv; do
  curl --fail --location --retry 2 "https://www.newgeneralservicelist.com/s/$name" --output "scripts/.cache/ngsl/$name"
done
curl --fail --location --retry 2 https://www.manythings.org/anki/rus-eng.zip --output scripts/.cache/tatoeba/rus-eng.zip
unzip -o scripts/.cache/tatoeba/rus-eng.zip -d scripts/.cache/tatoeba

curl --fail --location --retry 2 https://raw.githubusercontent.com/open-dict-data/ipa-dict/master/data/en_US.txt --output scripts/.cache/ipa-en_US.txt
