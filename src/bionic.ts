/**
 * @file bionic.ts
 * @description Motor de Lectura Biónica (Bionic Reading) ultraliviano.
 * Facilita la fijación ocular sacádica guiando la mirada a través de las primeras letras de cada palabra.
 * Diseñado bajo principios de módulo profundo: interfaz mínima, cero dependencias externas y cero fugas de memoria.
 */

export class BionicReader {
  private static isBionicActive = false;
  private static originalContent: string | null = null;

  /**
   * Alterna el estado de lectura biónica en el contenedor especificado.
   * @param containerElement Elemento HTML que contiene el Markdown renderizado.
   * @returns El nuevo estado (true = activo, false = desactivado).
   */
  static toggle(containerElement: HTMLElement): boolean {
    if (this.isBionicActive) {
      this.disable(containerElement);
      return false;
    } else {
      this.enable(containerElement);
      return true;
    }
  }

  /**
   * Indica si la lectura biónica está actualmente encendida.
   */
  static isActive(): boolean {
    return this.isBionicActive;
  }

  /**
   * Aplica la transformación biónica al contenido.
   */
  static enable(containerElement: HTMLElement): void {
    if (this.isBionicActive) return;

    // Respaldamos el HTML original al tiro para restaurar sin re-parsear de la nada
    this.originalContent = containerElement.innerHTML;

    // Procesamos recursivamente los nodos de texto excluyendo bloques preformateados, código y matemáticas
    this.processElement(containerElement);
    this.isBionicActive = true;
    document.body.classList.add('bionic-mode');
  }

  /**
   * Restaura el HTML original rápidamente.
   */
  static disable(containerElement: HTMLElement): void {
    if (!this.isBionicActive) return;

    if (this.originalContent !== null) {
      containerElement.innerHTML = this.originalContent;
      this.originalContent = null;
    }
    this.isBionicActive = false;
    document.body.classList.remove('bionic-mode');
  }

  /**
   * Recorre los nodos DOM omitiendo tags que no deben alterarse (código, pre, scripts, estilos).
   */
  private static processElement(element: HTMLElement): void {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node: Node): number {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;

          const tag = parent.tagName.toLowerCase();
          // Jamás tocar bloques de código, scripts, svgs o fórmulas
          if (['pre', 'code', 'script', 'style', 'svg', 'math'].includes(tag)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.closest('pre') || parent.closest('code')) {
            return NodeFilter.FILTER_REJECT;
          }
          if (node.nodeValue && node.nodeValue.trim().length > 0) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        },
      }
    );

    const textNodes: Text[] = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode as Text);
    }

    // Reemplazamos los nodos de texto por fragmentos con fijación sacádica
    for (const textNode of textNodes) {
      const text = textNode.nodeValue || '';
      const fragment = this.transformTextToBionicFragment(text);
      if (textNode.parentNode) {
        textNode.parentNode.replaceChild(fragment, textNode);
      }
    }
  }

  /**
   * Transforma una cadena de texto en un DocumentFragment con las primeras letras en negrita.
   */
  private static transformTextToBionicFragment(text: string): DocumentFragment {
    const fragment = document.createDocumentFragment();
    // Separamos por palabras conservando espacios y puntuación
    const tokens = text.split(/(\s+|[.,;:!?()[\]{}""''`])/);

    for (const token of tokens) {
      if (!token) continue;

      // Si es espacio o puntuación, va tal cual
      if (/^(\s+|[.,;:!?()[\]{}""''`]+)$/.test(token)) {
        fragment.appendChild(document.createTextNode(token));
        continue;
      }

      // Regla de fijación ergonómica óptima:
      // 1 a 3 caracteres -> 1 carácter en negrita
      // 4 a 6 caracteres -> 2 caracteres en negrita
      // 7 o más caracteres -> Math.ceil(length * 0.4) caracteres en negrita
      const len = token.length;
      let boldLen = 1;
      if (len <= 3) {
        boldLen = 1;
      } else if (len <= 6) {
        boldLen = 2;
      } else {
        boldLen = Math.min(len - 1, Math.ceil(len * 0.4));
      }

      const boldPart = token.slice(0, boldLen);
      const restPart = token.slice(boldLen);

      const b = document.createElement('b');
      b.className = 'bionic-fixation';
      b.textContent = boldPart;
      fragment.appendChild(b);

      if (restPart.length > 0) {
        fragment.appendChild(document.createTextNode(restPart));
      }
    }

    return fragment;
  }
}
