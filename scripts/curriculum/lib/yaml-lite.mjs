// Serialiseur YAML minimal (sans dependance externe) pour produire
// SXX/session.yaml : un resume lisible par le formateur, derive du
// manifeste de seance. Ne vise pas a couvrir la specification YAML
// complete (pas d'ancres, de flux inline complexe...), seulement les
// structures que nos donnees produisent (objets, tableaux, scalaires).

function scalarToYaml(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  const text = String(value);
  const needsQuoting = /[:#\-?[\]{}&*!|>'"%@`]/.test(text) || text.trim() !== text || text === '';
  return needsQuoting ? JSON.stringify(text) : text;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function serialize(value, indent) {
  const pad = '  '.repeat(indent);

  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}[]\n`;
    return value
      .map((item) => {
        if (isPlainObject(item) || Array.isArray(item)) {
          const nested = serialize(item, indent + 1).replace(/^ {2}/, '');
          return `${pad}- ${nested.trimStart()}`;
        }
        return `${pad}- ${scalarToYaml(item)}\n`;
      })
      .join('');
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (keys.length === 0) return `${pad}{}\n`;
    return keys
      .map((key) => {
        const child = value[key];
        if (Array.isArray(child)) {
          return child.length === 0 ? `${pad}${key}: []\n` : `${pad}${key}:\n${serialize(child, indent)}`;
        }
        if (isPlainObject(child)) {
          return Object.keys(child).length === 0 ? `${pad}${key}: {}\n` : `${pad}${key}:\n${serialize(child, indent + 1)}`;
        }
        return `${pad}${key}: ${scalarToYaml(child)}\n`;
      })
      .join('');
  }

  return `${pad}${scalarToYaml(value)}\n`;
}

export function toYaml(value) {
  return serialize(value, 0);
}
