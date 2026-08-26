import { describe, expect, it } from 'vitest'
import { sampleWorkspace } from '../data/sample'
import type { Policy } from '../types'
import { evaluate, runScenarios } from './evaluate'

describe('authorization evaluation', () => {
  it('matches wildcard actions and resources', () => {
    const result = evaluate(sampleWorkspace.policy, sampleWorkspace.request)

    expect(result.decision).toBe('allow')
    expect(result.decisiveRuleId).toBe('allow-maya-team-docs')
    expect(result.defaulted).toBe(false)
  })

  it('gives an explicit deny precedence over an allow', () => {
    const policy: Policy = {
      name: 'precedence',
      defaultDecision: 'deny',
      rules: [
        {
          id: 'allow-all',
          name: 'Allow all',
          description: 'Broad grant',
          effect: 'allow',
          enabled: true,
          principals: ['*'],
          actions: ['*'],
          resources: ['*'],
          conditions: [],
        },
        {
          id: 'deny-delete',
          name: 'Deny deletes',
          description: 'Deletion guard',
          effect: 'deny',
          enabled: true,
          principals: ['*'],
          actions: ['document:delete'],
          resources: ['records/*'],
          conditions: [],
        },
      ],
    }

    const result = evaluate(policy, {
      principal: 'admin',
      groups: [],
      action: 'document:delete',
      resource: 'records/42',
      context: {},
    })

    expect(result.decision).toBe('deny')
    expect(result.matchedRuleIds).toEqual(['allow-all', 'deny-delete'])
    expect(result.decisiveRuleId).toBe('deny-delete')
  })

  it('uses default deny when no rule matches', () => {
    const request = {
      principal: 'unknown',
      groups: [],
      action: 'record:read',
      resource: 'vault/private',
      context: {},
    }

    expect(evaluate(sampleWorkspace.policy, request)).toMatchObject({
      decision: 'deny',
      defaulted: true,
      decisiveRuleId: null,
    })
  })

  it('evaluates context membership and existence', () => {
    const policy: Policy = {
      name: 'conditions',
      defaultDecision: 'deny',
      rules: [
        {
          id: 'regional',
          name: 'Regional access',
          description: 'Requires region and ticket',
          effect: 'allow',
          enabled: true,
          principals: ['group:ops'],
          actions: ['service:read'],
          resources: ['services/*'],
          conditions: [
            { key: 'region', operator: 'in', value: 'eu,us' },
            { key: 'ticket', operator: 'exists', value: '' },
          ],
        },
      ],
    }

    const allowed = evaluate(policy, {
      principal: 'sam',
      groups: ['ops'],
      action: 'service:read',
      resource: 'services/api',
      context: { region: 'eu', ticket: 'INC-42' },
    })
    const denied = evaluate(policy, {
      principal: 'sam',
      groups: ['ops'],
      action: 'service:read',
      resource: 'services/api',
      context: { region: 'apac', ticket: 'INC-42' },
    })

    expect(allowed.decision).toBe('allow')
    expect(denied.decision).toBe('deny')
  })

  it('keeps the example scenario contract green', () => {
    const scenarios = runScenarios(sampleWorkspace.policy, sampleWorkspace.scenarios)

    expect(scenarios).toHaveLength(5)
    expect(scenarios.every((scenario) => scenario.passed)).toBe(true)
  })
})
