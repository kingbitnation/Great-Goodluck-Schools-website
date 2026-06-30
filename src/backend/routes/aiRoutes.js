const { tenantWhere } = require('../middleware/tenantGuard')
const { checkTenantAccess } = require('../lib/tenantHelpers')
const { mergeLimits } = require('../lib/planLimits')
const { consumeAiCredit, ensureAiCredits } = require('../lib/platformHelpers')
const {
  aiEnabledForUser,
  generateLessonPlan,
  generateExamQuestions,
  generateMarkingSuggestion,
  generateAssignment,
  generateTutorReply,
  generateParentSummary,
  publishGeneratedExamToCbt,
  lessonPlanToMarkdown,
} = require('../lib/aiHelpers')

async function resolveTeacherId(prisma, user) {
  if (user.role === 'Teacher') {
    const teacher = await prisma.teacher.findUnique({ where: { userId: user.userId || user.id } })
    return teacher?.id || null
  }
  if (user.role === 'SuperAdmin' || user.role === 'SchoolAdmin') {
    const teacher = await prisma.teacher.findFirst({
      where: user.schoolId ? { schoolId: user.schoolId } : {},
    })
    return teacher?.id || null
  }
  return null
}

function registerAiRoutes(app, { prisma, requireRole }) {
  const staffRoles = ['SuperAdmin', 'SchoolAdmin', 'Teacher']
  const studentRoles = ['Student']
  const parentRoles = ['Parent']

  function enforceAi(req, res, next) {
    if (aiEnabledForUser(req.user, req.subscription)) return next()
    return res.status(403).json({
      error: 'AI suite requires a plan with AI enabled',
      code: 'AI_NOT_ENABLED',
    })
  }

  async function enforceAiCredits(req, res, next) {
    if (req.user?.role === 'SuperAdmin') return next()
    const schoolId = req.user?.schoolId
    if (!schoolId) return next()
    try {
      const sub = req.subscription || await prisma.schoolSubscription.findUnique({
        where: { schoolId },
        include: { plan: true },
      })
      const limits = mergeLimits(sub?.plan)
      if (!limits.ai && (limits.aiCredits || 0) <= 0) return next()
      await ensureAiCredits(prisma, schoolId, sub)
      if (process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY) {
        const result = await consumeAiCredit(prisma, schoolId, sub, 1)
        if (!result.ok) {
          return res.status(403).json({
            error: 'Monthly AI credits exhausted — upgrade plan or wait for reset',
            code: 'AI_CREDITS_EXHAUSTED',
            balance: result.balance,
          })
        }
        req.aiCreditsRemaining = result.balance
      }
      next()
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  }

  app.get('/api/ai/status', requireRole(...staffRoles, ...studentRoles, ...parentRoles), async (req, res) => {
    const enabled = aiEnabledForUser(req.user, req.subscription)
    let credits = null
    if (req.user?.schoolId) {
      const sub = req.subscription || await prisma.schoolSubscription.findUnique({
        where: { schoolId: req.user.schoolId },
        include: { plan: true },
      })
      credits = await ensureAiCredits(prisma, req.user.schoolId, sub)
    }
    res.json({
      enabled,
      provider: process.env.OPENROUTER_API_KEY
        ? 'openrouter'
        : process.env.OPENAI_API_KEY
          ? 'openai'
          : 'demo',
      model: process.env.AI_MODEL || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
      plan: req.subscription?.plan?.slug || null,
      credits: credits
        ? { balance: credits.balance, monthlyGrant: credits.monthlyGrant, usedThisMonth: credits.usedThisMonth }
        : null,
    })
  })

  // ===== LESSON PLANS =====
  app.get('/api/ai/lesson-plans', requireRole(...staffRoles), enforceAi, async (req, res) => {
    try {
      const scope = tenantWhere(req.user)
      const plans = await prisma.lessonPlan.findMany({
        where: scope.schoolId ? { schoolId: scope.schoolId } : {},
        include: { subject: true, class: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
      res.json(plans)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/ai/lesson-plans/generate', requireRole(...staffRoles), enforceAi, enforceAiCredits, async (req, res) => {
    try {
      const { topic, subjectId, classId, duration, gradeLevel } = req.body
      if (!topic) return res.status(400).json({ error: 'Topic required' })

      const schoolId = req.user.role === 'SuperAdmin' ? req.body.schoolId : req.user.schoolId
      if (!schoolId) return res.status(400).json({ error: 'School context required' })

      const [subject, classRow] = await Promise.all([
        subjectId ? prisma.subject.findUnique({ where: { id: subjectId } }) : null,
        classId ? prisma.class.findUnique({ where: { id: classId } }) : null,
      ])
      if (subject && !checkTenantAccess(req.user, subject.schoolId, res)) return
      if (classRow && !checkTenantAccess(req.user, classRow.schoolId, res)) return

      const teacherId = await resolveTeacherId(prisma, req.user)
      const generated = await generateLessonPlan({
        topic,
        subjectName: subject?.name,
        className: classRow?.name,
        duration,
        gradeLevel,
      })

      const plan = await prisma.lessonPlan.create({
        data: {
          schoolId,
          teacherId,
          subjectId: subjectId || null,
          classId: classId || null,
          topic,
          gradeLevel: gradeLevel || null,
          duration: duration ? Number(duration) : null,
          objectives: generated.objectives,
          activities: generated.activities,
          homework: generated.homework,
          materials: generated.materials || [],
          content: generated.content,
          createdById: req.user.userId || req.user.id,
        },
        include: { subject: true, class: true },
      })

      res.status(201).json({ plan, provider: generated.provider })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/ai/lesson-plans/:id/export', requireRole(...staffRoles), enforceAi, async (req, res) => {
    try {
      const plan = await prisma.lessonPlan.findUnique({ where: { id: req.params.id } })
      if (!plan) return res.status(404).json({ error: 'Not found' })
      if (!checkTenantAccess(req.user, plan.schoolId, res)) return

      const markdown = lessonPlanToMarkdown(plan)
      const format = req.query.format || 'markdown'
      if (format === 'json') {
        return res.json(plan)
      }
      res.setHeader('Content-Type', 'text/markdown')
      res.setHeader('Content-Disposition', `attachment; filename="lesson-plan-${plan.id}.md"`)
      res.send(markdown)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/ai/lesson-plans/:id', requireRole(...staffRoles), enforceAi, async (req, res) => {
    try {
      const plan = await prisma.lessonPlan.findUnique({ where: { id: req.params.id } })
      if (!plan) return res.status(404).json({ error: 'Not found' })
      if (!checkTenantAccess(req.user, plan.schoolId, res)) return
      await prisma.lessonPlan.delete({ where: { id: plan.id } })
      res.json({ message: 'Deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== EXAM GENERATOR =====
  app.get('/api/ai/exams', requireRole(...staffRoles), enforceAi, async (req, res) => {
    try {
      const scope = tenantWhere(req.user)
      const exams = await prisma.aiGeneratedExam.findMany({
        where: scope.schoolId ? { schoolId: scope.schoolId } : {},
        include: { subject: true, class: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
      res.json(exams)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/ai/exams/generate', requireRole(...staffRoles), enforceAi, enforceAiCredits, async (req, res) => {
    try {
      const { topic, title, subjectId, classId, questionCount, difficulty } = req.body
      if (!topic) return res.status(400).json({ error: 'Topic required' })
      if (!subjectId || !classId) return res.status(400).json({ error: 'Subject and class required' })

      const schoolId = req.user.role === 'SuperAdmin' ? req.body.schoolId : req.user.schoolId
      if (!schoolId) return res.status(400).json({ error: 'School context required' })

      const [subject, classRow] = await Promise.all([
        prisma.subject.findUnique({ where: { id: subjectId } }),
        prisma.class.findUnique({ where: { id: classId } }),
      ])
      if (!subject || !classRow) return res.status(404).json({ error: 'Subject or class not found' })
      if (!checkTenantAccess(req.user, subject.schoolId, res)) return

      const teacherId = await resolveTeacherId(prisma, req.user)
      const generated = await generateExamQuestions({
        topic,
        subjectName: subject.name,
        className: classRow.name,
        questionCount,
        difficulty,
      })

      const draft = await prisma.aiGeneratedExam.create({
        data: {
          schoolId,
          teacherId,
          subjectId,
          classId,
          title: title || `${topic} — AI Exam`,
          topic,
          questions: generated.questions,
          status: 'draft',
        },
        include: { subject: true, class: true },
      })

      res.status(201).json({ exam: draft, provider: generated.provider })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/ai/exams/:id/publish-to-cbt', requireRole(...staffRoles), enforceAi, async (req, res) => {
    try {
      const draft = await prisma.aiGeneratedExam.findUnique({ where: { id: req.params.id } })
      if (!draft) return res.status(404).json({ error: 'Draft not found' })
      if (!checkTenantAccess(req.user, draft.schoolId, res)) return
      if (draft.examId) return res.status(400).json({ error: 'Already published', examId: draft.examId })

      const exam = await publishGeneratedExamToCbt(prisma, draft, req.user, resolveTeacherId)
      res.json({ examId: exam.id, message: 'Published to CBT — add to question bank or publish exam when ready' })
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Publish failed' })
    }
  })

  app.delete('/api/ai/exams/:id', requireRole(...staffRoles), enforceAi, async (req, res) => {
    try {
      const draft = await prisma.aiGeneratedExam.findUnique({ where: { id: req.params.id } })
      if (!draft) return res.status(404).json({ error: 'Not found' })
      if (!checkTenantAccess(req.user, draft.schoolId, res)) return
      await prisma.aiGeneratedExam.delete({ where: { id: draft.id } })
      res.json({ message: 'Deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== MARKING & ASSIGNMENTS =====
  app.post('/api/ai/marking/suggest', requireRole(...staffRoles), enforceAi, enforceAiCredits, async (req, res) => {
    try {
      const { resourceType, resourceId, answerText, questionText, maxMarks, rubric } = req.body
      const schoolId = req.user.schoolId
      if (!schoolId && req.user.role !== 'SuperAdmin') {
        return res.status(400).json({ error: 'School context required' })
      }

      let text = answerText
      let question = questionText
      let marks = maxMarks

      if (resourceType === 'cbt_answer' && resourceId) {
        const answer = await prisma.examAnswer.findUnique({
          where: { id: resourceId },
          include: { question: true, exam: true },
        })
        if (!answer) return res.status(404).json({ error: 'Answer not found' })
        if (!checkTenantAccess(req.user, answer.exam.schoolId, res)) return
        text = answer.answerText || answer.selectedOption || ''
        question = answer.question.content
        marks = answer.question.mark
      } else if (resourceType === 'lms_submission' && resourceId) {
        const sub = await prisma.lmsAssignmentSubmission.findUnique({
          where: { id: resourceId },
          include: { assignment: { include: { course: true } } },
        })
        if (!sub) return res.status(404).json({ error: 'Submission not found' })
        if (!checkTenantAccess(req.user, sub.assignment.course.schoolId, res)) return
        text = sub.textAnswer || sub.fileUrl || ''
        question = sub.assignment.title
        marks = sub.assignment.totalMarks
      } else if (resourceType === 'submission' && resourceId) {
        const sub = await prisma.submission.findUnique({
          where: { id: resourceId },
          include: { assignment: { include: { subject: true } } },
        })
        if (!sub) return res.status(404).json({ error: 'Submission not found' })
        text = sub.fileUrl || ''
        question = sub.assignment.title
        marks = sub.assignment.totalMarks
      }

      if (!text) return res.status(400).json({ error: 'No answer text to mark' })

      const teacherId = await resolveTeacherId(prisma, req.user)
      if (!teacherId) return res.status(400).json({ error: 'Teacher profile required' })

      const suggestion = await generateMarkingSuggestion({
        answerText: text,
        questionText: question,
        maxMarks: marks,
        rubric,
      })

      const saved = await prisma.aiMarkingSuggestion.create({
        data: {
          schoolId: schoolId || req.body.schoolId,
          teacherId,
          resourceType: resourceType || 'manual',
          resourceId: resourceId || `manual-${Date.now()}`,
          suggestedMarks: suggestion.suggestedMarks,
          suggestedFeedback: suggestion.suggestedFeedback,
        },
      })

      res.json({ suggestion: saved, provider: suggestion.provider })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/ai/assignments/generate', requireRole(...staffRoles), enforceAi, enforceAiCredits, async (req, res) => {
    try {
      const { topic, subjectId, classId, totalMarks, type } = req.body
      if (!topic) return res.status(400).json({ error: 'Topic required' })

      const subject = subjectId ? await prisma.subject.findUnique({ where: { id: subjectId } }) : null
      const classRow = classId ? await prisma.class.findUnique({ where: { id: classId } }) : null
      if (subject && !checkTenantAccess(req.user, subject.schoolId, res)) return

      const generated = await generateAssignment({
        topic,
        subjectName: subject?.name,
        className: classRow?.name,
        totalMarks,
        type,
      })

      res.json(generated)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== CHAT (tutor / homework / study planner) =====
  app.get('/api/ai/chat/sessions', requireRole(...staffRoles, ...studentRoles), enforceAi, async (req, res) => {
    try {
      const userId = req.user.userId || req.user.id
      const { type } = req.query
      const sessions = await prisma.aiChatSession.findMany({
        where: {
          userId,
          ...(type ? { type: String(type) } : {}),
        },
        orderBy: { updatedAt: 'desc' },
        take: 30,
      })
      res.json(sessions)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/ai/chat/sessions', requireRole(...staffRoles, ...studentRoles), enforceAi, async (req, res) => {
    try {
      const { type, title, context } = req.body
      if (!type) return res.status(400).json({ error: 'Session type required' })

      const schoolId = req.user.schoolId
      if (!schoolId && req.user.role !== 'SuperAdmin') {
        return res.status(400).json({ error: 'School context required' })
      }

      const session = await prisma.aiChatSession.create({
        data: {
          schoolId: schoolId || req.body.schoolId,
          userId: req.user.userId || req.user.id,
          type,
          title: title || `${type} session`,
          context: context || {},
        },
      })
      res.status(201).json(session)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/ai/chat/sessions/:id', requireRole(...staffRoles, ...studentRoles), enforceAi, async (req, res) => {
    try {
      const session = await prisma.aiChatSession.findUnique({
        where: { id: req.params.id },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      })
      if (!session) return res.status(404).json({ error: 'Session not found' })
      const userId = req.user.userId || req.user.id
      if (session.userId !== userId && req.user.role !== 'SuperAdmin') {
        return res.status(403).json({ error: 'Forbidden' })
      }
      if (!checkTenantAccess(req.user, session.schoolId, res)) return
      res.json(session)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/ai/chat/sessions/:id/messages', requireRole(...staffRoles, ...studentRoles), enforceAi, enforceAiCredits, async (req, res) => {
    try {
      const { content } = req.body
      if (!content) return res.status(400).json({ error: 'Message required' })

      const session = await prisma.aiChatSession.findUnique({
        where: { id: req.params.id },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      })
      if (!session) return res.status(404).json({ error: 'Session not found' })
      const userId = req.user.userId || req.user.id
      if (session.userId !== userId && req.user.role !== 'SuperAdmin') {
        return res.status(403).json({ error: 'Forbidden' })
      }

      await prisma.aiChatMessage.create({
        data: { sessionId: session.id, role: 'user', content },
      })

      const { reply, provider } = await generateTutorReply(
        { ...session, messages: [...session.messages, { role: 'user', content }] },
        content
      )

      const assistantMsg = await prisma.aiChatMessage.create({
        data: { sessionId: session.id, role: 'assistant', content: reply },
      })

      await prisma.aiChatSession.update({
        where: { id: session.id },
        data: { updatedAt: new Date() },
      })

      res.json({ message: assistantMsg, provider })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== PARENT SUMMARY =====
  app.post('/api/ai/parent/summary', requireRole(...parentRoles, ...staffRoles), enforceAi, enforceAiCredits, async (req, res) => {
    try {
      const { studentId } = req.body
      if (!studentId) return res.status(400).json({ error: 'studentId required' })

      const student = await prisma.student.findUnique({ where: { id: studentId } })
      if (!student) return res.status(404).json({ error: 'Student not found' })
      if (!checkTenantAccess(req.user, student.schoolId, res)) return

      if (req.user.role === 'Parent') {
        const parent = await prisma.parent.findUnique({
          where: { userId: req.user.userId || req.user.id },
          include: { children: { select: { id: true } } },
        })
        if (!parent?.children.some((c) => c.id === studentId)) {
          return res.status(403).json({ error: 'Forbidden' })
        }
      }

      const summary = await generateParentSummary(prisma, {
        studentId,
        schoolId: student.schoolId,
      })
      if (!summary) return res.status(404).json({ error: 'Could not build summary' })

      res.json(summary)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })
}

module.exports = { registerAiRoutes }
