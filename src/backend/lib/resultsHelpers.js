function calculateGrade(score) {
  const s = Number(score)
  if (Number.isNaN(s)) return 'F'
  if (s >= 90) return 'A+'
  if (s >= 80) return 'A'
  if (s >= 70) return 'B'
  if (s >= 60) return 'C'
  if (s >= 50) return 'D'
  return 'F'
}

function calculateGPA(grade) {
  const gpaMap = { 'A+': 4.0, A: 4.0, B: 3.5, C: 2.5, D: 1.5, F: 0.0, Pass: 4.0, Fail: 0.0 }
  return gpaMap[grade] ?? 0.0
}

function summarizeResults(results) {
  const published = results.filter((r) => r.published !== false)
  const list = published.length ? published : results
  const total = list.length
  const averageScore = total
    ? (list.reduce((sum, r) => sum + Number(r.totalScore || 0), 0) / total).toFixed(1)
    : '0'
  const averageGPA = total
    ? (list.reduce((sum, r) => sum + Number(r.gpa || calculateGPA(r.grade)), 0) / total).toFixed(2)
    : '0.00'
  return {
    totalSubjects: total,
    averageScore,
    averageGrade: total ? calculateGrade(Number(averageScore)) : 'N/A',
    totalGPA: averageGPA,
  }
}

function buildBroadsheet(students, subjects, results, { publishedOnly = true } = {}) {
  const filtered = publishedOnly ? results.filter((r) => r.published) : results
  const subjectList = subjects.map((s) => ({ id: s.id, name: s.name, code: s.code }))

  const rows = students.map((student) => {
    const studentResults = filtered.filter((r) => r.studentId === student.id)
    const scores = {}
    for (const sub of subjectList) {
      const match = studentResults.find((r) => r.subjectId === sub.id)
      scores[sub.id] = match
        ? { score: match.totalScore, grade: match.grade, gpa: match.gpa }
        : null
    }
    const values = studentResults.map((r) => Number(r.totalScore || 0))
    const average = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
    return {
      studentId: student.id,
      admissionNo: student.admissionNo,
      name: `${student.user.firstName} ${student.user.lastName}`,
      scores,
      average: Number(average.toFixed(1)),
      grade: calculateGrade(average),
      gpa: calculateGPA(calculateGrade(average)),
    }
  })

  rows.sort((a, b) => b.average - a.average)
  rows.forEach((row, i) => {
    row.rank = i + 1
  })

  return { subjects: subjectList, rows }
}

module.exports = {
  calculateGrade,
  calculateGPA,
  summarizeResults,
  buildBroadsheet,
}
