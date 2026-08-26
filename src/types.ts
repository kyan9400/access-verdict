export type Effect = 'allow' | 'deny'
export type DecisionValue = 'allow' | 'deny'
export type ConditionOperator = 'equals' | 'not_equals' | 'in' | 'exists'

export interface Condition {
  key: string
  operator: ConditionOperator
  value: string
}

export interface Rule {
  id: string
  name: string
  description: string
  effect: Effect
  enabled: boolean
  principals: string[]
  actions: string[]
  resources: string[]
  conditions: Condition[]
}

export interface Policy {
  name: string
  defaultDecision: 'deny'
  rules: Rule[]
}

export interface AccessRequest {
  principal: string
  groups: string[]
  action: string
  resource: string
  context: Record<string, string>
}

export interface CheckResult {
  key: 'principal' | 'action' | 'resource' | 'conditions'
  matched: boolean
  detail: string
}

export interface EvaluationStep {
  ruleId: string
  ruleName: string
  effect: Effect
  matched: boolean
  checks: CheckResult[]
}

export interface EvaluationResult {
  decision: DecisionValue
  decisiveRuleId: string | null
  defaulted: boolean
  matchedRuleIds: string[]
  trace: EvaluationStep[]
}

export interface Scenario {
  id: string
  name: string
  request: AccessRequest
  expected: DecisionValue
}

export interface Workspace {
  schemaVersion: 1
  policy: Policy
  request: AccessRequest
  scenarios: Scenario[]
}

export interface ScenarioResult extends Scenario {
  actual: DecisionValue
  passed: boolean
  decisiveRuleId: string | null
}
