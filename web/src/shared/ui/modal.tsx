import { useEffect, useRef, type HTMLAttributes, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

export interface ModalOptions {
  onOpen?: (overlay: HTMLElement) => void
  onClose?: (overlay: HTMLElement) => void
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
}

type SavedStyle = { value: string; priority: string }

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Adds the keyboard and focus behavior required by an inline React dialog. */
export function useDialogFocus(
  dialogRef: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (!dialog) return

    const returnTarget =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusable = () =>
      [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter((element) => {
        if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return false
        const style = getComputedStyle(element)
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          element.getClientRects().length > 0
        )
      })

    if (!dialog.hasAttribute('tabindex')) dialog.tabIndex = -1
    focusable()[0]?.focus({ preventScroll: true })
    if (document.activeElement !== focusable()[0]) dialog.focus({ preventScroll: true })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const elements = focusable()
      if (elements.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (
        event.shiftKey &&
        (document.activeElement === first || !dialog.contains(document.activeElement))
      ) {
        event.preventDefault()
        last.focus()
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !dialog.contains(document.activeElement))
      ) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (returnTarget?.isConnected) returnTarget.focus({ preventScroll: true })
    }
  }, [dialogRef, open])
}

/** Coordinates every modal mounted in the document, including stacked dialogs. */
export class Modal {
  private static instances = new Map<string, Modal>()
  private static openStack: Modal[] = []
  private static scrollLockCount = 0
  private static savedScrollStyles: { overflow: SavedStyle; paddingRight: SavedStyle } | null = null
  private static listenersInstalled = false

  private static handleDocumentKeydown = (event: KeyboardEvent) => {
    Modal.openStack.at(-1)?._onKeydown(event)
  }

  private static handleDocumentClick = (event: MouseEvent) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const trigger = target.closest<HTMLElement>('[data-md-open]')
    if (!trigger) return
    const id = trigger.getAttribute('data-md-open')
    if (id) Modal.instances.get(id)?.open()
  }

  readonly overlay: HTMLElement
  readonly dialog: HTMLElement
  private readonly options: Required<Pick<ModalOptions, 'closeOnBackdrop' | 'closeOnEscape'>> &
    ModalOptions
  private isOpenValue = false
  private returnTarget: HTMLElement | null = null
  private closeTimer: number | null = null

  private onPointerdown = (event: PointerEvent) => {
    if (
      this.isOpenValue &&
      this.options.closeOnBackdrop &&
      Modal.openStack.at(-1) === this &&
      event.target === this.overlay
    ) {
      this.close()
    }
  }

  private onClick = (event: MouseEvent) => {
    if (!this.isOpenValue || Modal.openStack.at(-1) !== this) return
    const target = event.target
    if (
      target instanceof Element &&
      target.closest('[data-md-close]') &&
      this.overlay.contains(target)
    ) {
      this.close()
    }
  }

  constructor(overlay: HTMLElement, options: ModalOptions = {}) {
    const dialog = overlay.querySelector<HTMLElement>('[role="dialog"]')
    if (!dialog) throw new TypeError('The overlay must contain an element with role="dialog".')
    if (!overlay.id) throw new TypeError('The modal overlay must have an id.')

    this.overlay = overlay
    this.dialog = dialog
    this.options = {
      ...options,
      closeOnBackdrop: options.closeOnBackdrop ?? true,
      closeOnEscape: options.closeOnEscape ?? true,
    }
    if (!this.dialog.hasAttribute('tabindex')) this.dialog.tabIndex = -1

    Modal.instances.set(overlay.id, this)
    this.overlay.addEventListener('pointerdown', this.onPointerdown)
    this.overlay.addEventListener('click', this.onClick)
    Modal.installDocumentListeners()
  }

  private static installDocumentListeners() {
    if (Modal.listenersInstalled) return
    document.addEventListener('keydown', Modal.handleDocumentKeydown)
    document.addEventListener('click', Modal.handleDocumentClick)
    Modal.listenersInstalled = true
  }

  private static removeDocumentListenersWhenIdle() {
    if (Modal.instances.size > 0 || !Modal.listenersInstalled) return
    document.removeEventListener('keydown', Modal.handleDocumentKeydown)
    document.removeEventListener('click', Modal.handleDocumentClick)
    Modal.listenersInstalled = false
  }

  private static lockScroll() {
    const root = document.documentElement
    if (Modal.scrollLockCount === 0) {
      Modal.savedScrollStyles = {
        overflow: {
          value: root.style.getPropertyValue('overflow'),
          priority: root.style.getPropertyPriority('overflow'),
        },
        paddingRight: {
          value: root.style.getPropertyValue('padding-right'),
          priority: root.style.getPropertyPriority('padding-right'),
        },
      }
      const scrollbarWidth = Math.max(0, window.innerWidth - root.clientWidth)
      const currentPadding = Number.parseFloat(getComputedStyle(root).paddingRight) || 0
      root.style.setProperty('overflow', 'hidden')
      if (scrollbarWidth > 0)
        root.style.setProperty('padding-right', `${currentPadding + scrollbarWidth}px`)
    }
    Modal.scrollLockCount += 1
  }

  private static unlockScroll() {
    Modal.scrollLockCount = Math.max(0, Modal.scrollLockCount - 1)
    if (Modal.scrollLockCount !== 0 || !Modal.savedScrollStyles) return

    const root = document.documentElement
    for (const [property, saved] of Object.entries({
      overflow: Modal.savedScrollStyles.overflow,
      'padding-right': Modal.savedScrollStyles.paddingRight,
    })) {
      if (saved.value) root.style.setProperty(property, saved.value, saved.priority)
      else root.style.removeProperty(property)
    }
    Modal.savedScrollStyles = null
  }

  private focusableElements() {
    return [...this.dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter((element) => {
      if (
        element.closest('[hidden], [inert], [aria-hidden="true"]') ||
        element.matches(':disabled')
      )
        return false
      const style = getComputedStyle(element)
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        element.getClientRects().length > 0
      )
    })
  }

  open() {
    if (this.isOpenValue) return
    if (this.closeTimer !== null) window.clearTimeout(this.closeTimer)
    this.closeTimer = null
    this.returnTarget =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    this.overlay.hidden = false
    this.overlay.removeAttribute('aria-hidden')
    this.overlay.classList.remove('is-closing')
    this.isOpenValue = true
    Modal.openStack.push(this)
    Modal.lockScroll()
    this.updateStackingOrder()

    window.requestAnimationFrame(() => {
      if (!this.isOpenValue) return
      this.overlay.classList.add('is-open')
      const autofocus = [
        ...this.dialog.querySelectorAll<HTMLElement>('[autofocus], [data-autofocus]'),
      ].find((element) => {
        const style = getComputedStyle(element)
        return (
          !element.matches(':disabled') &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          element.getClientRects().length > 0
        )
      })
      const target = autofocus || this.focusableElements()[0] || this.dialog
      target.focus({ preventScroll: true })
    })

    this.overlay.dispatchEvent(new CustomEvent('modal:open', { bubbles: true }))
    this.options.onOpen?.(this.overlay)
  }

  close() {
    if (!this.isOpenValue) return
    this.isOpenValue = false
    this.overlay.classList.remove('is-open')
    this.overlay.classList.add('is-closing')
    this.overlay.setAttribute('aria-hidden', 'true')
    Modal.openStack = Modal.openStack.filter((modal) => modal !== this)
    this.updateStackingOrder()
    Modal.unlockScroll()

    const returnTarget = this.returnTarget
    this.returnTarget = null
    if (returnTarget?.isConnected) returnTarget.focus({ preventScroll: true })
    this.overlay.dispatchEvent(new CustomEvent('modal:close', { bubbles: true }))
    this.options.onClose?.(this.overlay)

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.finishClose()
    } else {
      this.closeTimer = window.setTimeout(() => this.finishClose(), 210)
    }
  }

  private finishClose() {
    if (!this.isOpenValue) this.overlay.hidden = true
    this.overlay.classList.remove('is-closing')
    this.closeTimer = null
  }

  private updateStackingOrder() {
    Modal.openStack.forEach((modal, index) => {
      modal.overlay.style.zIndex = String(2_147_483_000 + index)
    })
    if (!this.isOpenValue) this.overlay.style.removeProperty('z-index')
  }

  private _onKeydown(event: KeyboardEvent) {
    if (!this.isOpenValue) return
    if (event.key === 'Escape' && this.options.closeOnEscape) {
      event.preventDefault()
      this.close()
      return
    }
    if (event.key !== 'Tab') return

    const focusable = this.focusableElements()
    if (focusable.length === 0) {
      event.preventDefault()
      this.dialog.focus()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (
      event.shiftKey &&
      (document.activeElement === first || !this.dialog.contains(document.activeElement))
    ) {
      event.preventDefault()
      last.focus()
    } else if (
      !event.shiftKey &&
      (document.activeElement === last || !this.dialog.contains(document.activeElement))
    ) {
      event.preventDefault()
      first.focus()
    }
  }

  isOpen() {
    return this.isOpenValue
  }

  destroy() {
    if (this.isOpenValue) this.close()
    if (this.closeTimer !== null) {
      window.clearTimeout(this.closeTimer)
      this.finishClose()
    }
    this.overlay.removeEventListener('pointerdown', this.onPointerdown)
    this.overlay.removeEventListener('click', this.onClick)
    if (Modal.instances.get(this.overlay.id) === this) Modal.instances.delete(this.overlay.id)
    Modal.openStack = Modal.openStack.filter((modal) => modal !== this)
    this.overlay.style.removeProperty('z-index')
    Modal.removeDocumentListenersWhenIdle()
  }
}

export interface ModalOverlayProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onOpen' | 'onClose'
> {
  onOpen?: ModalOptions['onOpen']
  onClose?: ModalOptions['onClose']
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
  children: ReactNode
}

/** Renders the modal overlay at document level and connects it to the shared Modal controller. */
export function ModalOverlay({
  id,
  className = '',
  onOpen,
  onClose,
  closeOnBackdrop,
  closeOnEscape,
  children,
  ...attributes
}: ModalOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const optionsRef = useRef({ onOpen, onClose, closeOnBackdrop, closeOnEscape })
  useEffect(() => {
    optionsRef.current = { onOpen, onClose, closeOnBackdrop, closeOnEscape }
  }, [onOpen, onClose, closeOnBackdrop, closeOnEscape])

  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    const modal = new Modal(overlay, {
      onOpen: (element) => optionsRef.current.onOpen?.(element),
      onClose: (element) => optionsRef.current.onClose?.(element),
      get closeOnBackdrop() {
        return optionsRef.current.closeOnBackdrop ?? true
      },
      get closeOnEscape() {
        return optionsRef.current.closeOnEscape ?? true
      },
    })
    return () => modal.destroy()
  }, [])

  const overlay = (
    <div
      {...attributes}
      ref={overlayRef}
      id={id}
      className={`md-overlay ${className}`.trim()}
      hidden
    >
      {children}
    </div>
  )

  return typeof document === 'undefined' ? null : createPortal(overlay, document.body)
}
