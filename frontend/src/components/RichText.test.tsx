import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RichText } from './RichText'

describe('RichText', () => {
  it('renders a drying height as underlined digit plus small decimal', () => {
    render(<p>{<RichText text={'Tiefenangabe 2̲₃. Was bedeutet das?'} />}</p>)
    expect(screen.getByText('2')).toHaveClass('underline')
    expect(screen.getByText('3').tagName).toBe('SUB')
    expect(document.body).toHaveTextContent('Tiefenangabe 23. Was bedeutet das?')
  })

  it('leaves other text untouched', () => {
    render(<p>{<RichText text="Nord- und Ostsee" />}</p>)
    expect(document.body).toHaveTextContent('Nord- und Ostsee')
  })
})
