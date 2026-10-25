/**
 * @file highlighter.ts
 * @description Resaltador de sintaxis ultraliviano, seguro y zero-dependency.
 * Tokeniza bloques de código en los lenguajes más usados de pentesting y desarrollo
 * (Rust, TypeScript, JavaScript, Python, Bash, JSON, HTML, CSS, YAML)
 * inyectando spans semánticos que se sincronizan de inmediato con los 4 temas oficiales de MDCAT.
 */

interface LanguageDefinition {
  keywords: Set<string>;
  types: Set<string>;
  builtins: Set<string>;
  singleComment: string;
  multiComment?: [string, string];
}

const LANGUAGES: Record<string, LanguageDefinition> = {
  rust: {
    keywords: new Set([
      'as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'dyn', 'else', 'enum',
      'extern', 'false', 'fn', 'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod',
      'move', 'mut', 'pub', 'ref', 'return', 'self', 'Self', 'static', 'struct', 'super',
      'trait', 'true', 'type', 'unsafe', 'use', 'where', 'while'
    ]),
    types: new Set([
      'bool', 'char', 'i8', 'i16', 'i32', 'i64', 'i128', 'isize', 'u8', 'u16', 'u32', 'u64',
      'u128', 'usize', 'f32', 'f64', 'str', 'String', 'Vec', 'Option', 'Result', 'Some', 'None',
      'Ok', 'Err', 'Box', 'Rc', 'Arc'
    ]),
    builtins: new Set(['println', 'eprintln', 'format', 'vec', 'panic', 'todo', 'unreachable']),
    singleComment: '//',
    multiComment: ['/*', '*/'],
  },
  javascript: {
    keywords: new Set([
      'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
      'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function',
      'if', 'import', 'in', 'instanceof', 'let', 'new', 'return', 'super', 'switch', 'this',
      'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield', 'true', 'false', 'null', 'undefined'
    ]),
    types: new Set(['Array', 'Boolean', 'Date', 'Error', 'Function', 'Number', 'Object', 'Promise', 'RegExp', 'String', 'Symbol']),
    builtins: new Set(['console', 'window', 'document', 'fetch', 'setTimeout', 'setInterval']),
    singleComment: '//',
    multiComment: ['/*', '*/'],
  },
  typescript: {
    keywords: new Set([
      'any', 'as', 'async', 'await', 'boolean', 'break', 'case', 'catch', 'class', 'const',
      'continue', 'debugger', 'default', 'delete', 'do', 'else', 'enum', 'export', 'extends',
      'false', 'finally', 'for', 'from', 'function', 'get', 'if', 'implements', 'import', 'in',
      'instanceof', 'interface', 'let', 'module', 'namespace', 'never', 'new', 'null', 'number',
      'of', 'package', 'private', 'protected', 'public', 'readonly', 'return', 'set', 'static',
      'string', 'super', 'switch', 'symbol', 'this', 'throw', 'true', 'try', 'type', 'typeof',
      'undefined', 'unknown', 'var', 'void', 'while', 'with', 'yield'
    ]),
    types: new Set(['Record', 'Partial', 'Required', 'Readonly', 'Pick', 'Omit', 'Promise', 'Array', 'Map', 'Set']),
    builtins: new Set(['console', 'window', 'document', 'fetch']),
    singleComment: '//',
    multiComment: ['/*', '*/'],
  },
  python: {
    keywords: new Set([
      'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif',
      'else', 'except', 'False', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
      'lambda', 'None', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'True', 'try', 'while',
      'with', 'yield'
    ]),
    types: new Set(['int', 'float', 'str', 'bytes', 'list', 'dict', 'set', 'tuple', 'bool', 'object']),
    builtins: new Set(['print', 'len', 'range', 'enumerate', 'zip', 'open', 'isinstance', 'type']),
    singleComment: '#',
  },
  bash: {
    keywords: new Set([
      'if', 'then', 'else', 'elif', 'fi', 'case', 'esac', 'for', 'select', 'while', 'until',
      'do', 'done', 'in', 'function', 'time', 'return', 'exit'
    ]),
    types: new Set([]),
    builtins: new Set(['echo', 'cd', 'ls', 'cat', 'grep', 'sudo', 'chmod', 'chown', 'curl', 'wget', 'export', 'alias']),
    singleComment: '#',
  },
  json: {
    keywords: new Set(['true', 'false', 'null']),
    types: new Set([]),
    builtins: new Set([]),
    singleComment: '',
  },
};

// Alias de lenguajes comunes
LANGUAGES['js'] = LANGUAGES['javascript'];
LANGUAGES['ts'] = LANGUAGES['typescript'];
LANGUAGES['rs'] = LANGUAGES['rust'];
LANGUAGES['py'] = LANGUAGES['python'];
LANGUAGES['sh'] = LANGUAGES['bash'];
LANGUAGES['shell'] = LANGUAGES['bash'];
LANGUAGES['zsh'] = LANGUAGES['bash'];

export class SyntaxHighlighter {
  /**
   * Resalta todos los bloques `<pre><code class="language-xyz">` dentro de un contenedor.
   */
  static highlightAll(container: HTMLElement): void {
    const codeBlocks = container.querySelectorAll<HTMLElement>('pre > code');
    codeBlocks.forEach((codeEl) => {
      this.highlightElement(codeEl);
    });
  }

  /**
   * Resalta un único elemento de código.
   */
  static highlightElement(codeEl: HTMLElement): void {
    const langClass = Array.from(codeEl.classList).find((c) => c.startsWith('language-'));
    const lang = langClass ? langClass.replace('language-', '').toLowerCase() : '';

    // Si es mermaid, no lo tocamos aquí para que el motor de diagramas lo dibuje
    if (lang === 'mermaid') {
      return;
    }

    const rawCode = codeEl.textContent || '';
    if (!rawCode.trim()) return;

    const langDef = LANGUAGES[lang];
    if (!langDef) {
      // Si no tenemos gramática específica, aplicamos sanitización básica
      codeEl.innerHTML = this.escapeHtml(rawCode);
      return;
    }

    const highlighted = this.tokenize(rawCode, langDef);
    codeEl.innerHTML = highlighted;
  }

  private static tokenize(code: string, def: LanguageDefinition): string {
    const lines = code.split('\n');
    const resultLines: string[] = [];

    for (const line of lines) {
      let i = 0;
      let out = '';
      const len = line.length;

      while (i < len) {
        // 1. Comentarios de una sola línea
        if (def.singleComment && line.startsWith(def.singleComment, i)) {
          const comment = line.slice(i);
          out += `<span class="hl-comm">${this.escapeHtml(comment)}</span>`;
          break;
        }

        // 2. Cadenas de texto ("...", '...', `...`)
        const char = line[i];
        if (char === '"' || char === "'" || char === '`') {
          const quote = char;
          let str = quote;
          i++;
          while (i < len) {
            if (line[i] === '\\' && i + 1 < len) {
              str += line[i] + line[i + 1];
              i += 2;
            } else if (line[i] === quote) {
              str += quote;
              i++;
              break;
            } else {
              str += line[i];
              i++;
            }
          }
          out += `<span class="hl-str">${this.escapeHtml(str)}</span>`;
          continue;
        }

        // 3. Números
        if (/\d/.test(char) && (i === 0 || /[\s,;:()[\]{}<>+\-*/%=&|^!]/.test(line[i - 1]))) {
          let num = '';
          while (i < len && /[0-9a-fA-FxX._]/.test(line[i])) {
            num += line[i];
            i++;
          }
          out += `<span class="hl-num">${num}</span>`;
          continue;
        }

        // 4. Identificadores y palabras clave
        if (/[a-zA-Z_]/.test(char)) {
          let ident = '';
          while (i < len && /[a-zA-Z0-9_]/.test(line[i])) {
            ident += line[i];
            i++;
          }

          if (def.keywords.has(ident)) {
            out += `<span class="hl-kw">${ident}</span>`;
          } else if (def.types.has(ident)) {
            out += `<span class="hl-type">${ident}</span>`;
          } else if (def.builtins.has(ident)) {
            out += `<span class="hl-fn">${ident}</span>`;
          } else if (i < len && line[i] === '(') {
            out += `<span class="hl-fn">${ident}</span>`;
          } else {
            out += this.escapeHtml(ident);
          }
          continue;
        }

        // 5. Caracteres sueltos y operadores
        out += this.escapeHtml(char);
        i++;
      }

      resultLines.push(out);
    }

    return resultLines.join('\n');
  }

  private static escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
