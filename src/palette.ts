/**
 * @file palette.ts
 * @description Paleta de comandos flotante estilo Raycast (Ctrl + K) para navegación instantánea.
 * Permite buscar acciones, conmutar temas de color, alternar modos ergonómicos y saltar a secciones del documento.
 * Diseñado como módulo profundo: encapsula todo el ciclo de eventos del teclado, filtrado difuso y foco.
 */

export interface PaletteCommand {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  shortcut?: string;
  action: () => void;
}

export class CommandPalette {
  private overlay: HTMLElement | null = null;
  private input: HTMLInputElement | null = null;
  private list: HTMLElement | null = null;
  private commands: PaletteCommand[] = [];
  private filteredCommands: PaletteCommand[] = [];
  private selectedIndex = 0;
  private isOpen = false;

  constructor() {
    this.createDom();
    this.bindGlobalKeyboard();
  }

  /**
   * Registra la lista de comandos disponibles en la paleta.
   */
  setCommands(commands: PaletteCommand[]): void {
    this.commands = commands;
    if (this.isOpen) {
      this.filter('');
    }
  }

  /**
   * Abre la paleta de comandos.
   */
  open(): void {
    if (this.isOpen || !this.overlay || !this.input) return;
    this.isOpen = true;
    this.overlay.classList.add('open');
    this.input.value = '';
    this.filter('');
    setTimeout(() => this.input?.focus(), 50);
  }

  /**
   * Cierra la paleta de comandos.
   */
  close(): void {
    if (!this.isOpen || !this.overlay) return;
    this.isOpen = false;
    this.overlay.classList.remove('open');
  }

  /**
   * Alterna la visibilidad de la paleta.
   */
  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  private filter(query: string): void {
    const q = query.trim().toLowerCase();
    if (!q) {
      this.filteredCommands = [...this.commands];
    } else {
      this.filteredCommands = this.commands.filter((cmd) => {
        const matchTitle = cmd.title.toLowerCase().includes(q);
        const matchSub = cmd.subtitle ? cmd.subtitle.toLowerCase().includes(q) : false;
        return matchTitle || matchSub;
      });
    }

    this.selectedIndex = 0;
    this.renderList();
  }

  private renderList(): void {
    if (!this.list) return;
    this.list.innerHTML = '';

    if (this.filteredCommands.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'palette-empty';
      empty.textContent = 'No se encontraron comandos ni secciones.';
      this.list.appendChild(empty);
      return;
    }

    this.filteredCommands.forEach((cmd, idx) => {
      const item = document.createElement('div');
      item.className = `palette-item ${idx === this.selectedIndex ? 'selected' : ''}`;
      
      const left = document.createElement('div');
      left.className = 'palette-item-left';

      if (cmd.icon) {
        const icon = document.createElement('span');
        icon.className = 'palette-item-icon';
        icon.textContent = cmd.icon;
        left.appendChild(icon);
      }

      const textWrapper = document.createElement('div');
      textWrapper.className = 'palette-item-text';

      const title = document.createElement('div');
      title.className = 'palette-item-title';
      title.textContent = cmd.title;
      textWrapper.appendChild(title);

      if (cmd.subtitle) {
        const subtitle = document.createElement('div');
        subtitle.className = 'palette-item-subtitle';
        subtitle.textContent = cmd.subtitle;
        textWrapper.appendChild(subtitle);
      }

      left.appendChild(textWrapper);
      item.appendChild(left);

      if (cmd.shortcut) {
        const badge = document.createElement('kbd');
        badge.className = 'palette-item-shortcut';
        badge.textContent = cmd.shortcut;
        item.appendChild(badge);
      }

      item.addEventListener('mouseenter', () => {
        this.selectedIndex = idx;
        this.updateSelection();
      });

      item.addEventListener('click', () => {
        this.executeCommand(cmd);
      });

      this.list?.appendChild(item);
    });

    this.scrollSelectedIntoView();
  }

  private updateSelection(): void {
    if (!this.list) return;
    const items = this.list.querySelectorAll('.palette-item');
    items.forEach((item, idx) => {
      item.classList.toggle('selected', idx === this.selectedIndex);
    });
    this.scrollSelectedIntoView();
  }

  private scrollSelectedIntoView(): void {
    if (!this.list) return;
    const selected = this.list.children[this.selectedIndex] as HTMLElement;
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }

  private executeCommand(cmd: PaletteCommand): void {
    this.close();
    cmd.action();
  }

  private bindGlobalKeyboard(): void {
    document.addEventListener('keydown', (e) => {
      // Atajo global Ctrl + K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.toggle();
        return;
      }

      if (!this.isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (this.filteredCommands.length > 0) {
          this.selectedIndex = (this.selectedIndex + 1) % this.filteredCommands.length;
          this.updateSelection();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (this.filteredCommands.length > 0) {
          this.selectedIndex =
            (this.selectedIndex - 1 + this.filteredCommands.length) % this.filteredCommands.length;
          this.updateSelection();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = this.filteredCommands[this.selectedIndex];
        if (cmd) {
          this.executeCommand(cmd);
        }
      }
    });
  }

  private createDom(): void {
    const overlay = document.createElement('div');
    overlay.className = 'palette-overlay';
    overlay.id = 'command-palette-overlay';

    const modal = document.createElement('div');
    modal.className = 'palette-modal';

    const header = document.createElement('div');
    header.className = 'palette-header';

    const icon = document.createElement('span');
    icon.className = 'palette-search-icon';
    icon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'palette-input';
    input.placeholder = 'Escribe un comando o busca en el documento...';
    input.autocomplete = 'off';
    input.spellcheck = false;

    input.addEventListener('input', () => {
      this.filter(input.value);
    });

    header.appendChild(icon);
    header.appendChild(input);

    const list = document.createElement('div');
    list.className = 'palette-list';

    const footer = document.createElement('div');
    footer.className = 'palette-footer';
    footer.innerHTML = `
      <span><kbd>↑</kbd> <kbd>↓</kbd> navegar</span>
      <span><kbd>Enter</kbd> seleccionar</span>
      <span><kbd>Esc</kbd> cerrar</span>
    `;

    modal.appendChild(header);
    modal.appendChild(list);
    modal.appendChild(footer);
    overlay.appendChild(modal);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.close();
      }
    });

    document.body.appendChild(overlay);

    this.overlay = overlay;
    this.input = input;
    this.list = list;
  }
}
