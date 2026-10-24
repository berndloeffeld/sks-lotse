import { afterEach, describe, expect, it, vi } from 'vitest'

import exported from '../data/sbf_navigation.gen.json'
import { navigationSource, navigationTask, taskMaxPoints, typoFix } from './navigationCatalog'
import { navigationExportFixture } from './navigationFixture'

describe('navigationCatalog', () => {
  afterEach(() => navigationSource.reset())

  it('finds a task by number and counts one point per subtask', () => {
    const data = navigationExportFixture()
    expect(navigationTask(data, 2)?.number).toBe(2)
    expect(navigationTask(data, 3)).toBeNull()
    expect(taskMaxPoints(data.tasks[0])).toBe(3)
  })

  it('names a corrected typo with its official text', () => {
    const data = navigationExportFixture()
    expect(typoFix(data, 1, 1, 'result')?.official).toBe('rwk = 079°')
    expect(typoFix(data, 1, 1, 'text')).toBeNull()
    expect(typoFix(data, 2, 1, 'result')).toBeNull()
  })

  it('loads the export only in a build with the Navigationsaufgaben', async () => {
    await expect(navigationSource.load()).rejects.toThrow('nicht enthalten')
    vi.stubEnv('VITE_SBF', 'on')
    const data = await navigationSource.load()
    expect(data.tasks).toHaveLength(15)
    expect(data.pass_points).toBe(7)
  })

  it('exports 15 tasks of 9 subtasks, passed from 7', () => {
    expect(exported.tasks.map((task) => task.subtasks.length)).toEqual(Array(15).fill(9))
  })
})
