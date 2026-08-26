import { beforeEach, describe, expect, it } from 'vitest'
import { sampleWorkspace } from '../data/sample'
import {
  STORAGE_KEY,
  loadWorkspace,
  normalizeWorkspace,
  parseWorkspace,
  saveWorkspace,
  serializeWorkspace,
} from './storage'

describe('workspace persistence', () => {
  beforeEach(() => window.localStorage.clear())

  it('round-trips a versioned workspace', () => {
    expect(saveWorkspace(sampleWorkspace)).toBe(true)

    expect(loadWorkspace()).toEqual(sampleWorkspace)
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual(sampleWorkspace)
  })

  it('imports the exported representation', () => {
    expect(parseWorkspace(serializeWorkspace(sampleWorkspace))).toEqual(sampleWorkspace)
  })

  it('rejects unknown schemas and duplicate rule ids', () => {
    expect(() => normalizeWorkspace({ ...sampleWorkspace, schemaVersion: 2 })).toThrow('schema')
    const duplicate = JSON.parse(JSON.stringify(sampleWorkspace))
    duplicate.policy.rules[1].id = duplicate.policy.rules[0].id

    expect(() => normalizeWorkspace(duplicate)).toThrow('unique')
  })

  it('falls back to the sample when storage is malformed', () => {
    window.localStorage.setItem(STORAGE_KEY, '{broken')

    expect(loadWorkspace()).toEqual(sampleWorkspace)
  })
})
