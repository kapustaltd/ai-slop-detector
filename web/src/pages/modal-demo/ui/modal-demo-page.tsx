import type { FormEvent } from 'react'

import { ModalOverlay } from '@/shared/ui'

function showStatus(id: string, message: string) {
  const status = document.getElementById(id)
  if (status) status.textContent = message
}

export function ModalDemoPage() {
  function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    if (!form.reportValidity()) return
    const values = new FormData(form)
    const email = String(values.get('email') ?? '').trim()
    showStatus('invite-status', `Invitation ready for ${email}.`)
  }

  return (
    <main className="md-demo-page">
      <div className="md-demo-shell">
        <p className="md-demo-eyebrow">Interface patterns · 02</p>
        <h1>Thoughtful dialogs for focused work.</h1>
        <p className="md-demo-intro">
          A small, accessible modal system for the moments that need a clear decision. Explore a
          lightweight form and a destructive confirmation, both powered by the same zero-dependency
          controller.
        </p>

        <section aria-label="Modal dialog demonstrations" className="md-demo-grid">
          <article className="md-demo-card">
            <div className="md-card-index">
              <span>01</span> Collect information
            </div>
            <h2>Invite a teammate</h2>
            <p>
              Gather the details you need, keep the task contained, and return focus to the invite
              action when it’s done.
            </p>
            <div className="md-card-bottom">
              <span className="md-demo-meta">
                <span aria-hidden="true" />
                Form dialog · focus trap
              </span>
              <button className="md-launch-button" data-md-open="invite-dialog" type="button">
                Open invite form <span aria-hidden="true">→</span>
              </button>
            </div>
          </article>

          <article className="md-demo-card">
            <div className="md-card-index">
              <span>02</span> Confirm a change
            </div>
            <h2>Remove a project</h2>
            <p>
              Make irreversible actions explicit, explain what changes, and place the safest choice
              within easy reach.
            </p>
            <div className="md-card-bottom">
              <span className="md-demo-meta">
                <span aria-hidden="true" />
                Destructive dialog · Escape
              </span>
              <button className="md-launch-button" data-md-open="delete-dialog" type="button">
                Review removal <span aria-hidden="true">→</span>
              </button>
            </div>
          </article>
        </section>

        <section aria-label="Accessibility features" className="md-feature-strip">
          <div>
            <strong>Keyboard first</strong>
            <span>Visible focus, contained tab order, and Escape to close.</span>
          </div>
          <div>
            <strong>Page stays in place</strong>
            <span>Scroll is locked and original spacing is restored.</span>
          </div>
          <div>
            <strong>Motion aware</strong>
            <span>Transitions respect reduced-motion preferences.</span>
          </div>
        </section>

        <section aria-label="Page content" className="md-demo-page-note">
          <span className="md-note-mark" aria-hidden="true">
            N
          </span>
          <div>
            <strong>Workspace settings</strong>
            <span>Page content stays still while a dialog is open.</span>
          </div>
          <span className="md-note-status">
            <i aria-hidden="true" />
            All changes saved
          </span>
        </section>
      </div>

      <ModalOverlay id="invite-dialog">
        <section
          aria-describedby="invite-description"
          aria-labelledby="invite-title"
          aria-modal="true"
          className="md-dialog"
          role="dialog"
          tabIndex={-1}
        >
          <header className="md-dialog-header">
            <h2 className="md-dialog-title" id="invite-title">
              Invite a teammate
            </h2>
            <button aria-label="Close dialog" className="md-close" data-md-close type="button">
              ×
            </button>
          </header>
          <p className="md-dialog-description" id="invite-description">
            Add someone to your workspace. They’ll receive an email with a link to join your team.
          </p>
          <form className="md-form" onSubmit={handleInvite}>
            <div className="md-field">
              <label htmlFor="invite-email">Email address</label>
              <input
                autoComplete="email"
                data-autofocus
                id="invite-email"
                name="email"
                placeholder="alex@company.com"
                required
                type="email"
              />
            </div>
            <div className="md-field">
              <label htmlFor="invite-role">Workspace role</label>
              <select defaultValue="member" id="invite-role" name="role">
                <option value="member">Member · can collaborate</option>
                <option value="admin">Admin · can manage workspace</option>
                <option value="viewer">Viewer · read only</option>
              </select>
            </div>
            <p className="md-helper">
              You can change this person’s role anytime in workspace settings.
            </p>
            <p aria-live="polite" className="md-status" id="invite-status" role="status" />
            <footer className="md-dialog-footer">
              <button className="md-button md-button-ghost" data-md-close type="button">
                Cancel
              </button>
              <button className="md-button md-button-primary" type="submit">
                Send invitation
              </button>
            </footer>
          </form>
        </section>
      </ModalOverlay>

      <ModalOverlay id="delete-dialog">
        <section
          aria-describedby="delete-description"
          aria-labelledby="delete-title"
          aria-modal="true"
          className="md-dialog"
          role="dialog"
          tabIndex={-1}
        >
          <header className="md-dialog-header">
            <span aria-hidden="true" />
            <button aria-label="Close dialog" className="md-close" data-md-close type="button">
              ×
            </button>
          </header>
          <div aria-hidden="true" className="md-danger-art">
            !
          </div>
          <h2 className="md-dialog-title" id="delete-title">
            Remove this project?
          </h2>
          <p className="md-dialog-description md-delete-description" id="delete-description">
            This will permanently remove the project and its associated data from your workspace.
            This action can’t be undone.
          </p>
          <div className="md-record-row">
            <span aria-hidden="true" className="md-record-icon">
              A
            </span>
            <div>
              <strong>Atlas mobile redesign</strong>
              <span>Project · 12 members · Updated yesterday</span>
            </div>
          </div>
          <p aria-live="polite" className="md-status" id="delete-status" role="status" />
          <footer className="md-dialog-footer">
            <button className="md-button md-button-ghost" data-md-close type="button">
              Keep project
            </button>
            <button
              className="md-button md-button-danger"
              onClick={() =>
                showStatus('delete-status', 'Project removal confirmed for this demo.')
              }
              type="button"
            >
              Remove project
            </button>
          </footer>
        </section>
      </ModalOverlay>
    </main>
  )
}
