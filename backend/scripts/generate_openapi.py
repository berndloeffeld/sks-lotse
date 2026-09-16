"""Dumps the FastAPI app's OpenAPI schema to stdout (or a file via argv[1])."""

import json
import sys

from app.main import app


def main():
    schema = app.openapi()
    output = json.dumps(schema, indent=2)
    if len(sys.argv) > 1:
        with open(sys.argv[1], "w") as f:
            f.write(output)
    else:
        print(output)


if __name__ == "__main__":
    main()
