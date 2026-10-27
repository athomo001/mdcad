/**
 * @file password-dialog.ts
 * @description Diálogo de contraseña de las cápsulas .mdbin, para descifrar y para cifrar.
 * Reemplaza los `prompt()` nativos: muestra/oculta la contraseña, aviso de Bloq Mayús, confirmación
 * y medidor de fortaleza al cifrar, y estado de espera mientras Argon2id deriva la clave.
 */

import type { I18nManager } from './i18n';

export type PasswordDialogMode = 'decrypt' | 'encrypt';

export interface PasswordDialogOptions {
  mode: PasswordDialogMode;
  /** Nombre del archivo afectado, para el texto descriptivo. */
  fileName?: string;
  /** Al descifrar: pista leída del encabezado. Al cifrar: valor inicial del campo de pista. */
  hint?: string;
  /**
   * Realiza el descifrado o el cifrado. Si lanza un error, el diálogo sigue abierto y lo muestra;
   * si termina bien, el diálogo se cierra.
   */
  onSubmit: (password: string, hint: string) => Promise<void>;
}

/** Fortaleza aproximada de 0 (muy débil) a 4 (fuerte) según longitud y variedad de caracteres. */
function passwordStrength(password: string): number {
  if (!password) return 0;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (classes >= 3) score++;
  return Math.min(4, score);
}

export class PasswordDialog {
  private overlay = document.getElementById('mdbin-modal-overlay')!;
  private title = document.getElementById('mdbin-modal-title')!;
  private desc = document.getElementById('mdbin-modal-desc')!;
  private passwordInput = document.getElementById('mdbin-password-input') as HTMLInputElement;
  private toggleBtn = document.getElementById('mdbin-toggle-visibility') as HTMLButtonElement;
  private capsWarning = document.getElementById('mdbin-caps-warning')!;
  private strength = document.getElementById('mdbin-strength')!;
  private strengthLabel = document.getElementById('mdbin-strength-label')!;
  private encryptFields = document.getElementById('mdbin-encrypt-fields')!;
  private confirmInput = document.getElementById('mdbin-confirm-input') as HTMLInputElement;
  private hintInput = document.getElementById('mdbin-hint-input') as HTMLInputElement;
  private errorBox = document.getElementById('mdbin-error-msg')!;
  private errorText = document.getElementById('mdbin-error-text')!;
  private submitBtn = document.getElementById('submit-mdbin-btn') as HTMLButtonElement;
  private submitLabel = document.getElementById('submit-mdbin-label')!;
  private cancelBtn = document.getElementById('cancel-mdbin-btn') as HTMLButtonElement;

  private options: PasswordDialogOptions | null = null;
  private resolve: ((done: boolean) => void) | null = null;
  private busy = false;

  constructor(private i18n: I18nManager) {
    this.toggleBtn.addEventListener('click', () => this.toggleVisibility());
    this.submitBtn.addEventListener('click', () => void this.submit());
    this.cancelBtn.addEventListener('click', () => this.cancel());
    document.getElementById('close-mdbin-btn')?.addEventListener('click', () => this.cancel());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.cancel();
    });

    for (const input of [this.passwordInput, this.confirmInput, this.hintInput]) {
      input.addEventListener('keydown', (e) => {
        this.updateCapsWarning(e);
        if (e.key === 'Enter') {
          e.preventDefault();
          void this.submit();
        }
      });
      input.addEventListener('keyup', (e) => this.updateCapsWarning(e));
      input.addEventListener('input', () => this.hideError());
    }
    this.passwordInput.addEventListener('input', () => this.updateStrength());
    this.overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        this.cancel();
      }
    });
  }

  isOpen(): boolean {
    return this.options !== null;
  }

  /** Abre el diálogo. Resuelve `true` si `onSubmit` terminó bien y `false` si se canceló. */
  open(options: PasswordDialogOptions): Promise<boolean> {
    if (this.options) this.close(false);
    this.options = options;

    const t = this.i18n.t().mdbin;
    const encrypting = options.mode === 'encrypt';
    this.title.textContent = encrypting ? t.titleEncrypt : t.title;
    this.overlay.classList.toggle('mode-encrypt', encrypting);
    this.encryptFields.hidden = !encrypting;
    this.strength.hidden = !encrypting;

    if (encrypting) {
      this.desc.textContent = options.fileName ? t.descEncryptFile.replace('{file}', options.fileName) : t.descEncrypt;
    } else if (options.hint) {
      // La pista viene del encabezado en texto claro del archivo: es dato no confiable (RFC-001 §9.6)
      const strong = document.createElement('strong');
      strong.textContent = options.hint;
      const [before, after] = t.descHint.split('{hint}');
      this.desc.replaceChildren(before, strong, after ?? '');
    } else {
      this.desc.textContent = t.desc;
    }

    this.passwordInput.value = '';
    this.passwordInput.placeholder = encrypting ? t.newPasswordPlaceholder : t.passwordPlaceholder;
    this.passwordInput.autocomplete = encrypting ? 'new-password' : 'current-password';
    this.confirmInput.value = '';
    this.hintInput.value = encrypting ? options.hint ?? '' : '';
    this.setVisibility(false);
    this.capsWarning.hidden = true;
    this.updateStrength();
    this.hideError();
    this.setBusy(false);

    this.overlay.classList.add('open');
    setTimeout(() => this.passwordInput.focus(), 50);
    return new Promise((resolve) => (this.resolve = resolve));
  }

  cancel(): void {
    if (this.busy) return;
    this.close(false);
  }

  private close(done: boolean): void {
    this.overlay.classList.remove('open');
    // No dejar contraseñas en el DOM una vez cerrado el diálogo
    this.passwordInput.value = '';
    this.confirmInput.value = '';
    this.options = null;
    this.resolve?.(done);
    this.resolve = null;
  }

  private async submit(): Promise<void> {
    if (!this.options || this.busy) return;
    const t = this.i18n.t().mdbin;
    const password = this.passwordInput.value;

    if (!password) {
      this.showError(t.emptyError);
      this.passwordInput.focus();
      return;
    }
    if (this.options.mode === 'encrypt' && password !== this.confirmInput.value) {
      this.showError(t.mismatchError);
      this.confirmInput.focus();
      return;
    }

    this.setBusy(true);
    try {
      await this.options.onSubmit(password, this.hintInput.value.trim());
      this.setBusy(false);
      this.close(true);
    } catch (err) {
      this.setBusy(false);
      this.showError(String(err ?? '') || t.error);
      this.passwordInput.select();
    }
  }

  private toggleVisibility(): void {
    this.setVisibility(this.passwordInput.type === 'password');
    this.passwordInput.focus();
  }

  private setVisibility(visible: boolean): void {
    const t = this.i18n.t().mdbin;
    const type = visible ? 'text' : 'password';
    this.passwordInput.type = type;
    this.confirmInput.type = type;
    this.toggleBtn.classList.toggle('active', visible);
    this.toggleBtn.title = visible ? t.hidePassword : t.showPassword;
    this.toggleBtn.setAttribute('aria-pressed', String(visible));
  }

  private updateCapsWarning(e: KeyboardEvent): void {
    if (typeof e.getModifierState === 'function') {
      this.capsWarning.hidden = !e.getModifierState('CapsLock');
    }
  }

  private updateStrength(): void {
    const t = this.i18n.t().mdbin;
    const score = passwordStrength(this.passwordInput.value);
    this.strength.dataset.score = this.passwordInput.value ? String(score) : '';
    this.strengthLabel.textContent = this.passwordInput.value ? t.strength[score] : '';
  }

  private setBusy(busy: boolean): void {
    const t = this.i18n.t().mdbin;
    this.busy = busy;
    const encrypting = this.options?.mode === 'encrypt';
    this.submitBtn.disabled = busy;
    this.cancelBtn.disabled = busy;
    this.submitBtn.classList.toggle('busy', busy);
    this.submitLabel.textContent = busy
      ? encrypting ? t.busyEncrypt : t.busyDecrypt
      : encrypting ? t.encryptBtn : t.decryptBtn;
    for (const input of [this.passwordInput, this.confirmInput, this.hintInput]) input.disabled = busy;
  }

  private showError(message: string): void {
    this.errorText.textContent = message;
    this.errorBox.hidden = false;
    // Reinicia la animación de sacudida en cada error
    this.errorBox.classList.remove('shake');
    void this.errorBox.offsetWidth;
    this.errorBox.classList.add('shake');
  }

  private hideError(): void {
    this.errorBox.hidden = true;
  }
}
