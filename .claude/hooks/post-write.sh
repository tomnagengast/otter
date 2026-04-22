#!/usr/bin/env bash

# Read hook input from stdin
INPUT=$(cat)
FILE_PATH=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ -z "$FILE_PATH" ]]; then
	exit 0
fi

case "$FILE_PATH" in
*.md)
	RESULT=$(prettier --write -- "$FILE_PATH" 2>&1)
	;;
*.ts | *.tsx | *.js | *.jsx | *.json | *.jsonc | *.mjs | *.cjs)
	RESULT=$(biome check --write -- "$FILE_PATH" 2>&1)
	;;
*)
	exit 0
	;;
esac

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
	jq -cn --arg systemMessage "Linting passed after editing $FILE_PATH" \
		'{systemMessage: $systemMessage}'
else
	jq -cn --arg systemMessage "Linting failed after editing $FILE_PATH: $RESULT" \
		'{systemMessage: $systemMessage}'
fi
