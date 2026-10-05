import { describe, expect, it, vi } from 'vitest'

import { createLazyExport } from './lazyExport'

const double = (n: number) => n * 2

describe('createLazyExport', () => {
  it('has nothing before it is loaded or primed', () => {
    expect(createLazyExport(() => Promise.resolve(1), double).snapshot()).toBeNull()
  })

  it('priming sets the snapshot to the converted value and returns it', () => {
    const source = createLazyExport(() => Promise.resolve(1), double)

    expect(source.prime(4)).toBe(8)
    expect(source.snapshot()).toBe(8)
  })

  it('loads once and converts, sharing one request between concurrent callers', async () => {
    const importRaw = vi.fn(() => Promise.resolve(3))
    const source = createLazyExport(importRaw, double)

    const [a, b] = await Promise.all([source.load(), source.load()])

    expect([a, b]).toEqual([6, 6])
    expect(importRaw).toHaveBeenCalledTimes(1)
    expect(source.snapshot()).toBe(6)
  })

  it('answers from the snapshot without importing again', async () => {
    const importRaw = vi.fn(() => Promise.resolve(3))
    const source = createLazyExport(importRaw, double)
    source.prime(5)

    await expect(source.load()).resolves.toBe(10)
    expect(importRaw).not.toHaveBeenCalled()
  })

  it('uses a loader passed to load() instead of the default', async () => {
    const source = createLazyExport(() => Promise.resolve(1), double)

    await expect(source.load(() => Promise.resolve(7))).resolves.toBe(14)
  })

  it('lets a failed load be retried', async () => {
    const importRaw = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(2)
    const source = createLazyExport(importRaw, double)

    await expect(source.load()).rejects.toThrow('offline')
    expect(source.snapshot()).toBeNull()
    await expect(source.load()).resolves.toBe(4)
  })

  it('forgets what was loaded on reset', async () => {
    const importRaw = vi.fn(() => Promise.resolve(3))
    const source = createLazyExport(importRaw, double)
    await source.load()

    source.reset()

    expect(source.snapshot()).toBeNull()
    await source.load()
    expect(importRaw).toHaveBeenCalledTimes(2)
  })
})
