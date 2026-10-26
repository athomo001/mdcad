/**
 * @file tabs.ts
 * @description Barra de pestañas de documentos.
 * - Activar, cerrar (botón ✕ o clic central) y reordenar arrastrando dentro de la barra.
 * - Soltar una pestaña fuera de la ventana delega en `dropOutsideWindow` (separar / unir ventanas).
 * - Menú contextual cuyos ítems arma el llamador.
 * El arrastre usa Pointer Events con captura del puntero: Windows sigue entregando el movimiento
 * aunque el cursor salga de la ventana, sin depender del Drag & Drop HTML5 (que Tauri intercepta).
 */

export interface TabView {
  id: string;
  title: string;
  tooltip: string;
  dirty: boolean;
}

export type TabMenuItem = { label: string; action: () => void; disabled?: boolean } | 'separator';

export interface TabStripHandlers {
  activate(id: string): void;
  close(id: string): void;
  /** `toIndex` es la posición final de la pestaña dentro de la lista. */
  reorder(id: string, toIndex: number): void;
  dropOutsideWindow(id: string): void;
  menuItems(id: string): Promise<TabMenuItem[]>;
  newTab(): void;
}

interface DragState {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
  outside: boolean;
  dropIndex: number | null;
}

/** Distancia mínima en px antes de considerar que un clic es un arrastre. */
const DRAG_THRESHOLD = 5;

export class TabStrip {
  private list: HTMLElement;
  private menu: HTMLElement | null = null;
  private drag: DragState | null = null;

  constructor(root: HTMLElement, private handlers: TabStripHandlers) {
    this.list = root.querySelector<HTMLElement>('.tab-list')!;
    root.querySelector('.tab-new-btn')?.addEventListener('click', () => handlers.newTab());

    // La captura va en la lista (estable) y no en la pestaña, que se recrea en cada render
    this.list.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.list.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.list.addEventListener('pointercancel', () => this.endDrag());
    this.list.addEventListener('lostpointercapture', () => this.endDrag());

    // Rueda vertical = desplazamiento horizontal cuando hay muchas pestañas
    this.list.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        this.list.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }, { passive: false });

    document.addEventListener('pointerdown', (e) => {
      if (this.menu && !this.menu.contains(e.target as Node)) this.closeMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeMenu();
    });
    window.addEventListener('blur', () => this.closeMenu());
  }

  render(tabs: TabView[], activeId: string | null): void {
    this.list.replaceChildren(...tabs.map((tab) => this.createTab(tab, tab.id === activeId)));
    this.list.querySelector('.doc-tab.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  private createTab(tab: TabView, active: boolean): HTMLElement {
    const el = document.createElement('div');
    el.className = `doc-tab${active ? ' active' : ''}${tab.dirty ? ' dirty' : ''}`;
    el.dataset.tabId = tab.id;
    el.title = tab.tooltip;
    el.setAttribute('role', 'tab');
    el.setAttribute('aria-selected', String(active));

    const title = document.createElement('span');
    title.className = 'doc-tab-title';
    title.textContent = tab.title;

    const close = document.createElement('button');
    close.className = 'doc-tab-close';
    close.title = 'Ctrl+W';
    close.setAttribute('aria-label', `Cerrar ${tab.title}`);
    close.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    close.addEventListener('pointerdown', (e) => e.stopPropagation());
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handlers.close(tab.id);
    });

    el.append(title, close);
    el.addEventListener('pointerdown', (e) => this.onPointerDown(e, tab.id));
    el.addEventListener('auxclick', (e) => {
      if (e.button === 1) {
        e.preventDefault();
        this.handlers.close(tab.id);
      }
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.openMenu(tab.id, e.clientX, e.clientY);
    });
    return el;
  }

  // ---------------------------------------------------------------------------
  // Arrastre
  // ---------------------------------------------------------------------------

  private onPointerDown(e: PointerEvent, id: string): void {
    if (e.button !== 0) return;
    e.preventDefault();
    this.drag = { id, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false, outside: false, dropIndex: null };
    this.list.setPointerCapture(e.pointerId);
  }

  private onPointerMove(e: PointerEvent): void {
    const drag = this.drag;
    if (!drag || e.pointerId !== drag.pointerId) return;

    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD) return;
      drag.moved = true;
      this.tabElement(drag.id)?.classList.add('dragging');
      document.body.classList.add('tab-dragging');
    }

    drag.outside = e.clientX < 0 || e.clientY < 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight;
    document.body.classList.toggle('tab-drag-outside', drag.outside);
    drag.dropIndex = drag.outside ? null : this.dropIndexAt(e.clientX, drag.id);
    this.showDropMarker(drag.dropIndex, drag.id);
  }

  private onPointerUp(e: PointerEvent): void {
    const drag = this.drag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    this.endDrag();

    if (!drag.moved) {
      this.handlers.activate(drag.id);
    } else if (drag.outside) {
      this.handlers.dropOutsideWindow(drag.id);
    } else if (drag.dropIndex !== null) {
      this.handlers.reorder(drag.id, drag.dropIndex);
    }
  }

  private endDrag(): void {
    if (!this.drag) return;
    if (this.list.hasPointerCapture(this.drag.pointerId)) {
      this.list.releasePointerCapture(this.drag.pointerId);
    }
    this.drag = null;
    this.showDropMarker(null, '');
    this.list.querySelectorAll('.doc-tab.dragging').forEach((el) => el.classList.remove('dragging'));
    document.body.classList.remove('tab-dragging', 'tab-drag-outside');
  }

  /** Posición final que tendría la pestaña arrastrada si se soltara en `clientX`. */
  private dropIndexAt(clientX: number, draggedId: string): number {
    const others = this.tabElements().filter((el) => el.dataset.tabId !== draggedId);
    const idx = others.findIndex((el) => {
      const rect = el.getBoundingClientRect();
      return clientX < rect.left + rect.width / 2;
    });
    return idx === -1 ? others.length : idx;
  }

  private showDropMarker(dropIndex: number | null, draggedId: string): void {
    const others = this.tabElements().filter((el) => el.dataset.tabId !== draggedId);
    others.forEach((el, i) => {
      el.classList.toggle('drop-before', dropIndex === i);
      el.classList.toggle('drop-after', dropIndex === others.length && i === others.length - 1);
    });
  }

  private tabElements(): HTMLElement[] {
    return Array.from(this.list.querySelectorAll<HTMLElement>('.doc-tab'));
  }

  private tabElement(id: string): HTMLElement | null {
    return this.list.querySelector<HTMLElement>(`.doc-tab[data-tab-id="${id}"]`);
  }

  // ---------------------------------------------------------------------------
  // Menú contextual
  // ---------------------------------------------------------------------------

  private async openMenu(id: string, x: number, y: number): Promise<void> {
    const items = await this.handlers.menuItems(id);
    this.closeMenu();

    const menu = document.createElement('div');
    menu.className = 'tab-context-menu';
    menu.setAttribute('role', 'menu');
    for (const item of items) {
      if (item === 'separator') {
        const divider = document.createElement('div');
        divider.className = 'dropdown-divider';
        menu.appendChild(divider);
        continue;
      }
      const btn = document.createElement('button');
      btn.className = 'dropdown-action';
      btn.setAttribute('role', 'menuitem');
      btn.textContent = item.label;
      btn.disabled = Boolean(item.disabled);
      btn.addEventListener('click', () => {
        this.closeMenu();
        item.action();
      });
      menu.appendChild(btn);
    }

    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(4, Math.min(x, window.innerWidth - rect.width - 4))}px`;
    menu.style.top = `${Math.max(4, Math.min(y, window.innerHeight - rect.height - 4))}px`;
    this.menu = menu;
  }

  private closeMenu(): void {
    this.menu?.remove();
    this.menu = null;
  }
}
