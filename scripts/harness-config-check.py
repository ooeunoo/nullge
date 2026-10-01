#!/usr/bin/env python3
"""Validate harness.config.json against .harness/schemas/harness-config.schema.json without extra packages.

Covers the keywords that schema uses: type, const, enum, required, properties, additionalProperties, items,
uniqueItems, minItems, minLength, pattern. Exits non-zero on the first violation.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TYPES = {'object': dict, 'array': list, 'string': str, 'boolean': bool, 'number': (int, float), 'integer': int, 'null': type(None)}


def check(value, schema, path='$'):
    t = schema.get('type')
    if t is not None:
        allowed = tuple(TYPES[x] for x in (t if isinstance(t, list) else [t]))
        if isinstance(value, bool) and bool not in allowed or not isinstance(value, allowed):
            raise ValueError(f'{path}: expected {t}, got {type(value).__name__}')
    if 'const' in schema and value != schema['const']:
        raise ValueError(f'{path}: must be {schema["const"]!r}, got {value!r}')
    if 'enum' in schema and value not in schema['enum']:
        raise ValueError(f'{path}: {value!r} not in {schema["enum"]}')
    if isinstance(value, str):
        if len(value) < schema.get('minLength', 0):
            raise ValueError(f'{path}: shorter than {schema["minLength"]}')
        if 'pattern' in schema and not re.search(schema['pattern'], value):
            raise ValueError(f'{path}: {value!r} does not match {schema["pattern"]}')
    if isinstance(value, dict):
        for key in schema.get('required', []):
            if key not in value:
                raise ValueError(f'{path}: missing {key}')
        props = schema.get('properties', {})
        for key, item in value.items():
            if key in props:
                check(item, props[key], f'{path}.{key}')
            elif schema.get('additionalProperties') is False:
                raise ValueError(f'{path}: unexpected key {key}')
    if isinstance(value, list):
        if len(value) < schema.get('minItems', 0):
            raise ValueError(f'{path}: fewer than {schema["minItems"]} items')
        if schema.get('uniqueItems') and len({json.dumps(v, sort_keys=True) for v in value}) != len(value):
            raise ValueError(f'{path}: duplicate items')
        for i, item in enumerate(value):
            check(item, schema.get('items', {}), f'{path}[{i}]')


def main() -> int:
    schema = json.loads((ROOT / '.harness/schemas/harness-config.schema.json').read_text())
    config = json.loads((ROOT / 'harness.config.json').read_text())
    try:
        check(config, schema)
    except ValueError as error:
        print(f'harness.config.json invalid: {error}')
        return 1
    print('harness.config.json matches the harness schema')
    return 0


if __name__ == '__main__':
    sys.exit(main())
