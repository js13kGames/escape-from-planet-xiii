#! /usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
from pathlib import Path

import requests

categories = ["desktop", "mobile", "webxr", "server", "webmonetization"]

parser = argparse.ArgumentParser(allow_abbrev=False)
parser.add_argument("bundle.zip", type=Path)
parser.add_argument("--category", action="append", type=str, choices=categories)	# Default value assigned after parsing.
parser.add_argument("--endpoint", default="https://iw8sii1h9b.execute-api.eu-west-1.amazonaws.com/stage/analyze-bundle", type=str, help="js13kGames bot endpoint", metavar="URL")
parser.add_argument("--json", action="store_true", help="full JSON output instead of summary")
args = parser.parse_args()
if not args.category: args.category = ["desktop"]

with open(getattr(args, "bundle.zip"), "rb") as bundle_file:
	r = requests.post(
		args.endpoint,
		files={"bundle": (getattr(args, "bundle.zip").name, bundle_file, "application/zip")},
		data=list(zip(["category"] * len(args.category), args.category)),
	)
r.raise_for_status()

if args.json:
	import json
	print(json.dumps(json.loads(r.text), indent=2))
else:
	for check in r.json()["checks"]:
		try:
			print(f'{check["id"]}: {check["result"]} ({check["details"]})')
		except KeyError:
			print(f'{check["id"]}: {check["result"]}')

for check in r.json()["checks"]:
	if check["result"] == "failed":
		import os
		import sys
		sys.exit(os.EX_DATAERR)
