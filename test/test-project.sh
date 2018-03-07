#!/bin/sh

webpack --config test/test-project/webpack.config.js 2>&1 | awk '
	{out = out "!!!   " $0 "\n"}
	/(test-project started|Only running script once)/ {t++}
	END {
		if (t != 2) {
			print "!!! Test failed:\n!!!\n" out;
			exit(2);
		}
	}'
