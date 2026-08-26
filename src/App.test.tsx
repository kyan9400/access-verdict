import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('Access Verdict workbench', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('renders an allowed request and a passing scenario suite', () => {
    render(<App />)

    expect(screen.getByText('5/5')).toBeInTheDocument()
    expect(screen.getAllByText('allow').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Evaluation trace' })).toBeInTheDocument()
  })

  it('updates the decision when the principal changes', async () => {
    const user = userEvent.setup()
    render(<App />)

    const principal = screen.getByLabelText('Principal')
    await user.clear(principal)
    await user.type(principal, 'visitor')

    expect(screen.getAllByText('deny').length).toBeGreaterThan(0)
  })

  it('loads a scenario into the request console', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Finance exports an EU ledger/i }))

    expect(screen.getByLabelText('Principal')).toHaveValue('noor')
    expect(screen.getByLabelText('Action')).toHaveValue('invoice:export')
  })
})
