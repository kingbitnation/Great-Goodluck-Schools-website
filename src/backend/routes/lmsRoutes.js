const { streamCourseCertificate } = require('../lib/lmsCertificatePdf')
const {
  schoolScope,
  getStudentRecord,
  getTeacherRecord,
  assertCourseTenant,
  countCourseLessons,
  recalcEnrollmentProgress,
  ensureEnrollment,
  issueCertificateIfComplete,
  formatCourseSummary,
} = require('../lib/lmsHelpers')

const courseInclude = {
  modules: {
    orderBy: { sortOrder: 'asc' },
    include: { lessons: { orderBy: { sortOrder: 'asc' } } },
  },
  subject: { select: { id: true, name: true } },
  class: { select: { id: true, name: true } },
  teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
}

function registerLmsRoutes(app, { prisma, requireRole }) {
  const staffRoles = ['SuperAdmin', 'SchoolAdmin', 'Teacher']
  const learnRoles = [...staffRoles, 'Student']

  async function loadCourse(req, res, next) {
    try {
      const course = await prisma.lmsCourse.findUnique({
        where: { id: req.params.courseId || req.params.id },
        include: courseInclude,
      })
      if (!course) return res.status(404).json({ error: 'Course not found' })
      if (!assertCourseTenant(req.user, course)) {
        return res.status(403).json({ error: 'Cross-tenant access denied' })
      }
      req.lmsCourse = course
      next()
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  }

  // ----- Courses -----
  app.get('/api/lms/courses', requireRole(...learnRoles), async (req, res) => {
    try {
      const scope = schoolScope(req.user)
      const student = await getStudentRecord(prisma, req.user)
      const teacher = await getTeacherRecord(prisma, req.user)
      const where = {
        ...scope,
        ...(req.user.role === 'Student' ? { published: true } : {}),
        ...(req.user.role === 'Teacher' && teacher ? { teacherId: teacher.id } : {}),
      }

      if (student) {
        where.OR = [{ classId: null }, { classId: student.classId }]
      }

      const courses = await prisma.lmsCourse.findMany({
        where,
        include: {
          modules: { include: { lessons: true } },
          _count: { select: { modules: true } },
        },
        orderBy: { createdAt: 'desc' },
      })

      let enrollments = []
      if (student) {
        enrollments = await prisma.lmsEnrollment.findMany({
          where: { studentId: student.id, courseId: { in: courses.map((c) => c.id) } },
        })
      }
      const enrollmentMap = Object.fromEntries(enrollments.map((e) => [e.courseId, e]))

      const result = await Promise.all(
        courses.map(async (course) => {
          const lessonCount = course.modules.reduce((n, m) => n + m.lessons.length, 0)
          return formatCourseSummary(course, enrollmentMap[course.id], lessonCount)
        })
      )
      res.json(result)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/lms/courses', requireRole(...staffRoles), async (req, res) => {
    try {
      const { title, description, thumbnail, subjectId, classId, published, videoUrl } = req.body
      if (!title) return res.status(400).json({ error: 'Title required' })

      const teacher = await getTeacherRecord(prisma, req.user)
      const schoolId = req.user.role === 'SuperAdmin' ? req.body.schoolId : req.user.schoolId
      if (!schoolId) return res.status(400).json({ error: 'School context required' })

      const course = await prisma.lmsCourse.create({
        data: {
          schoolId,
          title,
          description: description || null,
          thumbnail: thumbnail || null,
          subjectId: subjectId || null,
          classId: classId || null,
          teacherId: teacher?.id || null,
          published: !!published,
          publishedAt: published ? new Date() : null,
          ...(videoUrl
            ? {
                modules: {
                  create: {
                    title: 'Module 1',
                    sortOrder: 0,
                    lessons: {
                      create: {
                        title: 'Introduction',
                        type: 'video',
                        resourceUrl: videoUrl,
                        sortOrder: 0,
                      },
                    },
                  },
                },
              }
            : {}),
        },
        include: courseInclude,
      })

      const lessonCount = await countCourseLessons(prisma, course.id)
      res.status(201).json(formatCourseSummary(course, null, lessonCount))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/lms/courses/:id', requireRole(...learnRoles), loadCourse, async (req, res) => {
    try {
      const course = req.lmsCourse
      if (req.user.role === 'Student' && !course.published) {
        return res.status(404).json({ error: 'Course not found' })
      }

      const student = await getStudentRecord(prisma, req.user)
      let enrollment = null
      let lessonProgress = []
      if (student) {
        enrollment = await ensureEnrollment(prisma, course.id, student.id)
        lessonProgress = await prisma.lmsLessonProgress.findMany({
          where: { enrollmentId: enrollment.id },
        })
      }

      const progressMap = Object.fromEntries(lessonProgress.map((p) => [p.lessonId, p]))
      const modules = course.modules.map((mod) => ({
        ...mod,
        lessons: mod.lessons.map((lesson) => ({
          ...lesson,
          completed: !!progressMap[lesson.id]?.completed,
        })),
      }))

      let certificate = null
      if (student) {
        certificate = await prisma.lmsCertificate.findUnique({
          where: { courseId_studentId: { courseId: course.id, studentId: student.id } },
        })
      }

      res.json({
        ...course,
        modules,
        enrollment,
        certificate,
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/lms/courses/:id', requireRole(...staffRoles), loadCourse, async (req, res) => {
    try {
      const { title, description, thumbnail, subjectId, classId, published } = req.body
      const course = await prisma.lmsCourse.update({
        where: { id: req.lmsCourse.id },
        data: {
          title: title ?? undefined,
          description: description ?? undefined,
          thumbnail: thumbnail ?? undefined,
          subjectId: subjectId ?? undefined,
          classId: classId ?? undefined,
          published: published !== undefined ? !!published : undefined,
          publishedAt: published ? new Date() : undefined,
        },
        include: courseInclude,
      })
      const lessonCount = await countCourseLessons(prisma, course.id)
      res.json(formatCourseSummary(course, null, lessonCount))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/lms/courses/:id', requireRole('SuperAdmin', 'SchoolAdmin'), loadCourse, async (req, res) => {
    try {
      await prisma.lmsCourse.delete({ where: { id: req.lmsCourse.id } })
      res.json({ message: 'Course deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ----- Modules -----
  app.post('/api/lms/courses/:courseId/modules', requireRole(...staffRoles), loadCourse, async (req, res) => {
    try {
      const { title, description, sortOrder } = req.body
      if (!title) return res.status(400).json({ error: 'Title required' })
      const mod = await prisma.lmsModule.create({
        data: {
          courseId: req.lmsCourse.id,
          title,
          description: description || null,
          sortOrder: sortOrder ?? 0,
        },
        include: { lessons: true },
      })
      res.status(201).json(mod)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/lms/modules/:id', requireRole(...staffRoles), async (req, res) => {
    try {
      const mod = await prisma.lmsModule.findUnique({
        where: { id: req.params.id },
        include: { course: true },
      })
      if (!mod) return res.status(404).json({ error: 'Module not found' })
      if (!assertCourseTenant(req.user, mod.course)) {
        return res.status(403).json({ error: 'Cross-tenant access denied' })
      }
      const updated = await prisma.lmsModule.update({
        where: { id: mod.id },
        data: {
          title: req.body.title ?? undefined,
          description: req.body.description ?? undefined,
          sortOrder: req.body.sortOrder ?? undefined,
        },
        include: { lessons: { orderBy: { sortOrder: 'asc' } } },
      })
      res.json(updated)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/lms/modules/:id', requireRole(...staffRoles), async (req, res) => {
    try {
      const mod = await prisma.lmsModule.findUnique({
        where: { id: req.params.id },
        include: { course: true },
      })
      if (!mod) return res.status(404).json({ error: 'Module not found' })
      if (!assertCourseTenant(req.user, mod.course)) {
        return res.status(403).json({ error: 'Cross-tenant access denied' })
      }
      await prisma.lmsModule.delete({ where: { id: mod.id } })
      res.json({ message: 'Module deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ----- Lessons -----
  app.post('/api/lms/modules/:moduleId/lessons', requireRole(...staffRoles), async (req, res) => {
    try {
      const mod = await prisma.lmsModule.findUnique({
        where: { id: req.params.moduleId },
        include: { course: true },
      })
      if (!mod) return res.status(404).json({ error: 'Module not found' })
      if (!assertCourseTenant(req.user, mod.course)) {
        return res.status(403).json({ error: 'Cross-tenant access denied' })
      }

      const { title, content, type, resourceUrl, durationMin, sortOrder } = req.body
      if (!title) return res.status(400).json({ error: 'Title required' })

      const lesson = await prisma.lmsLesson.create({
        data: {
          moduleId: mod.id,
          title,
          content: content || null,
          type: type || 'text',
          resourceUrl: resourceUrl || null,
          durationMin: durationMin ?? null,
          sortOrder: sortOrder ?? 0,
        },
      })
      res.status(201).json(lesson)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/lms/lessons/:id', requireRole(...staffRoles), async (req, res) => {
    try {
      const lesson = await prisma.lmsLesson.findUnique({
        where: { id: req.params.id },
        include: { module: { include: { course: true } } },
      })
      if (!lesson) return res.status(404).json({ error: 'Lesson not found' })
      if (!assertCourseTenant(req.user, lesson.module.course)) {
        return res.status(403).json({ error: 'Cross-tenant access denied' })
      }

      const updated = await prisma.lmsLesson.update({
        where: { id: lesson.id },
        data: {
          title: req.body.title ?? undefined,
          content: req.body.content ?? undefined,
          type: req.body.type ?? undefined,
          resourceUrl: req.body.resourceUrl ?? undefined,
          durationMin: req.body.durationMin ?? undefined,
          sortOrder: req.body.sortOrder ?? undefined,
        },
      })
      res.json(updated)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/lms/lessons/:id', requireRole(...staffRoles), async (req, res) => {
    try {
      const lesson = await prisma.lmsLesson.findUnique({
        where: { id: req.params.id },
        include: { module: { include: { course: true } } },
      })
      if (!lesson) return res.status(404).json({ error: 'Lesson not found' })
      if (!assertCourseTenant(req.user, lesson.module.course)) {
        return res.status(403).json({ error: 'Cross-tenant access denied' })
      }
      await prisma.lmsLesson.delete({ where: { id: lesson.id } })
      res.json({ message: 'Lesson deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ----- Progress -----
  app.post('/api/lms/courses/:courseId/enroll', requireRole('Student'), loadCourse, async (req, res) => {
    try {
      const student = await getStudentRecord(prisma, req.user)
      if (!student) return res.status(403).json({ error: 'Student profile required' })
      const enrollment = await ensureEnrollment(prisma, req.lmsCourse.id, student.id)
      res.json(enrollment)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/lms/lessons/:id/progress', requireRole('Student'), async (req, res) => {
    try {
      const student = await getStudentRecord(prisma, req.user)
      if (!student) return res.status(403).json({ error: 'Student profile required' })

      const lesson = await prisma.lmsLesson.findUnique({
        where: { id: req.params.id },
        include: { module: { include: { course: true } } },
      })
      if (!lesson) return res.status(404).json({ error: 'Lesson not found' })
      if (!assertCourseTenant(req.user, lesson.module.course)) {
        return res.status(403).json({ error: 'Cross-tenant access denied' })
      }

      const enrollment = await ensureEnrollment(prisma, lesson.module.courseId, student.id)
      const completed = req.body.completed !== false

      const progress = await prisma.lmsLessonProgress.upsert({
        where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId: lesson.id } },
        update: { completed, completedAt: completed ? new Date() : null },
        create: {
          enrollmentId: enrollment.id,
          lessonId: lesson.id,
          completed,
          completedAt: completed ? new Date() : null,
        },
      })

      const updatedEnrollment = await recalcEnrollmentProgress(prisma, enrollment.id)
      const certificate = await issueCertificateIfComplete(
        prisma,
        lesson.module.courseId,
        student.id
      )

      res.json({ progress, enrollment: updatedEnrollment, certificate })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ----- Assignments -----
  app.get('/api/lms/courses/:courseId/assignments', requireRole(...learnRoles), loadCourse, async (req, res) => {
    try {
      const assignments = await prisma.lmsAssignment.findMany({
        where: { courseId: req.lmsCourse.id },
        include: {
          submissions: req.user.role === 'Student'
            ? {
                where: {
                  student: { userId: req.user.userId || req.user.id },
                },
              }
            : { include: { student: { include: { user: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      })
      res.json(assignments)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/lms/courses/:courseId/assignments', requireRole(...staffRoles), loadCourse, async (req, res) => {
    try {
      const { title, description, resourceUrl, dueDate, totalMarks, lessonId } = req.body
      if (!title) return res.status(400).json({ error: 'Title required' })
      const assignment = await prisma.lmsAssignment.create({
        data: {
          courseId: req.lmsCourse.id,
          lessonId: lessonId || null,
          title,
          description: description || null,
          resourceUrl: resourceUrl || null,
          dueDate: dueDate ? new Date(dueDate) : null,
          totalMarks: totalMarks ?? 100,
        },
      })
      res.status(201).json(assignment)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/lms/assignments/:id/submit', requireRole('Student'), async (req, res) => {
    try {
      const student = await getStudentRecord(prisma, req.user)
      if (!student) return res.status(403).json({ error: 'Student profile required' })

      const assignment = await prisma.lmsAssignment.findUnique({
        where: { id: req.params.id },
        include: { course: true },
      })
      if (!assignment) return res.status(404).json({ error: 'Assignment not found' })
      if (!assertCourseTenant(req.user, assignment.course)) {
        return res.status(403).json({ error: 'Cross-tenant access denied' })
      }

      const { fileUrl, textAnswer } = req.body
      const submission = await prisma.lmsAssignmentSubmission.upsert({
        where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: student.id } },
        update: { fileUrl: fileUrl || null, textAnswer: textAnswer || null, submittedAt: new Date() },
        create: {
          assignmentId: assignment.id,
          studentId: student.id,
          fileUrl: fileUrl || null,
          textAnswer: textAnswer || null,
        },
      })
      res.json(submission)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/lms/submissions/:id/grade', requireRole(...staffRoles), async (req, res) => {
    try {
      const submission = await prisma.lmsAssignmentSubmission.findUnique({
        where: { id: req.params.id },
        include: { assignment: { include: { course: true } } },
      })
      if (!submission) return res.status(404).json({ error: 'Submission not found' })
      if (!assertCourseTenant(req.user, submission.assignment.course)) {
        return res.status(403).json({ error: 'Cross-tenant access denied' })
      }

      const updated = await prisma.lmsAssignmentSubmission.update({
        where: { id: submission.id },
        data: {
          grade: req.body.grade ?? undefined,
          feedback: req.body.feedback ?? undefined,
        },
      })
      res.json(updated)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ----- Discussions -----
  app.get('/api/lms/courses/:courseId/discussions', requireRole(...learnRoles), loadCourse, async (req, res) => {
    try {
      const discussions = await prisma.lmsDiscussion.findMany({
        where: { courseId: req.lmsCourse.id, parentId: null },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, role: { select: { name: true } } } },
          replies: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, role: { select: { name: true } } } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
      res.json(discussions)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/lms/courses/:courseId/discussions', requireRole(...learnRoles), loadCourse, async (req, res) => {
    try {
      const { body, parentId, lessonId } = req.body
      if (!body?.trim()) return res.status(400).json({ error: 'Message required' })

      const post = await prisma.lmsDiscussion.create({
        data: {
          courseId: req.lmsCourse.id,
          userId: req.user.userId || req.user.id,
          body: body.trim(),
          parentId: parentId || null,
          lessonId: lessonId || null,
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, role: { select: { name: true } } } },
        },
      })
      res.status(201).json(post)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ----- Certificates -----
  app.get('/api/lms/courses/:courseId/certificate', requireRole('Student'), loadCourse, async (req, res) => {
    try {
      const student = await getStudentRecord(prisma, req.user)
      if (!student) return res.status(403).json({ error: 'Student profile required' })

      const certificate = await issueCertificateIfComplete(prisma, req.lmsCourse.id, student.id)
      if (!certificate) {
        return res.status(400).json({ error: 'Course not yet completed' })
      }
      res.json(certificate)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/lms/certificates/:id/pdf', requireRole('Student', 'SchoolAdmin', 'Teacher', 'SuperAdmin'), async (req, res) => {
    try {
      const certificate = await prisma.lmsCertificate.findUnique({
        where: { id: req.params.id },
        include: {
          course: true,
          student: { include: { user: true, school: true } },
        },
      })
      if (!certificate) return res.status(404).json({ error: 'Certificate not found' })

      if (req.user.role === 'Student') {
        const student = await getStudentRecord(prisma, req.user)
        if (!student || student.id !== certificate.studentId) {
          return res.status(403).json({ error: 'Access denied' })
        }
      } else if (req.user.role !== 'SuperAdmin' && certificate.student.schoolId !== req.user.schoolId) {
        return res.status(403).json({ error: 'Cross-tenant access denied' })
      }

      streamCourseCertificate(
        res,
        certificate,
        certificate.course,
        certificate.student,
        certificate.student.school
      )
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

}

module.exports = { registerLmsRoutes }
