const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  parseExamMeta,
  buildExamInstructions,
  examStatus,
  mapQuestionType,
  reverseQuestionType,
} = require('../../src/backend/lib/cbtHelpers')

describe('cbtHelpers', () => {
  it('parseExamMeta reads JSON instructions', () => {
    const meta = parseExamMeta(
      JSON.stringify({ description: 'Mid-term', passingScore: 50, maxAttempts: 2 })
    )
    assert.equal(meta.description, 'Mid-term')
    assert.equal(meta.passingScore, 50)
    assert.equal(meta.maxAttempts, 2)
  })

  it('buildExamInstructions round-trips metadata', () => {
    const raw = buildExamInstructions('Final', 60, 3)
    const meta = parseExamMeta(raw)
    assert.equal(meta.description, 'Final')
    assert.equal(meta.passingScore, 60)
    assert.equal(meta.maxAttempts, 3)
  })

  it('examStatus detects active window', () => {
    const exam = {
      published: true,
      startDate: new Date('2020-01-01'),
      endDate: new Date('2030-01-01'),
    }
    assert.equal(examStatus(exam), 'active')
  })

  it('maps question types both ways', () => {
    assert.equal(mapQuestionType('multiple_choice'), 'MCQ')
    assert.equal(reverseQuestionType('MCQ'), 'multiple_choice')
  })
})
