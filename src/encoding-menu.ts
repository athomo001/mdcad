/**
 * @file encoding-menu.ts
 * @description Menú emergente de la barra de estado para cambiar la codificación del documento:
 * "Reabrir con" vuelve a leer el archivo del disco con otra codificación (cuando la detección se
 * equivocó) y "Guardar con" convierte el documento a otra codificación al guardarlo.
 */

import type { I18nManager } from './i18n';

/** Identificadores que entiende el núcleo de Rust (nombres canónicos de encoding_rs + "UTF-8 BOM"). */
export const ENCODINGS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'UTF-8', label: 'UTF-8' },
  { id: 'UTF-8 BOM', label: 'UTF-8 con BOM' },
  { id: 'UTF-16LE', label: 'UTF-16 LE' },
  { id: 'UTF-16BE', label: 'UTF-16 BE' },
  { id: 'windows-1252', label: 'Windows-1252 (Europa occidental)' },
  { id: 'ISO-8859-15', label: 'ISO-8859-15 (Latin-9)' },
  { id: 'windows-1251', label: 'Windows-1251 (Cirílico)' },
  { id: 'Shift_JIS', label: 'Shift_JIS (Japonés)' },
  { id: 'gb18030', label: 'GB18030 (Chino)' },
  { id: 'EUC-KR', label: 'EUC-KR (Coreano)' },
];

/** Nombre corto para la barra de estado. */
export function encodingShortLabel(id: string): string {
  const known = ENCODINGS.find((e) => e.id === id);
  return known ? known.label.replace(/ \(.*\)$/, '') : id;
}

export interface EncodingMenuOptions {
  current: string;
  /** El documento tiene un archivo en disco que se puede volver a leer. */
  canReopen: boolean;
  onReopen: (encoding: string) => void;
  onSave: (encoding: string) => void;
}

export class EncodingMenu {
  private menu: HTMLElement | null = null;

  constructor(private i18n: I18nManager) {
    document.addEventListener('click', (e) => {
      if (this.menu && !this.menu.contains(e.target as Node)) this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
  }

  isOpen(): boolean {
    return this.menu !== null;
  }

  open(anchor: HTMLElement, options: EncodingMenuOptions): void {
    this.close();
    const t = this.i18n.t().encoding;
    let mode: 'reopen' | 'save' = options.canReopen ? 'reopen' : 'save';

    const menu = document.createElement('div');
    menu.className = 'encoding-menu';
    menu.setAttribute('role', 'menu');

    const tabs = document.createElement('div');
    tabs.className = 'encoding-menu-tabs';
    const reopenTab = this.modeButton(t.reopenWith, !options.canReopen, t.reopenUnavailable);
    const saveTab = this.modeButton(t.saveWith, false);
    tabs.append(reopenTab, saveTab);

    const help = document.createElement('p');
    help.className = 'encoding-menu-help';

    const list = document.createElement('div');
    list.className = 'encoding-menu-list';

    const render = () => {
      reopenTab.classList.toggle('active', mode === 'reopen');
      saveTab.classList.toggle('active', mode === 'save');
      help.textContent = mode === 'reopen' ? t.reopenHelp : t.saveHelp;
      list.replaceChildren(
        ...ENCODINGS.map((enc) => {
          const item = document.createElement('button');
          item.className = 'dropdown-action';
          item.setAttribute('role', 'menuitemradio');
          item.setAttribute('aria-checked', String(enc.id === options.current));
          const check = document.createElement('span');
          check.className = 'encoding-check';
          check.textContent = enc.id === options.current ? '✓' : '';
          const label = document.createElement('span');
          label.textContent = enc.label;
          item.append(label, check);
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            this.close();
            if (mode === 'reopen') options.onReopen(enc.id);
            else options.onSave(enc.id);
          });
          return item;
        })
      );
    };

    reopenTab.addEventListener('click', (e) => {
      e.stopPropagation();
      mode = 'reopen';
      render();
    });
    saveTab.addEventListener('click', (e) => {
      e.stopPropagation();
      mode = 'save';
      render();
    });

    render();
    menu.append(tabs, help, list);
    menu.addEventListener('click', (e) => e.stopPropagation());
    document.body.appendChild(menu);

    // Se abre hacia arriba, alineado al borde derecho del botón de la barra de estado
    const rect = anchor.getBoundingClientRect();
    menu.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    menu.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;
    this.menu = menu;
  }

  close(): void {
    this.menu?.remove();
    this.menu = null;
  }

  private modeButton(label: string, disabled: boolean, disabledTitle?: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'encoding-menu-tab';
    btn.textContent = label;
    btn.disabled = disabled;
    if (disabled && disabledTitle) btn.title = disabledTitle;
    return btn;
  }
}
