// Minimal YAML reader for loop-cli.
// Supports: key: value, nested via 2-space indent, list items via "- ", comments.
// Does NOT support: flow style, anchors, multiline scalars.
// Sufficient for the small, well-formed YAML files in config/loop/.

import { readFile } from 'node:fs/promises';

const INDENT = 2;

function parseScalar(raw) {
  const s = raw.trim();
  if (s === '') return null;
  if (s === 'null' || s === '~') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map((x) => parseScalar(x.trim()));
  }
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
  return s;
}

function classify(line) {
  const lineIndent = line.match(/^ */)[0].length;
  const trimmed = line.trim();
  return { indent: lineIndent, trimmed };
}

export function parseYaml(text) {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/#.*$/, '')) // strip comments
    .filter((l) => l.trim() !== '');

  let pos = 0;

  function parseValue(indent) {
    if (pos >= lines.length) return {};
    const { indent: curIndent, trimmed } = classify(lines[pos]);
    if (curIndent < indent) return {};
    if (trimmed.startsWith('- ')) return parseArray(indent);
    return parseObject(indent);
  }

  function parseArray(indent) {
    const arr = [];
    while (pos < lines.length) {
      const { indent: curIndent, trimmed } = classify(lines[pos]);
      if (curIndent < indent) break;
      if (curIndent > indent) break;
      if (!trimmed.startsWith('- ')) break;
      const afterDash = trimmed.slice(2);
      if (afterDash === '' || afterDash.trim() === '') {
        // list item whose value is on subsequent lines at deeper indent
        pos += 1;
        arr.push(parseValue(indent + INDENT));
      } else if (afterDash.includes(':')) {
        // first key of an object item; read remaining keys at indent + INDENT
        const obj = {};
        const colonAt = afterDash.indexOf(':');
        const firstKey = afterDash.slice(0, colonAt).trim();
        const firstRest = afterDash.slice(colonAt + 1).trim();
        if (firstRest === '') {
          pos += 1;
          obj[firstKey] = parseValue(indent + INDENT);
        } else {
          obj[firstKey] = parseScalar(firstRest);
          pos += 1;
        }
        // continue reading sibling keys at indent + INDENT
        while (pos < lines.length) {
          const { indent: ni, trimmed: nt } = classify(lines[pos]);
          if (ni !== indent + INDENT) break;
          if (nt.startsWith('- ')) break;
          const c = nt.indexOf(':');
          if (c === -1) break;
          const k = nt.slice(0, c).trim();
          const r = nt.slice(c + 1).trim();
          if (r === '') {
            pos += 1;
            obj[k] = parseValue(indent + INDENT * 2);
          } else {
            obj[k] = parseScalar(r);
            pos += 1;
          }
        }
        arr.push(obj);
      } else {
        arr.push(parseScalar(afterDash));
        pos += 1;
      }
    }
    return arr;
  }

  function parseObject(indent) {
    const obj = {};
    while (pos < lines.length) {
      const { indent: curIndent, trimmed } = classify(lines[pos]);
      if (curIndent < indent) break;
      if (curIndent > indent) break;
      if (trimmed.startsWith('- ')) break;
      const c = trimmed.indexOf(':');
      if (c === -1) break;
      const k = trimmed.slice(0, c).trim();
      const r = trimmed.slice(c + 1).trim();
      if (r === '') {
        pos += 1;
        obj[k] = parseValue(indent + INDENT);
      } else {
        obj[k] = parseScalar(r);
        pos += 1;
      }
    }
    return obj;
  }

  return parseValue(0);
}

export async function readYamlFile(path) {
  const text = await readFile(path, 'utf8');
  return parseYaml(text);
}
