const {
  schoolScope,
  assertExamTenant,
  shuffleArray,
  parseExamMeta,
  buildExamInstructions,
  mapQuestionType,
  formatQuestion,
  formatExam,
  buildStudentQuestions,
  gradeAnswers,
  recalcExamResult,
} = require('../lib/cbtHelpers')

async function resolveTeacherId(prisma, user) {
  if (user.role === 'Teacher') {
    const teacher = await prisma.teacher.findUnique({ where: { userId: user.userId || user.id } })
    return teacher?.id || null
  }
  if (user.role === 'SuperAdmin' || user.role === 'SchoolAdmin') {
    const teacher = await prisma.teacher.findFirst({
      where: user.schoolId ? { schoolId: user.schoolId } : {},
    })
    if (teacher) return teacher.id
  }
  return null
}

async function resolveStudentId(prisma, userId) {
  const student = await prisma.student.findUnique({ where: { userId } })
  return student?.id || null
}

async function loadExam(prisma, id) {
  return prisma.exam.findUnique({
    where: { id },
    include: {
      subject: true,
      class: true,
      questions: { include: { options: { orderBy: { label: 'asc' } } } },
      _count: { select: { questions: true } },
    },
  })
}

function formatBankItem(item) {
  return {
    id: item.id,
    bankId: item.bankId,
    questionText: item.content,
    questionType:
      item.type === 'MCQ' ? 'multiple_choice' : item.type === 'TrueFalse' ? 'true_false' : 'short_answer',
    options: item.options?.map((o) => o.text) || [],
    correctAnswer: item.correctAnswer || item.options?.find((o) => o.isCorrect)?.text || '',
    marks: item.mark,
  }
}

function registerCbtRoutes(app, { prisma, requireRole }) {
  const staffRoles = ['SuperAdmin', 'SchoolAdmin', 'Teacher']

  app.get('/api/cbt/question-banks', requireRole(...staffRoles), async (req, res) => {
    try {
      const scope = schoolScope(req.user)
      const banks = await prisma.questionBank.findMany({
        where: scope.schoolId ? { schoolId: scope.schoolId } : {},
        include: {
          subject: { select: { name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      res.json(
        banks.map((b) => ({
          id: b.id,
          name: b.name,
          description: b.description,
          subjectId: b.subjectId,
          subjectName: b.subject?.name,
          itemCount: b._count.items,
          createdAt: b.createdAt,
        }))
      )
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/cbt/question-banks', requireRole(...staffRoles), async (req, res) => {
    try {
      const { name, description, subjectId } = req.body
      if (!name) return res.status(400).json({ error: 'Name required' })
      const schoolId = req.user.role === 'SuperAdmin' ? req.body.schoolId : req.user.schoolId
      if (!schoolId) return res.status(400).json({ error: 'School context required' })

      const bank = await prisma.questionBank.create({
        data: { schoolId, name, description: description || null, subjectId: subjectId || null },
      })
      res.status(201).json(bank)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/cbt/question-banks/:id/items', requireRole(...staffRoles), async (req, res) => {
    try {
      const bank = await prisma.questionBank.findUnique({ where: { id: req.params.id } })
      if (!bank) return res.status(404).json({ error: 'Bank not found' })
      if (!assertExamTenant(req.user, { schoolId: bank.schoolId })) {
        return res.status(403).json({ error: 'Cross-tenant access denied' })
      }
      const items = await prisma.questionBankItem.findMany({
        where: { bankId: bank.id },
        include: { options: { orderBy: { label: 'asc' } } },
        orderBy: { createdAt: 'asc' },
      })
      res.json(items.map(formatBankItem))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/cbt/question-banks/:id/items', requireRole(...staffRoles), async (req, res) => {
    try {
      const bank = await prisma.questionBank.findUnique({ where: { id: req.params.id } })
      if (!bank) return res.status(404).json({ error: 'Bank not found' })
      if (!assertExamTenant(req.user, { schoolId: bank.schoolId })) {
        return res.status(403).json({ error: 'Cross-tenant access denied' })
      }

      const { questionText, questionType, options, correctAnswer, marks } = req.body
      if (!questionText) return res.status(400).json({ error: 'Question text required' })

      const item = await prisma.questionBankItem.create({
        data: {
          bankId: bank.id,
          type: mapQuestionType(questionType),
          content: questionText,
          mark: Number(marks) || 1,
          correctAnswer: correctAnswer || null,
          options: {
            create: (options || []).map((text, i) => ({
              label: String.fromCharCode(65 + i),
              text,
              isCorrect: text === correctAnswer,
            })),
          },
        },
        include: { options: true },
      })
      res.status(201).json(formatBankItem(item))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/cbt/exams/:id/import-bank', requireRole(...staffRoles), async (req, res) => {
    try {
      const exam = await loadExam(prisma, req.params.id)
      if (!exam) return res.status(404).json({ error: 'Exam not found' })
      if (!assertExamTenant(req.user, exam)) return res.status(403).json({ error: 'Forbidden' })

      const { bankId, itemIds } = req.body
      if (!bankId) return res.status(400).json({ error: 'bankId required' })

      const bank = await prisma.questionBank.findUnique({
        where: { id: bankId },
        include: {
          items: {
            where: itemIds?.length ? { id: { in: itemIds } } : undefined,
            include: { options: true },
          },
        },
      })
      if (!bank) return res.status(404).json({ error: 'Bank not found' })

      let imported = 0
      for (const item of bank.items) {
        await prisma.question.create({
          data: {
            examId: exam.id,
            type: item.type,
            content: item.content,
            mark: item.mark,
            correctAnswer: item.correctAnswer,
            options: {
              create: item.options.map((o) => ({
                label: o.label,
                text: o.text,
                isCorrect: o.isCorrect,
              })),
            },
          },
        })
        imported++
      }

      res.json({ imported })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/cbt/exams', requireRole(...staffRoles), async (req, res) => {
    try {
      const scope = schoolScope(req.user)
      const exams = await prisma.exam.findMany({
        where: {
          type: 'CBT',
          ...(scope.schoolId ? { schoolId: scope.schoolId } : {}),
        },
        include: {
          subject: true,
          class: true,
          _count: { select: { questions: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      res.json(exams.map(formatExam))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/cbt/exams/:id', requireRole(...staffRoles, 'Student'), async (req, res) => {
    try {
      const exam = await prisma.exam.findUnique({
        where: { id: req.params.id },
        include: { subject: true, class: true, _count: { select: { questions: true } } },
      })
      if (!exam) return res.status(404).json({ error: 'Exam not found' })
      if (!assertExamTenant(req.user, exam)) return res.status(403).json({ error: 'Forbidden' })
      res.json(formatExam(exam))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/cbt/exams', requireRole(...staffRoles), async (req, res) => {
    try {
      const {
        title,
        description,
        subjectId,
        classId,
        duration,
        passingScore,
        maxAttempts,
        startDate,
        endDate,
        randomizeQuestions,
        randomizeOptions,
        published,
      } = req.body
      const schoolId = req.user.role === 'SuperAdmin' ? req.body.schoolId : req.user.schoolId
      if (!title || !subjectId || !classId || !startDate || !endDate) {
        return res.status(400).json({ error: 'Missing required fields' })
      }

      const teacherId = await resolveTeacherId(prisma, req.user)
      if (!teacherId) return res.status(400).json({ error: 'No teacher profile found for exam creation' })

      const exam = await prisma.exam.create({
        data: {
          schoolId,
          classId,
          subjectId,
          teacherId,
          name: title,
          type: 'CBT',
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          duration: Number(duration) || 60,
          totalMarks: 100,
          instructions: buildExamInstructions(description, passingScore, maxAttempts),
          randomizeQuestions: !!randomizeQuestions,
          randomizeOptions: !!randomizeOptions,
          published: !!published,
        },
        include: { subject: true, class: true, _count: { select: { questions: true } } },
      })
      res.status(201).json(formatExam(exam))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/cbt/exams/:id', requireRole(...staffRoles), async (req, res) => {
    try {
      const exam = await prisma.exam.findUnique({ where: { id: req.params.id } })
      if (!exam) return res.status(404).json({ error: 'Exam not found' })
      if (!assertExamTenant(req.user, exam)) return res.status(403).json({ error: 'Forbidden' })

      const {
        title,
        description,
        subjectId,
        classId,
        duration,
        passingScore,
        maxAttempts,
        startDate,
        endDate,
        status,
        randomizeQuestions,
        randomizeOptions,
        published,
      } = req.body
      const isPublished = published ?? (status === 'active' || status === 'completed')

      const updated = await prisma.exam.update({
        where: { id: exam.id },
        data: {
          name: title ?? undefined,
          subjectId: subjectId ?? undefined,
          classId: classId ?? undefined,
          duration: duration != null ? Number(duration) : undefined,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          instructions: buildExamInstructions(
            description ?? parseExamMeta(exam.instructions).description,
            passingScore ?? parseExamMeta(exam.instructions).passingScore,
            maxAttempts ?? parseExamMeta(exam.instructions).maxAttempts
          ),
          randomizeQuestions: randomizeQuestions != null ? !!randomizeQuestions : undefined,
          randomizeOptions: randomizeOptions != null ? !!randomizeOptions : undefined,
          published: isPublished,
        },
        include: { subject: true, class: true, _count: { select: { questions: true } } },
      })
      res.json(formatExam(updated))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/cbt/exams/:id', requireRole(...staffRoles), async (req, res) => {
    try {
      const exam = await prisma.exam.findUnique({ where: { id: req.params.id } })
      if (!exam) return res.status(404).json({ error: 'Exam not found' })
      if (!assertExamTenant(req.user, exam)) return res.status(403).json({ error: 'Forbidden' })
      await prisma.exam.delete({ where: { id: exam.id } })
      res.json({ message: 'Exam deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/cbt/available-exams', requireRole('Student'), async (req, res) => {
    try {
      const student = await prisma.student.findUnique({ where: { userId: req.user.userId || req.user.id } })
      if (!student) return res.json([])

      const now = new Date()
      const exams = await prisma.exam.findMany({
        where: {
          type: 'CBT',
          published: true,
          schoolId: student.schoolId,
          ...(student.classId ? { classId: student.classId } : {}),
          startDate: { lte: now },
          endDate: { gte: now },
        },
        include: { subject: true, _count: { select: { questions: true } } },
        orderBy: { startDate: 'asc' },
      })
      res.json(exams.map(formatExam))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/cbt/my-results', requireRole('Student'), async (req, res) => {
    try {
      const studentId = await resolveStudentId(prisma, req.user.userId || req.user.id)
      if (!studentId) return res.json([])

      const results = await prisma.result.findMany({
        where: { studentId, exam: { type: 'CBT' } },
        include: { exam: { include: { subject: true, _count: { select: { questions: true } } } } },
        orderBy: { createdAt: 'desc' },
      })

      res.json(
        results.map((r) => {
          const exam = formatExam(r.exam)
          const meta = parseExamMeta(r.exam.instructions)
          const percentage = r.totalScore
          return {
            id: r.id,
            examId: r.examId,
            exam,
            score: r.totalScore,
            totalMarks: r.exam.totalMarks,
            percentage,
            passed: percentage >= meta.passingScore,
            grade: r.grade,
            submittedAt: r.createdAt,
          }
        })
      )
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/cbt/exams/:id/start', requireRole('Student'), async (req, res) => {
    try {
      const studentId = await resolveStudentId(prisma, req.user.userId || req.user.id)
      if (!studentId) return res.status(400).json({ error: 'Student profile not found' })

      const exam = await loadExam(prisma, req.params.id)
      if (!exam || exam.type !== 'CBT') return res.status(404).json({ error: 'Exam not found' })
      if (!exam.published) return res.status(403).json({ error: 'Exam not published' })

      const now = new Date()
      if (now < new Date(exam.startDate) || now > new Date(exam.endDate)) {
        return res.status(403).json({ error: 'Exam not available at this time' })
      }

      const existingResult = await prisma.result.findUnique({
        where: { examId_studentId: { examId: exam.id, studentId } },
      })
      if (existingResult?.published) {
        return res.status(400).json({ error: 'You have already completed this exam' })
      }

      let attempt = await prisma.examAttempt.findUnique({
        where: { examId_studentId: { examId: exam.id, studentId } },
      })

      if (attempt?.status === 'submitted') {
        return res.status(400).json({ error: 'Exam already submitted' })
      }

      if (!attempt) {
        const questionIds = exam.randomizeQuestions
          ? shuffleArray(exam.questions.map((q) => q.id))
          : exam.questions.map((q) => q.id)

        const optionOrder = {}
        if (exam.randomizeOptions) {
          for (const q of exam.questions) {
            if (q.type === 'MCQ' || q.type === 'TrueFalse') {
              optionOrder[q.id] = shuffleArray(q.options.map((o) => o.text))
            }
          }
        }

        const expiresAt = new Date(now.getTime() + exam.duration * 60 * 1000)
        attempt = await prisma.examAttempt.create({
          data: {
            examId: exam.id,
            studentId,
            expiresAt,
            questionOrder: questionIds,
            optionOrder,
          },
        })
      }

      if (new Date() > new Date(attempt.expiresAt) && attempt.status !== 'submitted') {
        await prisma.examAttempt.update({
          where: { id: attempt.id },
          data: { status: 'expired' },
        })
        return res.status(403).json({ error: 'Exam time has expired' })
      }

      const questions = buildStudentQuestions(exam, attempt)
      const examInfo = formatExam(exam)

      res.json({
        attempt: {
          id: attempt.id,
          startedAt: attempt.startedAt,
          expiresAt: attempt.expiresAt,
          tabSwitchCount: attempt.tabSwitchCount,
          status: attempt.status,
        },
        exam: examInfo,
        questions,
        secondsRemaining: Math.max(
          0,
          Math.floor((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000)
        ),
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/cbt/exams/:id/violation', requireRole('Student'), async (req, res) => {
    try {
      const studentId = await resolveStudentId(prisma, req.user.userId || req.user.id)
      if (!studentId) return res.status(400).json({ error: 'Student profile not found' })

      const attempt = await prisma.examAttempt.findUnique({
        where: { examId_studentId: { examId: req.params.id, studentId } },
      })
      if (!attempt || attempt.status !== 'in_progress') {
        return res.status(400).json({ error: 'No active attempt' })
      }

      const updated = await prisma.examAttempt.update({
        where: { id: attempt.id },
        data: { tabSwitchCount: { increment: 1 } },
      })
      res.json({ tabSwitchCount: updated.tabSwitchCount })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/cbt/questions', requireRole(...staffRoles), async (req, res) => {
    try {
      const { examId } = req.query
      if (!examId) return res.status(400).json({ error: 'examId required' })

      const exam = await prisma.exam.findUnique({ where: { id: String(examId) } })
      if (!exam) return res.status(404).json({ error: 'Exam not found' })
      if (!assertExamTenant(req.user, exam)) return res.status(403).json({ error: 'Forbidden' })

      const questions = await prisma.question.findMany({
        where: { examId: String(examId) },
        include: { options: { orderBy: { label: 'asc' } } },
        orderBy: { id: 'asc' },
      })
      res.json(questions.map((q) => formatQuestion(q)))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/cbt/questions', requireRole(...staffRoles), async (req, res) => {
    try {
      const { examId, questionText, questionType, options, correctAnswer, marks } = req.body
      if (!examId || !questionText) return res.status(400).json({ error: 'Missing fields' })

      const exam = await prisma.exam.findUnique({ where: { id: examId } })
      if (!exam) return res.status(404).json({ error: 'Exam not found' })
      if (!assertExamTenant(req.user, exam)) return res.status(403).json({ error: 'Forbidden' })

      const type = mapQuestionType(questionType)
      const question = await prisma.question.create({
        data: {
          examId,
          type,
          content: questionText,
          mark: Number(marks) || 1,
          correctAnswer: correctAnswer || null,
          options: {
            create: (options || []).map((text, i) => ({
              label: String.fromCharCode(65 + i),
              text,
              isCorrect: text === correctAnswer,
            })),
          },
        },
        include: { options: true },
      })
      res.status(201).json(formatQuestion(question))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/cbt/questions/:id', requireRole(...staffRoles), async (req, res) => {
    try {
      const existing = await prisma.question.findUnique({
        where: { id: req.params.id },
        include: { exam: true },
      })
      if (!existing) return res.status(404).json({ error: 'Question not found' })
      if (!assertExamTenant(req.user, existing.exam)) return res.status(403).json({ error: 'Forbidden' })

      const { questionText, questionType, options, correctAnswer, marks } = req.body
      await prisma.questionOption.deleteMany({ where: { questionId: req.params.id } })

      const question = await prisma.question.update({
        where: { id: req.params.id },
        data: {
          type: mapQuestionType(questionType),
          content: questionText,
          mark: Number(marks) || 1,
          correctAnswer: correctAnswer || null,
          options: {
            create: (options || []).map((text, i) => ({
              label: String.fromCharCode(65 + i),
              text,
              isCorrect: text === correctAnswer,
            })),
          },
        },
        include: { options: true },
      })
      res.json(formatQuestion(question))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/cbt/questions/:id', requireRole(...staffRoles), async (req, res) => {
    try {
      const existing = await prisma.question.findUnique({
        where: { id: req.params.id },
        include: { exam: true },
      })
      if (!existing) return res.status(404).json({ error: 'Question not found' })
      if (!assertExamTenant(req.user, existing.exam)) return res.status(403).json({ error: 'Forbidden' })
      await prisma.question.delete({ where: { id: req.params.id } })
      res.json({ message: 'Question deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/cbt/exams/:id/submit', requireRole('Student'), async (req, res) => {
    try {
      const studentId = await resolveStudentId(prisma, req.user.userId || req.user.id)
      if (!studentId) return res.status(400).json({ error: 'Student profile not found' })

      const exam = await loadExam(prisma, req.params.id)
      if (!exam) return res.status(404).json({ error: 'Exam not found' })

      const attempt = await prisma.examAttempt.findUnique({
        where: { examId_studentId: { examId: exam.id, studentId } },
      })
      if (!attempt) return res.status(400).json({ error: 'Start the exam before submitting' })
      if (attempt.status === 'submitted') return res.status(400).json({ error: 'Already submitted' })

      const now = new Date()
      if (now > new Date(attempt.expiresAt)) {
        await prisma.examAttempt.update({ where: { id: attempt.id }, data: { status: 'expired' } })
        return res.status(403).json({ error: 'Exam time expired' })
      }

      const { answers = {} } = req.body
      const { score, totalMarks } = await gradeAnswers(prisma, exam, studentId, answers)
      const outcome = await recalcExamResult(prisma, exam, studentId)

      await prisma.examAttempt.update({
        where: { id: attempt.id },
        data: { status: 'submitted', submittedAt: now },
      })

      res.json({
        score,
        totalMarks,
        percentage: outcome.percentage,
        passed: outcome.passed,
        pendingManual: outcome.pendingManual,
        resultId: outcome.result.id,
        tabSwitchCount: attempt.tabSwitchCount,
        message: outcome.pendingManual
          ? 'Submitted — some answers await manual grading.'
          : outcome.passed
            ? 'Congratulations! You passed.'
            : 'You did not meet the passing score.',
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/cbt/exams/:id/submissions', requireRole(...staffRoles), async (req, res) => {
    try {
      const exam = await loadExam(prisma, req.params.id)
      if (!exam) return res.status(404).json({ error: 'Exam not found' })
      if (!assertExamTenant(req.user, exam)) return res.status(403).json({ error: 'Forbidden' })

      const answers = await prisma.examAnswer.findMany({
        where: {
          examId: exam.id,
          OR: [{ autoGraded: false }, { marksObtained: null }],
        },
        include: {
          student: { include: { user: { select: { firstName: true, lastName: true } } } },
          question: true,
        },
        orderBy: { submittedAt: 'desc' },
      })
      res.json(answers)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/cbt/answers/:id/grade', requireRole(...staffRoles), async (req, res) => {
    try {
      const answer = await prisma.examAnswer.findUnique({
        where: { id: req.params.id },
        include: { exam: { include: { questions: true } }, question: true },
      })
      if (!answer) return res.status(404).json({ error: 'Answer not found' })
      if (!assertExamTenant(req.user, answer.exam)) return res.status(403).json({ error: 'Forbidden' })

      const marks = Number(req.body.marks)
      if (Number.isNaN(marks) || marks < 0 || marks > answer.question.mark) {
        return res.status(400).json({ error: 'Invalid marks' })
      }

      await prisma.examAnswer.update({
        where: { id: answer.id },
        data: { marksObtained: marks, autoGraded: false },
      })

      const outcome = await recalcExamResult(prisma, answer.exam, answer.studentId)
      res.json(outcome)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/cbt/exams/:id/rankings', requireRole(...staffRoles), async (req, res) => {
    try {
      const exam = await prisma.exam.findUnique({ where: { id: req.params.id } })
      if (!exam) return res.status(404).json({ error: 'Exam not found' })
      if (!assertExamTenant(req.user, exam)) return res.status(403).json({ error: 'Forbidden' })

      const results = await prisma.result.findMany({
        where: { examId: exam.id, published: true },
        include: {
          student: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { totalScore: 'desc' },
      })

      const attempts = await prisma.examAttempt.findMany({
        where: { examId: exam.id },
        select: { studentId: true, tabSwitchCount: true, submittedAt: true },
      })
      const attemptMap = Object.fromEntries(attempts.map((a) => [a.studentId, a]))

      res.json(
        results.map((r, index) => ({
          rank: index + 1,
          studentId: r.studentId,
          studentName: `${r.student.user.firstName} ${r.student.user.lastName}`,
          score: r.totalScore,
          grade: r.grade,
          tabSwitchCount: attemptMap[r.studentId]?.tabSwitchCount ?? 0,
          submittedAt: attemptMap[r.studentId]?.submittedAt || r.createdAt,
        }))
      )
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })
}

module.exports = { registerCbtRoutes }
