import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  EVENT_ORDINALS,
  emptyTideForm,
  forgetAllTideForms,
  forgetTideForm,
  guestTideFormId,
  loadTideForm,
  storageKey,
  useTideForm,
} from './useTideForm'

describe('emptyTideForm', () => {
  it('has the printed form’s fields: a head and two halves of four high/low waters', () => {
    const form = emptyTideForm()
    expect({ ...form, blocks: undefined }).toEqual({
      referencePort: '',
      secondaryPort: '',
      secondaryPortNumber: '',
      date: '',
      timeZone: '',
      boardTime: '',
      blocks: undefined,
    })
    expect(form.blocks).toHaveLength(2)
    expect(EVENT_ORDINALS).toEqual([1, 1, 2, 2])
    for (const block of form.blocks) {
      expect(block).toMatchObject({ age: '', date: '' })
      expect(block.events).toHaveLength(4)
      expect(block.events[0]).toEqual({
        kind: '',
        reference: { time: '', height: '' },
        difference: { time: '', height: '' },
        secondary: { time: '', height: '' },
        boardTime: '',
      })
    }
  })

  it('gives every half and column its own objects', () => {
    const form = emptyTideForm()
    expect(form.blocks[0]).not.toBe(form.blocks[1])
    expect(form.blocks[0].events[0].reference).not.toBe(form.blocks[0].events[1].reference)
  })
})

describe('loadTideForm', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('keys the stored form by run', () => {
    expect(storageKey(5)).toBe('sks-lotse:tide-form:5')
  })

  it('returns an empty form when nothing is stored', () => {
    expect(loadTideForm(5)).toEqual(emptyTideForm())
  })

  it('returns the stored form', () => {
    const form = emptyTideForm()
    form.referencePort = 'Helgoland'
    window.localStorage.setItem(storageKey(5), JSON.stringify(form))
    expect(loadTideForm(5).referencePort).toBe('Helgoland')
  })

  it.each([
    ['garbage', 'not json'],
    ['null', 'null'],
    ['a different shape', JSON.stringify({ blocks: [] })],
    ['a block without columns', JSON.stringify({ blocks: [{}, {}] })],
    ['too few columns', JSON.stringify({ blocks: [{ events: [] }, { events: [] }] })],
    ['one half with too few columns', JSON.stringify({ blocks: [{ events: [{}, {}, {}, {}] }, { events: [{}] }] })],
  ])('drops %s', (_, stored) => {
    window.localStorage.setItem(storageKey(5), stored)
    expect(loadTideForm(5)).toEqual(emptyTideForm())
  })

  it('forgets a guest’s form, by the sheet’s number', () => {
    expect(guestTideFormId(2)).toBe('guest-2')
    window.localStorage.setItem(storageKey('guest-2'), JSON.stringify(emptyTideForm()))
    window.localStorage.setItem(storageKey('guest-1'), 'kept')
    forgetTideForm('guest-2')
    expect(window.localStorage.getItem(storageKey('guest-2'))).toBeNull()
    expect(window.localStorage.getItem(storageKey('guest-1'))).toBe('kept')
  })

  it('forgets every stored Formblatt and nothing else', () => {
    window.localStorage.setItem(storageKey(7), 'a')
    window.localStorage.setItem(storageKey('guest-1'), 'b')
    window.localStorage.setItem('sks-lotse:other', 'kept')
    window.localStorage.setItem('unrelated', 'kept')

    forgetAllTideForms()

    expect(window.localStorage.getItem(storageKey(7))).toBeNull()
    expect(window.localStorage.getItem(storageKey('guest-1'))).toBeNull()
    expect(window.localStorage.getItem('sks-lotse:other')).toBe('kept')
    expect(window.localStorage.getItem('unrelated')).toBe('kept')
  })

  it('forgets everything quietly when storage throws', () => {
    vi.spyOn(Storage.prototype, 'key').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => forgetAllTideForms()).not.toThrow()
  })

  it('forgets quietly when storage throws', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => forgetTideForm('guest-1')).not.toThrow()
  })

  it('copes with storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(loadTideForm(5)).toEqual(emptyTideForm())
  })
})

describe('useTideForm', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('updates the form and keeps it for this run only', () => {
    const { result } = renderHook(() => useTideForm(5))

    act(() => result.current.update((form) => ({ ...form, referencePort: 'Cuxhaven' })))

    expect(result.current.form.referencePort).toBe('Cuxhaven')
    expect(loadTideForm(5).referencePort).toBe('Cuxhaven')
    expect(loadTideForm(6).referencePort).toBe('')
  })

  it('picks up what was stored for the run', () => {
    const form = emptyTideForm()
    form.date = '04.05.2013'
    window.localStorage.setItem(storageKey(5), JSON.stringify(form))
    const { result } = renderHook(() => useTideForm(5))
    expect(result.current.form.date).toBe('04.05.2013')
  })

  it('clears the form', () => {
    const { result } = renderHook(() => useTideForm(5))
    act(() => result.current.update((form) => ({ ...form, timeZone: 'MESZ' })))

    act(() => result.current.clear())

    expect(result.current.form).toEqual(emptyTideForm())
    expect(loadTideForm(5)).toEqual(emptyTideForm())
  })

  it('still works when storage refuses to save', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full')
    })
    const { result } = renderHook(() => useTideForm(5))

    act(() => result.current.update((form) => ({ ...form, boardTime: 'MESZ' })))

    expect(result.current.form.boardTime).toBe('MESZ')
  })
})

describe('useTideForm as loaded', () => {
  it('has four columns per half, imported afresh so the mutation run sees the constant', async () => {
    vi.resetModules()
    const fresh = await import('./useTideForm')
    expect(fresh.EVENT_ORDINALS).toEqual([1, 1, 2, 2])
    expect(fresh.emptyTideForm().blocks[0].events).toHaveLength(4)
  })
})

describe('useTideForm for another run', () => {
  beforeEach(() => window.localStorage.clear())

  it('saves and clears under the run it is now showing', () => {
    const { result, rerender } = renderHook(({ id }) => useTideForm(id), { initialProps: { id: 1 } })
    rerender({ id: 2 })

    act(() => result.current.update((form) => ({ ...form, referencePort: 'Helgoland' })))
    expect(loadTideForm(2).referencePort).toBe('Helgoland')
    expect(window.localStorage.getItem(storageKey(1))).toBeNull()

    act(() => result.current.clear())
    expect(loadTideForm(2).referencePort).toBe('')
  })
})
