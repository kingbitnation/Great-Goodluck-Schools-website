const { tenantWhere } = require('../middleware/tenantGuard')

function schoolScope(user) {
  return tenantWhere(user)
}

function assertExamTenant(user, exam) {
  if (user.role === 'SuperAdmin') return true
  if (!exam.schoolId) return true
  return exam.schoolId === user.schoolId
}

function shuffleArray(items) {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function parseExamMeta(instructions) {
  if (!instructions) {
    return { description: '', passingScore: 40, maxAttempts: 1 }
  }
  try {
    const parsed = JSON.parse(instructions)
    return {
      description: parsed.description || '',
      passingScore: parsed.passingScore ?? 40,
      maxAttempts: parsed.maxAttempts ?? 1,
    }
  } catch {
    return { description: instructions, passingScore: 40, maxAttempts: 1 }
  }
}

function buildExamInstructions(description, passingScore, maxAttempts = 1) {
  return JSON.stringify({
    description: description || '',
    passingScore: passingScore ?? 40,
    maxAttempts: maxAttempts ?? 1,
  })
}

function examStatus(exam) {
  const now = new Date()
  if (!exam.published) return 'draft'
  if (now < new Date(exam.startDate)) return 'draft'
  if (now > new Date(exam.endDate)) return 'completed'
  return 'active'
}

function mapQuestionType(type) {
  const map = {
    multiple_choice: 'MCQ',
    true_false: 'TrueFalse',
    short_answer: 'ShortAnswer',
  }
  return map[type] || 'MCQ'
}

function reverseQuestionType(type) {
  const map = {
    MCQ: 'multiple_choice',
    TrueFalse: 'true_false',
    ShortAnswer: 'short_answer',
    Essay: 'short_answer',
  }
  return map[type] || 'multiple_choice'
}

function formatQuestion(question, { includeAnswers = true } = {}) {
  const options = question.options?.map((o) => o.text) || []
  return {
    id: question.id,
    examId: question.examId,
    questionText: question.content,
    questionType: reverseQuestionType(question.type),
    options,
    correctAnswer: includeAnswers
      ? question.correctAnswer || question.options?.find((o) => o.isCorrect)?.text || ''
      : undefined,
    marks: question.mark,
  }
}

function formatExam(exam) {
  const meta = parseExamMeta(exam.instructions)
  return {
    id: exam.id,
    title: exam.name,
    description: meta.description,
    subjectId: exam.subjectId,
    subject: exam.subject,
    classId: exam.classId,
    class: exam.class,
    totalQuestions: exam._count?.questions ?? exam.questions?.length ?? 0,
    duration: exam.duration,
    passingScore: meta.passingScore,
    maxAttempts: meta.maxAttempts,
    randomizeQuestions: exam.randomizeQuestions,
    randomizeOptions: exam.randomizeOptions,
    startDate: exam.startDate,
    endDate: exam.endDate,
    status: examStatus(exam),
    published: exam.published,
    createdAt: exam.createdAt,
  }
}

function buildStudentQuestions(exam, attempt) {
  let questions = [...(exam.questions || [])]
  const questionOrder = attempt?.questionOrder
  if (Array.isArray(questionOrder) && questionOrder.length) {
    const map = Object.fromEntries(questions.map((q) => [q.id, q]))
    questions = questionOrder.map((id) => map[id]).filter(Boolean)
  } else if (exam.randomizeQuestions) {
    questions = shuffleArray(questions)
  }

  const optionOrder = attempt?.optionOrder || {}
  return questions.map((q) => {
    const formatted = formatQuestion(q, { includeAnswers: false })
    if (q.type === 'MCQ' || q.type === 'TrueFalse') {
      const order = optionOrder[q.id]
      if (Array.isArray(order) && order.length) {
        formatted.options = order
      } else if (exam.randomizeOptions) {
        formatted.options = shuffleArray(formatted.options)
      }
    }
    if (q.type === 'ShortAnswer' || q.type === 'Essay') {
      formatted.options = []
    }
    return formatted
  })
}

async function gradeAnswers(prisma, exam, studentId, answers) {
  let score = 0
  let totalMarks = 0
  const graded = []

  for (const question of exam.questions) {
    totalMarks += question.mark
    const answer = answers[question.id]
    let marksObtained = 0
    let autoGraded = false

    if (question.type === 'MCQ' || question.type === 'TrueFalse') {
      const correct = question.options.find((o) => o.isCorrect)
      if (answer && correct && answer === correct.text) {
        marksObtained = question.mark
        score += question.mark
      }
      autoGraded = true
    } else if (question.correctAnswer && answer) {
      const normalized = String(answer).trim().toLowerCase()
      const expected = String(question.correctAnswer).trim().toLowerCase()
      if (normalized === expected) {
        marksObtained = question.mark
        score += question.mark
        autoGraded = true
      }
    }

    const row = await prisma.examAnswer.upsert({
      where: {
        examId_studentId_questionId: {
          examId: exam.id,
          studentId,
          questionId: question.id,
        },
      },
      update: {
        answerText: answer || null,
        selectedOption: answer || null,
        marksObtained: autoGraded ? marksObtained : undefined,
        autoGraded,
        submittedAt: new Date(),
      },
      create: {
        examId: exam.id,
        studentId,
        questionId: question.id,
        answerText: answer || null,
        selectedOption: answer || null,
        marksObtained: autoGraded ? marksObtained : null,
        autoGraded,
        submittedAt: new Date(),
      },
    })
    graded.push(row)
  }

  return { score, totalMarks, graded }
}

async function recalcExamResult(prisma, exam, studentId) {
  const answers = await prisma.examAnswer.findMany({
    where: { examId: exam.id, studentId },
  })
  const score = answers.reduce((s, a) => s + (a.marksObtained || 0), 0)
  const totalMarks = exam.questions.reduce((s, q) => s + q.mark, 0)
  const meta = parseExamMeta(exam.instructions)
  const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0
  const passed = percentage >= meta.passingScore
  const pendingManual = answers.some((a) => !a.autoGraded && a.marksObtained == null)

  const result = await prisma.result.upsert({
    where: { examId_studentId: { examId: exam.id, studentId } },
    update: {
      totalScore: percentage,
      grade: pendingManual ? 'Pending' : passed ? 'Pass' : 'Fail',
      published: !pendingManual,
      publishedAt: pendingManual ? null : new Date(),
    },
    create: {
      examId: exam.id,
      studentId,
      subjectId: exam.subjectId,
      totalScore: percentage,
      grade: pendingManual ? 'Pending' : passed ? 'Pass' : 'Fail',
      published: !pendingManual,
      publishedAt: pendingManual ? null : new Date(),
    },
  })

  return { score, totalMarks, percentage, passed, pendingManual, result }
}

module.exports = {
  schoolScope,
  assertExamTenant,
  shuffleArray,
  parseExamMeta,
  buildExamInstructions,
  examStatus,
  mapQuestionType,
  reverseQuestionType,
  formatQuestion,
  formatExam,
  buildStudentQuestions,
  gradeAnswers,
  recalcExamResult,
}
