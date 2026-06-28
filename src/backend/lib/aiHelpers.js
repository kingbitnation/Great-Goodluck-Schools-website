const { completeChat, parseJsonResponse } = require('./aiClient')
const { buildExamInstructions } = require('./cbtHelpers')

function aiEnabledForUser(user, subscription) {
  if (user?.role === 'SuperAdmin') return true
  const features = subscription?.plan?.features
  if (typeof features === 'object' && features !== null) {
    return !!features.ai
  }
  return false
}

function demoLessonPlan({ topic, subjectName, className, duration, gradeLevel }) {
  const mins = Number(duration) || 45
  const objectives = [
    `Explain key concepts of ${topic}`,
    `Apply ${topic} knowledge to classroom exercises`,
    `Evaluate understanding through formative assessment`,
  ]
  const activities = [
    { title: 'Warm-up', duration: 5, description: `Quick recap and vocabulary for ${topic}.` },
    { title: 'Direct instruction', duration: Math.round(mins * 0.4), description: `Teacher-led explanation with worked examples on ${topic}.` },
    { title: 'Guided practice', duration: Math.round(mins * 0.35), description: 'Students work in pairs on structured problems.' },
    { title: 'Plenary', duration: Math.round(mins * 0.15), description: 'Exit ticket and summary of learning outcomes.' },
  ]
  const homework = `Read your ${subjectName || 'subject'} notes on ${topic} and complete practice questions 1–5.`
  const content = [
    `# Lesson Plan: ${topic}`,
    '',
    `**Subject:** ${subjectName || 'General'} | **Class:** ${className || 'N/A'} | **Duration:** ${mins} min`,
    gradeLevel ? `**Level:** ${gradeLevel}` : '',
    '',
    '## Learning Objectives',
    ...objectives.map((o, i) => `${i + 1}. ${o}`),
    '',
    '## Lesson Flow',
    ...activities.map((a) => `### ${a.title} (${a.duration} min)\n${a.description}`),
    '',
    '## Homework',
    homework,
    '',
    '## Materials',
    '- Whiteboard / projector',
    '- Student workbooks',
    `- Handout on ${topic}`,
  ]
    .filter(Boolean)
    .join('\n')

  return { objectives, activities, homework, materials: ['Whiteboard', 'Workbooks', 'Handout'], content }
}

function demoExamQuestions(topic, count = 5) {
  const questions = []
  for (let i = 1; i <= count; i++) {
    const correct = `Option B — core idea of ${topic}`
    questions.push({
      questionText: `(${i}) Which statement best describes ${topic}?`,
      questionType: 'multiple_choice',
      options: [
        `Option A — unrelated concept`,
        correct,
        `Option C — partial misunderstanding`,
        `Option D — opposite of the truth`,
      ],
      correctAnswer: correct,
      marks: 2,
    })
  }
  return questions
}

function demoMarkingSuggestion({ answerText, maxMarks, rubric }) {
  const text = String(answerText || '')
  const max = Number(maxMarks) || 10
  const lengthScore = Math.min(max, Math.round((text.length / 120) * max))
  const hasStructure = /\n|\.|because|therefore|example/i.test(text)
  const marks = Math.max(1, Math.min(max, lengthScore + (hasStructure ? 2 : 0)))
  const pct = Math.round((marks / max) * 100)
  return {
    suggestedMarks: marks,
    suggestedFeedback: [
      `Demo marking (${pct}%):`,
      marks >= max * 0.7
        ? 'Good effort — answer shows understanding of key points.'
        : 'Expand your answer with definitions, examples, and clearer structure.',
      rubric ? `Rubric note: ${rubric}` : '',
      text.length < 40 ? 'Try to write at least a short paragraph.' : '',
    ]
      .filter(Boolean)
      .join(' '),
  }
}

function demoTutorReply(message, context = {}) {
  const q = String(message || '').toLowerCase()
  const topic = context.topic || context.subject || 'your subject'
  if (q.includes('homework') || q.includes('assignment')) {
    return `For homework on ${topic}: break the task into steps, restate the question in your own words, then check your work against the marking criteria. What part are you stuck on?`
  }
  if (q.includes('exam') || q.includes('test')) {
    return `Exam tip for ${topic}: review past topics, practise timed questions, and note formulas or key terms on a one-page summary sheet.`
  }
  if (q.includes('study') || q.includes('plan')) {
    return `Study plan suggestion: 25-minute focused blocks on ${topic}, 5-minute breaks, and end each block with one practice question without notes.`
  }
  return `Great question about ${topic}! Start with the core definition, add one example, and explain why it matters. Tell me what you already know and I will help fill the gaps.`
}

async function generateLessonPlan(input) {
  const { topic, subjectName, className, duration, gradeLevel } = input
  const systemPrompt =
    'You are an expert K-12 curriculum designer. Return valid JSON only with keys: objectives (string[]), activities ({title,duration,description}[]), homework (string), materials (string[]), content (markdown string).'
  const userPrompt = `Create a lesson plan for topic "${topic}", subject "${subjectName || 'General'}", class "${className || 'N/A'}", duration ${duration || 45} minutes${gradeLevel ? `, level ${gradeLevel}` : ''}.`

  const { text, provider } = await completeChat({
    systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    jsonMode: true,
  })

  const parsed = parseJsonResponse(text)
  if (parsed?.objectives && parsed?.content) {
    return { ...parsed, provider }
  }

  return { ...demoLessonPlan(input), provider: provider === 'openai' ? 'demo-fallback' : 'demo' }
}

async function generateExamQuestions(input) {
  const { topic, subjectName, className, questionCount, difficulty } = input
  const count = Math.min(20, Math.max(3, Number(questionCount) || 5))
  const systemPrompt =
    'You are an exam setter. Return JSON: { questions: [{ questionText, questionType: "multiple_choice", options: string[4], correctAnswer, marks }] }. MCQ only unless asked otherwise.'
  const userPrompt = `Generate ${count} ${difficulty || 'medium'} MCQ questions on "${topic}" for ${subjectName || 'subject'}, class ${className || 'N/A'}.`

  const { text, provider } = await completeChat({
    systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    jsonMode: true,
  })

  const parsed = parseJsonResponse(text)
  if (parsed?.questions?.length) {
    return { questions: parsed.questions, provider }
  }

  return { questions: demoExamQuestions(topic, count), provider: provider === 'openai' ? 'demo-fallback' : 'demo' }
}

async function generateMarkingSuggestion(input) {
  const { answerText, questionText, maxMarks, rubric } = input
  const systemPrompt =
    'You are a fair teacher grader. Return JSON: { suggestedMarks: number, suggestedFeedback: string }.'
  const userPrompt = `Question: ${questionText || 'N/A'}\nMax marks: ${maxMarks || 10}\nRubric: ${rubric || 'Accuracy, clarity, examples'}\nStudent answer:\n${answerText}`

  const { text, provider } = await completeChat({
    systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    jsonMode: true,
  })

  const parsed = parseJsonResponse(text)
  if (parsed?.suggestedFeedback) {
    return {
      suggestedMarks: Number(parsed.suggestedMarks) || 0,
      suggestedFeedback: parsed.suggestedFeedback,
      provider,
    }
  }

  return { ...demoMarkingSuggestion(input), provider: provider === 'openai' ? 'demo-fallback' : 'demo' }
}

async function generateAssignment(input) {
  const { topic, subjectName, className, totalMarks, type } = input
  const systemPrompt =
    'Return JSON: { title, instructions, tasks: string[], markingCriteria: string[] } for a school assignment.'
  const userPrompt = `Create a ${type || 'written'} assignment on "${topic}" for ${subjectName || 'subject'}, class ${className || 'N/A'}, total marks ${totalMarks || 20}.`

  const { text, provider } = await completeChat({
    systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    jsonMode: true,
  })

  const parsed = parseJsonResponse(text)
  if (parsed?.title && parsed?.instructions) {
    return { ...parsed, provider }
  }

  return {
    title: `${topic} — ${subjectName || 'Assignment'}`,
    instructions: `Complete the following tasks on ${topic}. Show all working and cite examples where required.`,
    tasks: [
      `Define ${topic} in your own words.`,
      `Give two real-world examples related to ${topic}.`,
      `Solve the practice problems provided in class.`,
    ],
    markingCriteria: ['Accuracy (40%)', 'Clarity (30%)', 'Examples (30%)'],
    provider: 'demo',
  }
}

async function generateTutorReply(session, userMessage) {
  const history = session.messages.slice(-8).map((m) => ({ role: m.role, content: m.content }))
  const context = session.context || {}
  const systemPrompt = `You are a helpful, age-appropriate AI tutor for a school ERP. Be concise, encouraging, and never give full answers to graded homework — guide the student. Context: ${JSON.stringify(context)}`

  const { text, provider } = await completeChat({
    systemPrompt,
    messages: [...history, { role: 'user', content: userMessage }],
  })

  if (text) return { reply: text, provider }
  return { reply: demoTutorReply(userMessage, context), provider: 'demo' }
}

async function generateParentSummary(prisma, { studentId, schoolId }) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      user: true,
      class: true,
      results: { where: { published: true }, include: { subject: true }, take: 10 },
      attendance: { orderBy: { date: 'desc' }, take: 14 },
    },
  })
  if (!student || student.schoolId !== schoolId) return null

  const present = student.attendance.filter((a) => a.status === 'Present').length
  const totalAtt = student.attendance.length
  const avg =
    student.results.length > 0
      ? (student.results.reduce((s, r) => s + r.totalScore, 0) / student.results.length).toFixed(1)
      : 'N/A'

  const facts = {
    studentName: `${student.user.firstName} ${student.user.lastName}`,
    class: student.class?.name,
    recentResults: student.results.map((r) => `${r.subject.name}: ${r.totalScore}%`),
    attendanceRate: totalAtt ? `${Math.round((present / totalAtt) * 100)}% present (last ${totalAtt} records)` : 'No recent attendance',
    averageScore: avg,
  }

  const systemPrompt = 'Write a warm, professional weekly parent summary in 2–3 short paragraphs based on the facts provided. JSON: { summary: string, highlights: string[], concerns: string[] }'
  const { text, provider } = await completeChat({
    systemPrompt,
    messages: [{ role: 'user', content: JSON.stringify(facts) }],
    jsonMode: true,
  })

  const parsed = parseJsonResponse(text)
  if (parsed?.summary) return { ...parsed, facts, provider }

  return {
    summary: `${facts.studentName} is in ${facts.class || 'class'}. Recent average score is ${facts.averageScore}. ${facts.attendanceRate}. Keep encouraging regular study habits and review published results together.`,
    highlights: facts.recentResults.length ? facts.recentResults : ['Steady participation in class'],
    concerns: Number(avg) < 50 && avg !== 'N/A' ? ['Consider extra support in weaker subjects'] : [],
    facts,
    provider: 'demo',
  }
}

async function publishGeneratedExamToCbt(prisma, draft, user, resolveTeacherId) {
  const teacherId = await resolveTeacherId(prisma, user)
  if (!teacherId) throw new Error('No teacher profile found')

  const start = new Date()
  const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const questions = Array.isArray(draft.questions) ? draft.questions : []

  const exam = await prisma.exam.create({
    data: {
      schoolId: draft.schoolId,
      classId: draft.classId,
      subjectId: draft.subjectId,
      teacherId,
      name: draft.title,
      type: 'CBT',
      startDate: start,
      endDate: end,
      duration: 60,
      totalMarks: questions.reduce((s, q) => s + (Number(q.marks) || 1), 0) || 100,
      instructions: buildExamInstructions(`AI-generated: ${draft.topic || draft.title}`, 40, 1),
      randomizeQuestions: true,
      randomizeOptions: true,
      published: false,
    },
  })

  for (const q of questions) {
    const options = q.options || []
    const correct = q.correctAnswer || options[0]
    await prisma.question.create({
      data: {
        examId: exam.id,
        type: 'MCQ',
        content: q.questionText || q.content || 'Question',
        mark: Number(q.marks) || 1,
        correctAnswer: correct,
        options: {
          create: options.map((text, i) => ({
            label: String.fromCharCode(65 + i),
            text,
            isCorrect: text === correct,
          })),
        },
      },
    })
  }

  await prisma.aiGeneratedExam.update({
    where: { id: draft.id },
    data: { examId: exam.id, status: 'published' },
  })

  return exam
}

function lessonPlanToMarkdown(plan) {
  if (plan.content) return plan.content
  const lines = [
    `# ${plan.topic}`,
    '',
    '## Objectives',
    ...(Array.isArray(plan.objectives) ? plan.objectives.map((o, i) => `${i + 1}. ${o}`) : []),
    '',
    '## Activities',
    ...(Array.isArray(plan.activities)
      ? plan.activities.map((a) => `- **${a.title}** (${a.duration} min): ${a.description}`)
      : []),
    '',
    '## Homework',
    plan.homework || '',
  ]
  return lines.join('\n')
}

module.exports = {
  aiEnabledForUser,
  generateLessonPlan,
  generateExamQuestions,
  generateMarkingSuggestion,
  generateAssignment,
  generateTutorReply,
  generateParentSummary,
  publishGeneratedExamToCbt,
  lessonPlanToMarkdown,
  demoTutorReply,
}
