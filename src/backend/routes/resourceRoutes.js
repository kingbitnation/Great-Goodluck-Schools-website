const bcrypt = require('bcrypt')
const { tenantWhere } = require('../middleware/tenantGuard')
const { checkTenantAccess, ensureStudentViewerAccess } = require('../lib/tenantHelpers')
const { PLATFORM_PREFIX } = require('../lib/platformBrand')

function schoolScope(user) {
  return tenantWhere(user)
}

function registerResourceRoutes(app, { prisma, requireRole, requirePermission, enqueueEmail, enforceStudentLimit }) {
  const perm = requirePermission || (() => (_req, _res, next) => next())
  const studentLimit = enforceStudentLimit || ((_req, _res, next) => next())
  const { notifyAttendanceMarked, notifyResultsPublished, notifyBulkResultsPublished } = require('../lib/emailNotifications')
  app.get('/api/dashboard/stats', requireRole(
    'SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent', 'Accountant',
    'Librarian', 'HostelManager', 'TransportManager'
  ), async (req, res) => {
    try {
      const { role, schoolId } = req.user

      if (role === 'SuperAdmin') {
        const [schools, users, students, teachers] = await Promise.all([
          prisma.school.count(),
          prisma.user.count({ where: { isActive: true } }),
          prisma.student.count(),
          prisma.teacher.count(),
        ])
        return res.json({ schools, users, students, teachers })
      }

      if (!schoolId) return res.json({ students: 0, teachers: 0, classes: 0, fees: 0 })

      const [students, teachers, classes, fees] = await Promise.all([
        prisma.student.count({ where: { schoolId } }),
        prisma.teacher.count({ where: { schoolId } }),
        prisma.class.count({ where: { schoolId } }),
        prisma.fee.count({ where: { schoolId, isActive: true } }),
      ])
      return res.json({ students, teachers, classes, fees })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/schools', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const where = schoolScope(req.user)
      const schools = await prisma.school.findMany({
        where: where.schoolId ? { id: where.schoolId } : {},
        select: {
          id: true,
          name: true,
          city: true,
          country: true,
          contactEmail: true,
          contactPhone: true,
          status: true,
          setupCompleted: true,
          primaryColor: true,
          secondaryColor: true,
          customDomain: true,
          createdAt: true,
          subscription: { include: { plan: true } },
          _count: { select: { students: true, teachers: true, classes: true } },
        },
        orderBy: { name: 'asc' },
      })
      res.json(schools)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/schools', requireRole('SuperAdmin'), perm('schools.manage'), async (req, res) => {
    try {
      const { name, address, city, country, contactEmail, contactPhone, website } = req.body
      if (!name) return res.status(400).json({ error: 'School name required' })

      const school = await prisma.school.create({
        data: { name, address, city, country, contactEmail, contactPhone, website },
      })
      res.status(201).json(school)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/schools/:id', requireRole('SuperAdmin'), perm('schools.manage'), async (req, res) => {
    try {
      const { deleteSchoolCompletely } = require('../lib/schoolDeletion')
      const school = await prisma.school.findUnique({ where: { id: req.params.id } })
      if (!school) return res.status(404).json({ error: 'School not found' })
      await deleteSchoolCompletely(prisma, school.id)
      res.json({ message: 'School deleted' })
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Could not delete school' })
    }
  })

  app.get('/api/users', requireRole('SuperAdmin', 'SchoolAdmin'), perm('users.read'), async (req, res) => {
    try {
      const where = schoolScope(req.user)
      const users = await prisma.user.findMany({
        where: {
          isActive: true,
          ...(where.schoolId ? { schoolId: where.schoolId } : {}),
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          schoolId: true,
          school: { select: { name: true } },
          role: { select: { name: true } },
          isActive: true,
          lastLogin: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      })
      res.json(users)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/students', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Librarian', 'HostelManager'), async (req, res) => {
    try {
      if (req.user.role === 'Student') {
        const student = await prisma.student.findUnique({
          where: { userId: req.user.userId },
          include: {
            user: { select: { email: true, firstName: true, lastName: true } },
            class: { select: { name: true, level: true } },
          },
        })
        return res.json(student ? [student] : [])
      }

      const scope = schoolScope(req.user)
      const schoolId = req.query.schoolId || scope.schoolId
      const where =
        req.user.role === 'SuperAdmin' && !schoolId
          ? {}
          : schoolId && schoolId !== '__none__'
            ? { schoolId: String(schoolId) }
            : { schoolId: '__none__' }

      if (req.query.classId) {
        where.classId = String(req.query.classId)
      }

      const students = await prisma.student.findMany({
        where,
        include: {
          user: { select: { email: true, firstName: true, lastName: true } },
          class: { select: { name: true, level: true } },
        },
        orderBy: { admissionDate: 'desc' },
      })
      res.json(students)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/teachers/search', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const { q, page = 1, pageSize = 20 } = req.query
      const pageNum = Math.max(1, Number(page))
      const take = Math.min(100, Number(pageSize) || 20)
      const skip = (pageNum - 1) * take

      const scope = schoolScope(req.user)
      const schoolId = req.query.schoolId || scope.schoolId
      const where =
        req.user.role === 'SuperAdmin' && !schoolId
          ? {}
          : schoolId && schoolId !== '__none__'
            ? { schoolId: String(schoolId) }
            : { schoolId: '__none__' }

      if (q) {
        where.OR = [
          { staffNo: { contains: String(q), mode: 'insensitive' } },
          { department: { contains: String(q), mode: 'insensitive' } },
          { user: { email: { contains: String(q), mode: 'insensitive' } } },
          { user: { firstName: { contains: String(q), mode: 'insensitive' } } },
          { user: { lastName: { contains: String(q), mode: 'insensitive' } } },
        ]
      }

      const [total, data] = await Promise.all([
        prisma.teacher.count({ where }),
        prisma.teacher.findMany({
          where,
          include: {
            user: { select: { email: true, firstName: true, lastName: true } },
            _count: { select: { subjects: true } },
          },
          orderBy: { hireDate: 'desc' },
          skip,
          take,
        }),
      ])
      res.json({ data, total, page: pageNum, pageSize: take })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/teachers', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const scope = schoolScope(req.user)
      const schoolId = req.query.schoolId || scope.schoolId
      const where =
        req.user.role === 'SuperAdmin' && !schoolId
          ? {}
          : schoolId && schoolId !== '__none__'
            ? { schoolId: String(schoolId) }
            : { schoolId: '__none__' }

      const teachers = await prisma.teacher.findMany({
        where,
        include: {
          user: { select: { email: true, firstName: true, lastName: true } },
          _count: { select: { subjects: true } },
        },
        orderBy: { hireDate: 'desc' },
      })
      res.json(teachers)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/classes', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student'), async (req, res) => {
    try {
      const scope = schoolScope(req.user)
      const schoolId = req.query.schoolId || scope.schoolId
      const where =
        req.user.role === 'SuperAdmin' && !schoolId
          ? {}
          : schoolId && schoolId !== '__none__'
            ? { schoolId: String(schoolId) }
            : { schoolId: '__none__' }

      const classes = await prisma.class.findMany({
        where,
        include: {
          _count: { select: { students: true, subjects: true } },
        },
        orderBy: { name: 'asc' },
      })
      res.json(classes)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/fees', requireRole('SuperAdmin', 'SchoolAdmin', 'Accountant', 'Student', 'Parent'), async (req, res) => {
    try {
      let schoolId = req.user.role === 'SuperAdmin' ? req.query.schoolId : req.user.schoolId
      if (req.user.role === 'Student') {
        const me = await prisma.student.findUnique({ where: { userId: req.user.userId }, select: { schoolId: true } })
        schoolId = me?.schoolId
      }
      if (req.user.role === 'Parent') {
        const parent = await prisma.parent.findUnique({ where: { userId: req.user.userId }, select: { schoolId: true } })
        schoolId = parent?.schoolId
      }
      const where =
        req.user.role === 'SuperAdmin' && !schoolId
          ? {}
          : schoolId
            ? { schoolId: String(schoolId) }
            : { schoolId: '__TENANT_BLOCKED__' }

      const fees = await prisma.fee.findMany({
        where,
        include: {
          _count: { select: { payments: true } },
        },
        orderBy: { dueDate: 'asc' },
      })
      res.json(fees)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/fees', requireRole('SuperAdmin', 'SchoolAdmin', 'Accountant'), async (req, res) => {
    try {
      const { name, amount, dueDate, classId, description, isActive } = req.body
      const schoolId = req.user.role === 'SuperAdmin' ? req.body.schoolId : req.user.schoolId
      if (!schoolId) return res.status(400).json({ error: 'School required' })
      if (!name || !amount || !dueDate) return res.status(400).json({ error: 'Invalid fee data' })

      const fee = await prisma.fee.create({
        data: {
          schoolId,
          classId: classId || null,
          name,
          amount: Number(amount),
          dueDate: new Date(dueDate),
          description,
          isActive: isActive !== false,
        },
      })
      res.status(201).json(fee)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/students', requireRole('SuperAdmin', 'SchoolAdmin'), studentLimit, async (req, res) => {
    try {
      const { email, password, firstName, lastName, admissionNo, classId, dob, gender, address } = req.body
      const schoolId = req.user.role === 'SuperAdmin' ? req.body.schoolId : req.user.schoolId

      const fieldErrors = {}
      if (!schoolId) fieldErrors.schoolId = 'School is required'
      if (!email) fieldErrors.email = 'Email is required'
      else if (!/\S+@\S+\.\S+/.test(email)) fieldErrors.email = 'Enter a valid email'
      if (!password) fieldErrors.password = 'Password is required'
      else if (password.length < 6) fieldErrors.password = 'Password must be at least 6 characters'
      if (!firstName) fieldErrors.firstName = 'First name is required'
      if (!lastName) fieldErrors.lastName = 'Last name is required'
      if (dob && Number.isNaN(Date.parse(dob))) fieldErrors.dob = 'Date of birth is invalid'
      if (gender && !['Male', 'Female', 'Other'].includes(gender)) fieldErrors.gender = 'Invalid gender'
      if (Object.keys(fieldErrors).length) {
        return res.status(400).json({ error: 'Validation failed', fields: fieldErrors })
      }

      const existingUser = await prisma.user.findUnique({ where: { email } })
      if (existingUser) return res.status(400).json({ error: 'Validation failed', fields: { email: 'Email already exists' } })

      const role = await prisma.role.findUnique({ where: { name: 'Student' } })
      if (!role) return res.status(400).json({ error: 'Student role missing' })

      const hashedPassword = await bcrypt.hash(password, 10)
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          roleId: role.id,
          schoolId,
          isActive: true,
        },
      })

      const student = await prisma.student.create({
        data: {
          userId: user.id,
          schoolId,
          admissionNo: admissionNo || `ADM-${Date.now()}`,
          classId: classId || null,
          dob: dob ? new Date(dob) : null,
          gender: gender || null,
          address: address || null,
          admissionDate: new Date(),
        },
      })

      res.status(201).json({ user, student })
    } catch (err) {
      console.error(err)
      if (err?.code === 'P2002' && err?.meta?.target?.includes('email')) {
        return res.status(400).json({ error: 'Validation failed', fields: { email: 'Email already exists' } })
      }
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/teachers', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const { email, password, firstName, lastName, staffNo, department, qualification, specialization, hireDate } = req.body
      const schoolId = req.user.role === 'SuperAdmin' ? req.body.schoolId : req.user.schoolId

      const fieldErrors = {}
      if (!schoolId) fieldErrors.schoolId = 'School is required'
      if (!email) fieldErrors.email = 'Email is required'
      else if (!/\S+@\S+\.\S+/.test(email)) fieldErrors.email = 'Enter a valid email'
      if (!password) fieldErrors.password = 'Password is required'
      else if (password.length < 6) fieldErrors.password = 'Password must be at least 6 characters'
      if (!firstName) fieldErrors.firstName = 'First name is required'
      if (!lastName) fieldErrors.lastName = 'Last name is required'
      if (hireDate && Number.isNaN(Date.parse(hireDate))) fieldErrors.hireDate = 'Hire date is invalid'
      if (Object.keys(fieldErrors).length) {
        return res.status(400).json({ error: 'Validation failed', fields: fieldErrors })
      }

      const existingUser = await prisma.user.findUnique({ where: { email } })
      if (existingUser) return res.status(400).json({ error: 'Validation failed', fields: { email: 'Email already exists' } })

      const role = await prisma.role.findUnique({ where: { name: 'Teacher' } })
      if (!role) return res.status(400).json({ error: 'Teacher role missing' })

      const hashedPassword = await bcrypt.hash(password, 10)
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          roleId: role.id,
          schoolId,
          isActive: true,
        },
      })

      const teacher = await prisma.teacher.create({
        data: {
          userId: user.id,
          schoolId,
          staffNo: staffNo || `T-${Date.now()}`,
          department: department || null,
          qualification: qualification || null,
          specialization: specialization || null,
          hireDate: hireDate ? new Date(hireDate) : new Date(),
        },
      })

      res.status(201).json({ user, teacher })
    } catch (err) {
      console.error(err)
      if (err?.code === 'P2002' && err?.meta?.target?.includes('email')) {
        return res.status(400).json({ error: 'Validation failed', fields: { email: 'Email already exists' } })
      }
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/exams', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student'), async (req, res) => {
    try {
      const scope = schoolScope(req.user)
      const schoolId = req.query.schoolId || scope.schoolId
      const where = schoolId && schoolId !== '__none__' ? { schoolId: String(schoolId) } : {}
      const exams = await prisma.exam.findMany({
        where,
        include: {
          subject: true,
          class: true,
          teacher: { include: { user: true } },
        },
        orderBy: { startDate: 'desc' },
      })
      res.json(exams)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/exams', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher'), async (req, res) => {
    try {
      const { classId, subjectId, name, type, startDate, endDate, duration, totalMarks, instructions } = req.body
      const schoolId = req.user.role === 'SuperAdmin' ? req.body.schoolId : req.user.schoolId
      if (!schoolId) return res.status(400).json({ error: 'School required' })
      if (!classId || !subjectId || !name || !startDate || !endDate) return res.status(400).json({ error: 'Missing required exam fields' })

      const exam = await prisma.exam.create({
        data: {
          schoolId,
          classId,
          subjectId,
          teacherId: req.user.userId,
          name,
          type: type || 'CBT',
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          duration: Number(duration) || 60,
          totalMarks: Number(totalMarks) || 100,
          instructions: instructions || null,
          published: false,
        },
      })
      res.status(201).json(exam)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/attendance', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher'), async (req, res) => {
    try {
      const { studentId, classId, date, status, remark } = req.body
      if (!studentId || !classId || !date || !status) return res.status(400).json({ error: 'Missing attendance fields' })

      const normalizedStatus =
        String(status).toLowerCase() === 'present'
          ? 'Present'
          : String(status).toLowerCase() === 'absent'
            ? 'Absent'
            : String(status).toLowerCase() === 'late'
              ? 'Late'
              : String(status).charAt(0).toUpperCase() + String(status).slice(1)

      const attendance = await prisma.attendance.create({
        data: {
          studentId,
          classId,
          date: new Date(date),
          status: normalizedStatus,
          markedById: req.user.userId,
          remark: remark || null,
        },
      })
      if (enqueueEmail) {
        notifyAttendanceMarked(prisma, attendance).catch((err) => console.error('Attendance email error:', err))
      }
      const { onAttendanceMarked } = require('../lib/workflowEngine')
      onAttendanceMarked(prisma, attendance).catch((err) => console.error('Workflow engine error:', err))
      res.status(201).json(attendance)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // --- Student detailed endpoints: GET by id, update, delete, search/paginate, promote
  // NOTE: /search must be registered BEFORE /:id to avoid "search" being treated as an id.
  app.get('/api/students/search', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher'), async (req, res) => {
    try {
      const { q, classId, page = 1, pageSize = 20 } = req.query
      const pageNum = Math.max(1, Number(page))
      const take = Math.min(100, Number(pageSize) || 20)
      const skip = (pageNum - 1) * take

      const where = { ...schoolScope(req.user) }
      if (classId) where.classId = String(classId)
      if (q) {
        where.OR = [
          { admissionNo: { contains: String(q), mode: 'insensitive' } },
          { user: { email: { contains: String(q), mode: 'insensitive' } } },
          { user: { firstName: { contains: String(q), mode: 'insensitive' } } },
          { user: { lastName: { contains: String(q), mode: 'insensitive' } } },
        ]
      }

      const [total, data] = await Promise.all([
        prisma.student.count({ where }),
        prisma.student.findMany({ where, include: { user: { select: { email: true, firstName: true, lastName: true } }, class: { select: { name: true } } }, orderBy: { admissionDate: 'desc' }, skip, take }),
      ])

      res.json({ data, total, page: pageNum, pageSize: take })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/students/:id', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher'), async (req, res) => {
    try {
      const student = await prisma.student.findUnique({
        where: { id: req.params.id },
        include: {
          user: true,
          class: true,
          parent: { include: { user: true } },
          attendance: { orderBy: { date: 'desc' }, take: 50 },
          results: true,
        },
      })
      if (!student) return res.status(404).json({ error: 'Student not found' })
      if (!checkTenantAccess(req.user, student.schoolId, res)) return
      res.json(student)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/students/:id', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const { email, firstName, lastName, admissionNo, classId, dob, gender, address } = req.body
      const student = await prisma.student.findUnique({ where: { id: req.params.id }, include: { user: true } })
      if (!student) return res.status(404).json({ error: 'Student not found' })
      if (!checkTenantAccess(req.user, student.schoolId, res)) return

      const fieldErrors = {}
      if (email && !/\S+@\S+\.\S+/.test(email)) fieldErrors.email = 'Enter a valid email'
      if (dob && Number.isNaN(Date.parse(dob))) fieldErrors.dob = 'Date of birth is invalid'
      if (Object.keys(fieldErrors).length) return res.status(400).json({ error: 'Validation failed', fields: fieldErrors })

      // Update user and student in a transaction
      const updates = await prisma.$transaction(async (tx) => {
        if (email && email !== student.user.email) {
          const exists = await tx.user.findUnique({ where: { email } })
          if (exists) throw { code: 'DUP_EMAIL' }
        }

        const user = await tx.user.update({ where: { id: student.userId }, data: { email: email || student.user.email, firstName: firstName ?? student.user.firstName, lastName: lastName ?? student.user.lastName } })
        const stud = await tx.student.update({ where: { id: req.params.id }, data: { admissionNo: admissionNo ?? student.admissionNo, classId: classId || null, dob: dob ? new Date(dob) : student.dob, gender: gender || student.gender, address: address || student.address } })
        return { user, stud }
      })

      res.json({ user: updates.user, student: updates.stud })
    } catch (err) {
      console.error(err)
      if (err?.code === 'DUP_EMAIL' || (err?.code === 'P2002' && err?.meta?.target?.includes('email'))) {
        return res.status(400).json({ error: 'Validation failed', fields: { email: 'Email already exists' } })
      }
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/students/:id', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const student = await prisma.student.findUnique({ where: { id: req.params.id } })
      if (!student) return res.status(404).json({ error: 'Student not found' })
      if (!checkTenantAccess(req.user, student.schoolId, res)) return
      // delete student and the associated user
      await prisma.$transaction([prisma.student.delete({ where: { id: req.params.id } }), prisma.user.delete({ where: { id: student.userId } })])
      res.json({ message: 'Student deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })


  app.post('/api/students/:id/promote', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const { newClassId } = req.body
      if (!newClassId) return res.status(400).json({ error: 'newClassId required' })
      const existing = await prisma.student.findUnique({ where: { id: req.params.id } })
      if (!existing) return res.status(404).json({ error: 'Student not found' })
      if (!checkTenantAccess(req.user, existing.schoolId, res)) return
      const student = await prisma.student.update({ where: { id: req.params.id }, data: { classId: newClassId } })
      res.json({ student })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // --- Teacher update/delete/profile and assignment endpoints
  app.get('/api/teachers/:id', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const teacher = await prisma.teacher.findUnique({ where: { id: req.params.id }, include: { user: true, school: true, subjects: true } })
      if (!teacher) return res.status(404).json({ error: 'Teacher not found' })
      if (!checkTenantAccess(req.user, teacher.schoolId, res)) return
      res.json(teacher)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/teachers/:id', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const { email, firstName, lastName, department, qualification, specialization, hireDate } = req.body
      const teacher = await prisma.teacher.findUnique({ where: { id: req.params.id }, include: { user: true } })
      if (!teacher) return res.status(404).json({ error: 'Teacher not found' })
      if (!checkTenantAccess(req.user, teacher.schoolId, res)) return

      const fieldErrors = {}
      if (email && !/\S+@\S+\.\S+/.test(email)) fieldErrors.email = 'Enter a valid email'
      if (hireDate && Number.isNaN(Date.parse(hireDate))) fieldErrors.hireDate = 'Hire date is invalid'
      if (Object.keys(fieldErrors).length) return res.status(400).json({ error: 'Validation failed', fields: fieldErrors })

      const updates = await prisma.$transaction(async (tx) => {
        if (email && email !== teacher.user.email) {
          const exists = await tx.user.findUnique({ where: { email } })
          if (exists) throw { code: 'DUP_EMAIL' }
        }
        const user = await tx.user.update({ where: { id: teacher.userId }, data: { email: email || teacher.user.email, firstName: firstName ?? teacher.user.firstName, lastName: lastName ?? teacher.user.lastName } })
        const t = await tx.teacher.update({ where: { id: req.params.id }, data: { department: department || teacher.department, qualification: qualification || teacher.qualification, specialization: specialization || teacher.specialization, hireDate: hireDate ? new Date(hireDate) : teacher.hireDate } })
        return { user, t }
      })
      res.json({ user: updates.user, teacher: updates.t })
    } catch (err) {
      console.error(err)
      if (err?.code === 'DUP_EMAIL' || (err?.code === 'P2002' && err?.meta?.target?.includes('email'))) {
        return res.status(400).json({ error: 'Validation failed', fields: { email: 'Email already exists' } })
      }
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/teachers/:id', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const teacher = await prisma.teacher.findUnique({ where: { id: req.params.id } })
      if (!teacher) return res.status(404).json({ error: 'Teacher not found' })
      if (!checkTenantAccess(req.user, teacher.schoolId, res)) return
      await prisma.$transaction([prisma.teacher.delete({ where: { id: req.params.id } }), prisma.user.delete({ where: { id: teacher.userId } })])
      res.json({ message: 'Teacher deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/teachers/:id/assign-subjects', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const { subjectIds } = req.body
      if (!Array.isArray(subjectIds)) return res.status(400).json({ error: 'subjectIds must be an array' })
      const updates = await prisma.$transaction(subjectIds.map((sid) => prisma.subject.update({ where: { id: sid }, data: { teacherId: req.params.id } })))
      res.json({ updated: updates.length })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/teachers/:id/assign-classes', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const { classIds } = req.body
      if (!Array.isArray(classIds)) return res.status(400).json({ error: 'classIds must be an array' })
      // Assign teacher to subjects of classes or create class-teacher links as needed. For now, update subjects that belong to the class without teacher.
      const updates = []
      for (const cid of classIds) {
        const subs = await prisma.subject.findMany({ where: { classId: cid } })
        for (const s of subs) {
          updates.push(await prisma.subject.update({ where: { id: s.id }, data: { teacherId: req.params.id } }))
        }
      }
      res.json({ assigned: updates.length })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // --- Subject management
  app.get('/api/subjects/search', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher'), async (req, res) => {
    try {
      const { q, classId, page = 1, pageSize = 20 } = req.query
      const pageNum = Math.max(1, Number(page))
      const take = Math.min(100, Number(pageSize) || 20)
      const skip = (pageNum - 1) * take

      const scope = schoolScope(req.user)
      const schoolId = req.query.schoolId || scope.schoolId
      const where = {}
      if (schoolId && schoolId !== '__none__') where.schoolId = String(schoolId)
      if (classId) where.classId = String(classId)
      if (q) {
        where.OR = [
          { code: { contains: String(q), mode: 'insensitive' } },
          { name: { contains: String(q), mode: 'insensitive' } },
          { description: { contains: String(q), mode: 'insensitive' } },
        ]
      }

      const [total, data] = await Promise.all([
        prisma.subject.count({ where }),
        prisma.subject.findMany({
          where,
          include: { teacher: { include: { user: { select: { firstName: true, lastName: true } } } }, class: { select: { id: true, name: true } } },
          orderBy: { name: 'asc' },
          skip,
          take,
        }),
      ])
      res.json({ data, total, page: pageNum, pageSize: take })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/subjects', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher'), async (req, res) => {
    try {
      const scope = schoolScope(req.user)
      const schoolId = req.query.schoolId || scope.schoolId
      const where = schoolId && schoolId !== '__none__' ? { schoolId: String(schoolId) } : {}
      const subjects = await prisma.subject.findMany({
        where,
        include: { teacher: { include: { user: true } }, school: true, class: true },
        orderBy: { name: 'asc' },
      })
      res.json(subjects)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/subjects', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const { code, name, classId, teacherId, schoolId } = req.body
      if (!code || !name) return res.status(400).json({ error: 'code and name required' })
      const exists = await prisma.subject.findFirst({ where: { code, schoolId: schoolId || undefined } })
      if (exists) return res.status(400).json({ error: 'Validation failed', fields: { code: 'Subject code already exists' } })
      const subject = await prisma.subject.create({ data: { code, name, classId: classId || null, teacherId: teacherId || null, schoolId: schoolId || null } })
      res.status(201).json(subject)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/subjects/:id', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const { code, name, classId, teacherId } = req.body
      const subject = await prisma.subject.update({ where: { id: req.params.id }, data: { code: code || undefined, name: name || undefined, classId: classId || null, teacherId: teacherId || null } })
      res.json(subject)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/subjects/:id', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      await prisma.subject.delete({ where: { id: req.params.id } })
      res.json({ message: 'Subject deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // --- Class management
  app.post('/api/classes', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const { name, level, capacity } = req.body
      // derive schoolId: SchoolAdmin uses their school, SuperAdmin must provide schoolId
      const schoolId = req.user.role === 'SuperAdmin' ? req.body.schoolId : req.user.schoolId
      if (!name) return res.status(400).json({ error: 'Class name required' })
      if (!schoolId) return res.status(400).json({ error: 'School required' })
      const cls = await prisma.class.create({ data: { name, level: level || '', capacity: Number(capacity) || 50, schoolId } })
      res.status(201).json(cls)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/classes/:id', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const { name, level, capacity } = req.body
      const cls = await prisma.class.update({ where: { id: req.params.id }, data: { name: name || undefined, level: level || undefined, capacity: capacity ? Number(capacity) : undefined } })
      res.json(cls)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/classes/:id', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      await prisma.class.delete({ where: { id: req.params.id } })
      res.json({ message: 'Class deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/classes/:id/assign-students', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const { studentIds } = req.body
      if (!Array.isArray(studentIds)) return res.status(400).json({ error: 'studentIds must be an array' })
      const updates = await Promise.all(studentIds.map((sid) => prisma.student.update({ where: { id: sid }, data: { classId: req.params.id } })))
      res.json({ updated: updates.length })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/classes/:id/assign-teachers', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const { teacherIds } = req.body
      if (!Array.isArray(teacherIds)) return res.status(400).json({ error: 'teacherIds must be an array' })
      // Assign teachers by assigning them to subjects for this class where applicable
      let count = 0
      for (const tid of teacherIds) {
        const subs = await prisma.subject.findMany({ where: { classId: req.params.id } })
        for (const s of subs) {
          await prisma.subject.update({ where: { id: s.id }, data: { teacherId: tid } })
          count++
        }
      }
      res.json({ assigned: count })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/classes/:id/assign-subjects', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const { subjectIds } = req.body
      if (!Array.isArray(subjectIds)) return res.status(400).json({ error: 'subjectIds must be an array' })
      const klass = await prisma.class.findUnique({ where: { id: req.params.id } })
      if (!klass) return res.status(404).json({ error: 'Class not found' })
      let count = 0
      for (const sid of subjectIds) {
        await prisma.subject.update({
          where: { id: sid },
          data: { classId: req.params.id, schoolId: klass.schoolId },
        })
        count++
      }
      res.json({ assigned: count })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // --- Session & Term management
  app.post('/api/sessions', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const { schoolId, name, startDate, endDate, active } = req.body
      if (!schoolId || !name || !startDate || !endDate) return res.status(400).json({ error: 'Missing required fields' })
      const session = await prisma.session.create({ data: { schoolId, name, startDate: new Date(startDate), endDate: new Date(endDate), active: !!active } })
      res.status(201).json(session)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/sessions/:id/activate', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const session = await prisma.session.findUnique({ where: { id: req.params.id } })
      if (!session) return res.status(404).json({ error: 'Session not found' })
      // deactivate other sessions for the same school
      await prisma.session.updateMany({ where: { schoolId: session.schoolId }, data: { active: false } })
      const updated = await prisma.session.update({ where: { id: req.params.id }, data: { active: true } })
      res.json(updated)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/terms', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const { sessionId, name, startDate, endDate } = req.body
      if (!sessionId || !name || !startDate || !endDate) return res.status(400).json({ error: 'Missing required fields' })
      const term = await prisma.term.create({ data: { sessionId, name, startDate: new Date(startDate), endDate: new Date(endDate) } })
      res.status(201).json(term)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/terms/:id/activate', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const term = await prisma.term.findUnique({ where: { id: req.params.id }, include: { session: true } })
      if (!term) return res.status(404).json({ error: 'Term not found' })
      // Deactivate other terms in this session (no direct active flag on term in schema; if needed, add field. For now return the activated term.)
      res.json(term)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/sessions', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher'), async (req, res) => {
    try {
      const { schoolId } = req.query
      const where = schoolId ? { schoolId: String(schoolId) } : {}
      const sessions = await prisma.session.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { terms: true },
      })
      res.json(sessions)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/terms', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher'), async (req, res) => {
    try {
      const { sessionId } = req.query
      const where = sessionId ? { sessionId: String(sessionId) } : {}
      const terms = await prisma.term.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { session: true },
      })
      res.json(terms)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/attendance', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent'), async (req, res) => {
    try {
      const { studentId, classId } = req.query
      const where = {}

      if (req.user.role === 'Student') {
        const student = await prisma.student.findUnique({ where: { userId: req.user.userId } })
        if (!student) return res.status(404).json({ error: 'Student not found' })
        if (studentId && String(studentId) !== student.id) {
          return res.status(403).json({ error: 'Forbidden' })
        }
        where.studentId = student.id
      } else if (req.user.role === 'Parent') {
        const parent = await prisma.parent.findUnique({ where: { userId: req.user.userId } })
        if (!parent) return res.status(404).json({ error: 'Parent profile not found' })
        const children = await prisma.student.findMany({ where: { parentId: parent.id }, select: { id: true } })
        const childIds = children.map((c) => c.id)
        if (studentId) {
          if (!childIds.includes(String(studentId))) return res.status(403).json({ error: 'Forbidden' })
          where.studentId = String(studentId)
        } else {
          where.studentId = { in: childIds }
        }
      } else {
        if (studentId) where.studentId = String(studentId)
      }

      if (classId) where.classId = String(classId)

      const { month, year } = req.query
      if (month && year) {
        const m = Number(month)
        const y = Number(year)
        const start = new Date(y, m - 1, 1)
        const end = new Date(y, m, 0, 23, 59, 59)
        where.date = { gte: start, lte: end }
      }

      const attendance = await prisma.attendance.findMany({
        where,
        include: { student: { include: { user: true } }, class: true, markedBy: true },
        orderBy: { date: 'desc' },
      })
      res.json(attendance)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== ACADEMIC SUPPORT: TIMETABLE, ASSIGNMENTS, SUBMISSIONS =====

  app.get('/api/timetable', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent'), async (req, res) => {
    try {
      const { classId, day } = req.query
      const where = {}

      if (req.user.role === 'Student') {
        const student = await prisma.student.findUnique({ where: { userId: req.user.userId } })
        if (!student) return res.status(404).json({ error: 'Student not found' })
        if (!student.classId) return res.json([])
        where.classId = student.classId
      } else if (req.user.role === 'Parent') {
        const parent = await prisma.parent.findUnique({ where: { userId: req.user.userId } })
        if (!parent) return res.status(404).json({ error: 'Parent not found' })
        const children = await prisma.student.findMany({ where: { parentId: parent.id } })
        const classIds = children.map((child) => child.classId).filter(Boolean)
        if (classIds.length === 0) return res.json([])
        where.classId = { in: classIds }
      } else {
        if (classId) where.classId = String(classId)
      }

      if (day) where.day = String(day)

      const timetable = await prisma.timetable.findMany({
        where,
        orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
      })
      res.json(timetable)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/timetable', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher'), async (req, res) => {
    try {
      const { classId, day, startTime, endTime, subject, teacher, room } = req.body
      if (!classId || !day || !startTime || !endTime || !subject) {
        return res.status(400).json({ error: 'Missing timetable fields' })
      }
      const entry = await prisma.timetable.create({
        data: {
          classId,
          day,
          startTime,
          endTime,
          subject,
          teacher: teacher || null,
          room: room || null,
        },
      })
      res.status(201).json(entry)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/timetable/:id', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher'), async (req, res) => {
    try {
      const { day, startTime, endTime, subject, teacher, room } = req.body
      const entry = await prisma.timetable.update({
        where: { id: req.params.id },
        data: {
          day: day || undefined,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          subject: subject || undefined,
          teacher: teacher || null,
          room: room || null,
        },
      })
      res.json(entry)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/timetable/:id', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher'), async (req, res) => {
    try {
      await prisma.timetable.delete({ where: { id: req.params.id } })
      res.json({ message: 'Timetable entry deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/assignments', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent'), async (req, res) => {
    try {
      const { classId, subjectId } = req.query
      const where = {}

      if (req.user.role === 'Student') {
        const student = await prisma.student.findUnique({ where: { userId: req.user.userId } })
        if (!student) return res.status(404).json({ error: 'Student not found' })
        if (!student.classId) return res.json([])
        where.classId = student.classId
      } else if (req.user.role === 'Teacher') {
        const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.userId } })
        if (!teacher) return res.status(404).json({ error: 'Teacher not found' })
        where.teacherId = teacher.id
      } else if (req.user.role === 'Parent') {
        const parent = await prisma.parent.findUnique({ where: { userId: req.user.userId } })
        if (!parent) return res.status(404).json({ error: 'Parent not found' })
        const children = await prisma.student.findMany({ where: { parentId: parent.id } })
        const classIds = children.map((child) => child.classId).filter(Boolean)
        if (classIds.length === 0) return res.json([])
        where.classId = { in: classIds }
      } else {
        if (classId) where.classId = String(classId)
      }

      if (subjectId) where.subjectId = String(subjectId)

      const assignments = await prisma.assignment.findMany({
        where,
        include: {
          class: true,
          subject: true,
          teacher: { include: { user: true } },
          _count: { select: { submissions: true } },
        },
        orderBy: { dueDate: 'asc' },
      })
      res.json(assignments)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/assignments', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher'), async (req, res) => {
    try {
      const { classId, subjectId, title, description, fileUrl, dueDate, totalMarks } = req.body
      if (!classId || !subjectId || !title || !dueDate) {
        return res.status(400).json({ error: 'Missing assignment fields' })
      }

      let teacherId = req.body.teacherId
      if (req.user.role === 'Teacher') {
        const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.userId } })
        if (!teacher) return res.status(404).json({ error: 'Teacher not found' })
        teacherId = teacher.id
      }

      const assignment = await prisma.assignment.create({
        data: {
          classId,
          subjectId,
          teacherId,
          title,
          description: description || null,
          fileUrl: fileUrl || null,
          dueDate: new Date(dueDate),
          totalMarks: totalMarks ? Number(totalMarks) : 100,
        },
        include: {
          class: true,
          subject: true,
          teacher: { include: { user: true } },
        },
      })
      res.status(201).json(assignment)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/assignments/:id', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent'), async (req, res) => {
    try {
      const assignment = await prisma.assignment.findUnique({
        where: { id: req.params.id },
        include: {
          class: true,
          subject: true,
          teacher: { include: { user: true } },
          submissions: { include: { student: { include: { user: true } } } },
        },
      })
      if (!assignment) return res.status(404).json({ error: 'Assignment not found' })
      res.json(assignment)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/assignments/:id', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher'), async (req, res) => {
    try {
      const existing = await prisma.assignment.findUnique({ where: { id: req.params.id } })
      if (!existing) return res.status(404).json({ error: 'Assignment not found' })

      if (req.user.role === 'Teacher') {
        const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.userId } })
        if (!teacher || teacher.id !== existing.teacherId) {
          return res.status(403).json({ error: 'Forbidden' })
        }
      }

      const { title, description, fileUrl, dueDate, totalMarks } = req.body
      const assignment = await prisma.assignment.update({
        where: { id: req.params.id },
        data: {
          title: title || undefined,
          description: description || undefined,
          fileUrl: fileUrl || undefined,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          totalMarks: totalMarks !== undefined ? Number(totalMarks) : undefined,
        },
      })
      res.json(assignment)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/assignments/:id', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher'), async (req, res) => {
    try {
      const existing = await prisma.assignment.findUnique({ where: { id: req.params.id } })
      if (!existing) return res.status(404).json({ error: 'Assignment not found' })

      if (req.user.role === 'Teacher') {
        const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.userId } })
        if (!teacher || teacher.id !== existing.teacherId) {
          return res.status(403).json({ error: 'Forbidden' })
        }
      }

      await prisma.assignment.delete({ where: { id: req.params.id } })
      res.json({ message: 'Assignment deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/submissions', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student'), async (req, res) => {
    try {
      const { assignmentId } = req.query
      const where = {}

      if (req.user.role === 'Student') {
        const student = await prisma.student.findUnique({ where: { userId: req.user.userId } })
        if (!student) return res.status(404).json({ error: 'Student not found' })
        where.studentId = student.id
      } else if (req.user.role === 'Teacher') {
        const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.userId } })
        if (!teacher) return res.status(404).json({ error: 'Teacher not found' })
        const assignmentIds = await prisma.assignment.findMany({
          where: { teacherId: teacher.id },
          select: { id: true },
        })
        where.assignmentId = { in: assignmentIds.map((a) => a.id) }
      }

      if (assignmentId) where.assignmentId = String(assignmentId)

      const submissions = await prisma.submission.findMany({
        where,
        include: {
          assignment: { include: { subject: true, class: true } },
          student: { include: { user: true, class: true } },
        },
        orderBy: { submittedAt: 'desc' },
      })
      res.json(submissions)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/submissions', requireRole('Student'), async (req, res) => {
    try {
      const { assignmentId, fileUrl } = req.body
      if (!assignmentId || !fileUrl) {
        return res.status(400).json({ error: 'Missing submission fields' })
      }
      const student = await prisma.student.findUnique({ where: { userId: req.user.userId } })
      if (!student) return res.status(404).json({ error: 'Student not found' })

      const submission = await prisma.submission.create({
        data: {
          assignmentId,
          studentId: student.id,
          fileUrl,
          submittedAt: new Date(),
        },
        include: { student: { include: { user: true } }, assignment: { include: { subject: true, class: true } } },
      })
      res.status(201).json(submission)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/submissions/:id/grade', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher'), async (req, res) => {
    try {
      const { grade, feedback } = req.body
      const submission = await prisma.submission.findUnique({ where: { id: req.params.id } })
      if (!submission) return res.status(404).json({ error: 'Submission not found' })

      if (req.user.role === 'Teacher') {
        const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.userId } })
        const assignment = await prisma.assignment.findUnique({ where: { id: submission.assignmentId } })
        if (!teacher || !assignment || assignment.teacherId !== teacher.id) {
          return res.status(403).json({ error: 'Forbidden' })
        }
      }

      const updated = await prisma.submission.update({
        where: { id: req.params.id },
        data: {
          grade: grade !== undefined ? Number(grade) : undefined,
          feedback: feedback || undefined,
        },
        include: { student: { include: { user: true, class: true } }, assignment: true },
      })
      res.json(updated)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/parents/children', requireRole('Parent', 'SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      if (req.user.role === 'Parent') {
        const parent = await prisma.parent.findUnique({ where: { userId: req.user.userId } })
        if (!parent) return res.status(404).json({ error: 'Parent not found' })
        const children = await prisma.student.findMany({
          where: { parentId: parent.id },
          include: { user: true, class: true, school: true },
        })
        return res.json(children)
      }

      const parentId = req.query.parentId ? String(req.query.parentId) : undefined
      const where = parentId ? { id: parentId } : {}
      const children = await prisma.student.findMany({ where, include: { user: true, class: true, school: true } })
      res.json(children)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/books', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent', 'Accountant', 'Librarian'), async (req, res) => {
    try {
      const books = await prisma.book.findMany({ orderBy: { title: 'asc' } })
      res.json(books)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/books', requireRole('SuperAdmin', 'SchoolAdmin', 'Librarian'), async (req, res) => {
    try {
      const { title, author, isbn, publisher, year, copies, category, description, thumbnail } = req.body
      if (!title || !author) return res.status(400).json({ error: 'Title and author are required' })
      const book = await prisma.book.create({
        data: {
          title,
          author,
          isbn: isbn || null,
          publisher: publisher || null,
          year: year ? Number(year) : null,
          copies: copies ? Number(copies) : 1,
          availableCopies: copies ? Number(copies) : 1,
          category: category || null,
          description: description || null,
          thumbnail: thumbnail || null,
        },
      })
      res.status(201).json(book)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/books/:id', requireRole('SuperAdmin', 'SchoolAdmin', 'Librarian'), async (req, res) => {
    try {
      const { title, author, isbn, publisher, year, copies, availableCopies, category, description, thumbnail } = req.body
      const book = await prisma.book.update({
        where: { id: req.params.id },
        data: {
          title: title || undefined,
          author: author || undefined,
          isbn: isbn || undefined,
          publisher: publisher || undefined,
          year: year !== undefined ? Number(year) : undefined,
          copies: copies !== undefined ? Number(copies) : undefined,
          availableCopies: availableCopies !== undefined ? Number(availableCopies) : undefined,
          category: category || undefined,
          description: description || undefined,
          thumbnail: thumbnail || undefined,
        },
      })
      res.json(book)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/books/:id', requireRole('SuperAdmin', 'SchoolAdmin', 'Librarian'), async (req, res) => {
    try {
      await prisma.book.delete({ where: { id: req.params.id } })
      res.json({ message: 'Book deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/messages', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent', 'Accountant'), async (req, res) => {
    try {
      const { sent } = req.query
      const where = {}
      if (String(sent) === 'true') {
        where.senderId = req.user.userId
      } else {
        where.receiverId = req.user.userId
      }
      const messages = await prisma.message.findMany({
        where,
        include: {
          sender: { select: { id: true, firstName: true, lastName: true, email: true } },
          receiver: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      res.json(messages)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/messages', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent', 'Accountant'), async (req, res) => {
    try {
      let { receiverId, subject, body, attachments } = req.body
      if (!receiverId || !body) return res.status(400).json({ error: 'Receiver and message body are required' })
      if (String(receiverId).includes('@')) {
        const receiver = await prisma.user.findUnique({ where: { email: String(receiverId).toLowerCase() } })
        if (!receiver) return res.status(404).json({ error: 'Receiver not found' })
        receiverId = receiver.id
      }
      const message = await prisma.message.create({
        data: {
          senderId: req.user.userId,
          receiverId,
          subject: subject || null,
          body,
          attachments: Array.isArray(attachments) ? attachments : [],
        },
      })
      res.status(201).json(message)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/notifications', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent', 'Accountant', 'Alumni'), async (req, res) => {
    try {
      const userId = req.user.userId || req.user.id
      const notifications = await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      })
      res.json(notifications)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/notifications', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher'), async (req, res) => {
    try {
      const { userId, type, title, body, payload, channels } = req.body
      if (!userId || !type || !title || !body) return res.status(400).json({ error: 'Missing notification fields' })
      const { dispatchNotification } = require('../lib/notificationDispatcher')
      const result = await dispatchNotification(prisma, {
        userId,
        schoolId: req.user.schoolId,
        type,
        title,
        body,
        payload,
        channels: channels || ['in_app', 'push'],
      })
      res.status(201).json(result.inApp || result)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/notifications/:id/read', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent', 'Accountant', 'Alumni'), async (req, res) => {
    try {
      const userId = req.user.userId || req.user.id
      const notification = await prisma.notification.findUnique({ where: { id: req.params.id } })
      if (!notification) return res.status(404).json({ error: 'Notification not found' })
      if (notification.userId !== userId) return res.status(403).json({ error: 'Forbidden' })
      const updated = await prisma.notification.update({
        where: { id: req.params.id },
        data: { read: true, readAt: new Date() },
      })
      res.json(updated)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/announcements', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent', 'Accountant'), async (req, res) => {
    try {
      const publishedOnly = String(req.query.published) === 'true'
      const scope = schoolScope(req.user)
      const where = { ...scope, ...(publishedOnly ? { published: true } : {}) }
      const announcements = await prisma.announcement.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
      })
      res.json(announcements)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/announcements', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const { title, content, image, priority, published, expireAt } = req.body
      if (!title || !content) return res.status(400).json({ error: 'Title and content are required' })
      const announcement = await prisma.announcement.create({
        data: {
          schoolId: req.user.role === 'SuperAdmin' ? (req.body.schoolId || null) : req.user.schoolId,
          title,
          content,
          image: image || null,
          priority: priority || 'normal',
          published: !!published,
          publishedAt: published ? new Date() : null,
          expireAt: expireAt ? new Date(expireAt) : null,
        },
      })
      res.status(201).json(announcement)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/announcements/:id', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const existing = await prisma.announcement.findUnique({ where: { id: req.params.id } })
      if (!existing) return res.status(404).json({ error: 'Not found' })
      if (req.user.role !== 'SuperAdmin' && existing.schoolId !== req.user.schoolId) {
        return res.status(403).json({ error: 'Cross-tenant access denied' })
      }
      const { title, content, image, priority, published, expireAt } = req.body
      const announcement = await prisma.announcement.update({
        where: { id: req.params.id },
        data: {
          title: title || undefined,
          content: content || undefined,
          image: image || undefined,
          priority: priority || undefined,
          published: published !== undefined ? !!published : undefined,
          publishedAt: published ? new Date() : undefined,
          expireAt: expireAt ? new Date(expireAt) : undefined,
        },
      })
      res.json(announcement)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/announcements/:id', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const existing = await prisma.announcement.findUnique({ where: { id: req.params.id } })
      if (!existing) return res.status(404).json({ error: 'Not found' })
      if (req.user.role !== 'SuperAdmin' && existing.schoolId !== req.user.schoolId) {
        return res.status(403).json({ error: 'Cross-tenant access denied' })
      }
      await prisma.announcement.delete({ where: { id: req.params.id } })
      res.json({ message: 'Announcement deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== RESULT MANAGEMENT SYSTEM =====
  app.get('/api/results', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student'), async (req, res) => {
    try {
      const { studentId, subjectId, examId, classId } = req.query
      const scope = schoolScope(req.user)
      const where = {}
      if (studentId) where.studentId = String(studentId)
      if (subjectId) where.subjectId = String(subjectId)
      if (examId) where.examId = String(examId)
      if (classId) where.student = { ...(where.student || {}), classId: String(classId) }
      if (scope.schoolId) {
        where.student = { ...(where.student || {}), schoolId: scope.schoolId }
      }
      if (req.user.role === 'Student') {
        const me = await prisma.student.findUnique({ where: { userId: req.user.userId } })
        if (!me) return res.status(404).json({ error: 'Student not found' })
        where.studentId = me.id
        where.published = true
      }
      
      const results = await prisma.result.findMany({
        where,
        include: {
          student: { include: { user: true, class: true } },
          subject: true,
          exam: true,
        },
        orderBy: { createdAt: 'desc' },
      })
      res.json(results)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/results', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher'), async (req, res) => {
    try {
      const { studentId, subjectId, examId, totalScore, grade, gpa, percentile, feedback } = req.body
      if (!studentId || !subjectId || totalScore === undefined) {
        return res.status(400).json({ error: 'Missing required fields' })
      }

      // Check if result already exists
      const existing = await prisma.result.findFirst({
        where: { studentId, subjectId, examId: examId || null },
      })
      if (existing) {
        return res.status(400).json({ error: 'Result already exists for this student/subject combination' })
      }

      const result = await prisma.result.create({
        data: {
          studentId,
          subjectId,
          examId: examId || null,
          totalScore: Number(totalScore),
          grade: grade || calculateGrade(totalScore),
          gpa: gpa || calculateGPA(grade || calculateGrade(totalScore)),
          percentile: percentile || null,
          feedback: feedback || null,
          published: false,
        },
        include: {
          student: { include: { user: true } },
          subject: true,
          exam: true,
        },
      })
      res.status(201).json(result)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/results/:id', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher'), async (req, res) => {
    try {
      const { totalScore, grade, feedback } = req.body
      const fieldErrors = {}
      if (totalScore !== undefined && (isNaN(totalScore) || totalScore < 0 || totalScore > 100)) {
        fieldErrors.totalScore = 'Score must be between 0 and 100'
      }
      if (Object.keys(fieldErrors).length) {
        return res.status(400).json({ error: 'Validation failed', fields: fieldErrors })
      }

      const calculatedGrade = grade || calculateGrade(totalScore)
      const result = await prisma.result.update({
        where: { id: req.params.id },
        data: {
          totalScore: totalScore !== undefined ? Number(totalScore) : undefined,
          grade: calculatedGrade,
          gpa: calculateGPA(calculatedGrade),
          feedback: feedback || undefined,
        },
        include: {
          student: { include: { user: true } },
          subject: true,
        },
      })
      res.json(result)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/results/:id', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      await prisma.result.delete({ where: { id: req.params.id } })
      res.json({ message: 'Result deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/results/student/:studentId', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent'), async (req, res) => {
    try {
      if (!(await ensureStudentViewerAccess(prisma, req, res, req.params.studentId))) return

      const student = await prisma.student.findUnique({ where: { id: req.params.studentId } })
      if (!student) return res.status(404).json({ error: 'Student not found' })
      if (!checkTenantAccess(req.user, student.schoolId, res)) return

      const publishedOnly = req.user.role === 'Student' || req.user.role === 'Parent'
      const results = await prisma.result.findMany({
        where: {
          studentId: req.params.studentId,
          ...(publishedOnly ? { published: true } : {}),
        },
        include: { subject: true, exam: true },
        orderBy: { createdAt: 'desc' },
      })
      res.json(results)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/results/:id/publish', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher'), async (req, res) => {
    try {
      const result = await prisma.result.update({
        where: { id: req.params.id },
        data: { published: true, publishedAt: new Date() },
      })
      if (enqueueEmail) {
        notifyResultsPublished(prisma, { resultIds: [result.id] }).catch((err) => console.error('Results email error:', err))
      }
      res.json(result)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/results/bulk-publish', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher'), async (req, res) => {
    try {
      const { examId, classId } = req.body
      if (!examId && !classId) {
        return res.status(400).json({ error: 'Provide examId or classId' })
      }

      const where = {}
      if (examId) where.examId = examId
      if (classId) {
        where.student = { classId }
      }

      const updated = await prisma.result.updateMany({
        where,
        data: { published: true, publishedAt: new Date() },
      })
      if (enqueueEmail && updated.count > 0) {
        notifyBulkResultsPublished(prisma, { examId, classId }).catch((err) => console.error('Bulk results email error:', err))
      }
      res.json({ updated: updated.count })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/rankings/:classId', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher'), async (req, res) => {
    try {
      const classId = req.params.classId
      const results = await prisma.result.findMany({
        where: { student: { classId } },
        include: { student: { include: { user: true } } },
      })

      // Calculate average score per student
      const studentAverages = {}
      results.forEach(r => {
        if (!studentAverages[r.studentId]) {
          studentAverages[r.studentId] = { scores: [], student: r.student, gpa: 0 }
        }
        studentAverages[r.studentId].scores.push(r.totalScore)
      })

      // Sort by average
      const rankings = Object.values(studentAverages)
        .map(({ student, scores, gpa }) => ({
          student,
          averageScore: scores.length ? (scores.reduce((a, b) => a + b) / scores.length).toFixed(2) : 0,
          gpa: (scores.length ? (scores.reduce((a, b) => a + b) / scores.length * 0.4).toFixed(2) : 0),
        }))
        .sort((a, b) => parseFloat(b.averageScore) - parseFloat(a.averageScore))
        .map((item, index) => ({ ...item, rank: index + 1 }))

      res.json(rankings)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/transcripts/:studentId', requireRole('SuperAdmin', 'SchoolAdmin', 'Student', 'Parent'), async (req, res) => {
    try {
      if (!(await ensureStudentViewerAccess(prisma, req, res, req.params.studentId))) return

      const publishedOnly = req.user.role === 'Student' || req.user.role === 'Parent'
      const student = await prisma.student.findUnique({
        where: { id: req.params.studentId },
        include: {
          user: true,
          class: true,
          results: {
            where: publishedOnly ? { published: true } : {},
            include: { subject: true, exam: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      })

      if (!student) return res.status(404).json({ error: 'Student not found' })
      if (!checkTenantAccess(req.user, student.schoolId, res)) return

      // Calculate transcript data
      const transcript = {
        student: {
          id: student.id,
          name: `${student.user.firstName} ${student.user.lastName}`,
          admissionNo: student.admissionNo,
          class: student.class?.name || 'N/A',
          email: student.user.email,
        },
        results: student.results,
        summary: {
          totalResults: student.results.length,
          averageScore: student.results.length
            ? (student.results.reduce((sum, r) => sum + r.totalScore, 0) / student.results.length).toFixed(2)
            : 0,
          averageGPA: student.results.length
            ? (student.results.reduce((sum, r) => sum + (r.gpa || 0), 0) / student.results.length).toFixed(2)
            : 0,
        },
      }

      res.json(transcript)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/reportcards/:studentId', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent'), async (req, res) => {
    try {
      if (!(await ensureStudentViewerAccess(prisma, req, res, req.params.studentId))) return

      const student = await prisma.student.findUnique({
        where: { id: req.params.studentId },
        include: {
          user: true,
          class: true,
          results: {
            include: { subject: true },
            where: { published: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      })

      if (!student) return res.status(404).json({ error: 'Student not found' })
      if (!checkTenantAccess(req.user, student.schoolId, res)) return

      // Generate report card
      const reportCard = {
        student: {
          name: `${student.user.firstName} ${student.user.lastName}`,
          admissionNo: student.admissionNo,
          class: student.class?.name || 'N/A',
          email: student.user.email,
          dob: student.dob,
        },
        results: student.results.map(r => ({
          subject: r.subject.name,
          code: r.subject.code,
          score: r.totalScore,
          grade: r.grade,
          gpa: r.gpa,
          feedback: r.feedback,
        })),
        summary: {
          totalSubjects: student.results.length,
          averageScore: student.results.length
            ? (student.results.reduce((sum, r) => sum + r.totalScore, 0) / student.results.length).toFixed(2)
            : 0,
          averageGrade: student.results.length
            ? calculateGrade(student.results.reduce((sum, r) => sum + r.totalScore, 0) / student.results.length)
            : 'N/A',
          totalGPA: student.results.length
            ? (student.results.reduce((sum, r) => sum + (r.gpa || 0), 0) / student.results.length).toFixed(2)
            : 0,
        },
        generatedAt: new Date().toISOString(),
      }

      res.json(reportCard)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // Grade calculation helper functions
  function calculateGrade(score) {
    if (score >= 90) return 'A+'
    if (score >= 80) return 'A'
    if (score >= 70) return 'B'
    if (score >= 60) return 'C'
    if (score >= 50) return 'D'
    return 'F'
  }

  function calculateGPA(grade) {
    const gpaMap = { 'A+': 4.0, A: 4.0, B: 3.5, C: 2.5, D: 1.5, F: 0.0 }
    return gpaMap[grade] || 0.0
  }

    // ===== FINANCE/PAYMENT MANAGEMENT =====
    app.get('/api/payments', requireRole('SuperAdmin', 'SchoolAdmin', 'Accountant', 'Student', 'Parent'), async (req, res) => {
      try {
        const { studentId, status, gateway } = req.query
        const where = {}

        if (req.user.role === 'Student') {
          const student = await prisma.student.findUnique({ where: { userId: req.user.userId } })
          if (!student) return res.status(404).json({ error: 'Student not found' })
          if (studentId && String(studentId) !== student.id) {
            return res.status(403).json({ error: 'Forbidden' })
          }
          where.studentId = student.id
        } else if (req.user.role === 'Parent') {
          const parent = await prisma.parent.findUnique({ where: { userId: req.user.userId }, include: { children: true } })
          if (!parent) return res.status(404).json({ error: 'Parent not found' })
          const childIds = parent.children.map((c) => c.id)
          if (studentId) {
            if (!childIds.includes(String(studentId))) return res.status(403).json({ error: 'Forbidden' })
            where.studentId = String(studentId)
          } else {
            where.studentId = { in: childIds }
          }
        } else if (studentId) {
          where.studentId = String(studentId)
        }

        if (status) where.status = String(status)
        if (gateway) where.gateway = String(gateway)

        const payments = await prisma.payment.findMany({
          where,
          include: {
            student: { include: { user: true, class: true } },
            fee: true,
          },
          orderBy: { createdAt: 'desc' },
        })
        res.json(payments)
      } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
      }
    })

    app.post('/api/payments', requireRole('SuperAdmin', 'SchoolAdmin', 'Student'), async (req, res) => {
      try {
        const { feeId, studentId, amount, gateway } = req.body
        if (!studentId || !amount) {
          return res.status(400).json({ error: 'Missing required fields' })
        }

        const gw = gateway || 'manual'
        const isManual = gw === 'manual'
        const student = await prisma.student.findUnique({ where: { id: studentId }, select: { schoolId: true } })

        const payment = await prisma.payment.create({
          data: {
            schoolId: student?.schoolId || null,
            feeId: feeId || null,
            studentId,
            amount: Number(amount),
            paidAmount: isManual ? 0 : Number(amount),
            gateway: gw,
            status: isManual ? 'pending' : 'pending',
            verificationStatus: isManual ? 'pending_verification' : 'none',
            paymentReference: isManual ? `${PLATFORM_PREFIX}-${Date.now().toString(36).toUpperCase()}` : null,
            paidAt: null,
          },
          include: { student: { include: { user: true } }, fee: true },
        })
        res.status(201).json(payment)
      } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
      }
    })

    app.put('/api/payments/:id', requireRole('SuperAdmin', 'SchoolAdmin', 'Accountant'), async (req, res) => {
      try {
        const { status, transactionId, receiptUrl } = req.body
        const fieldErrors = {}
        if (status && !['pending', 'completed', 'failed'].includes(status)) {
          fieldErrors.status = 'Invalid status'
        }
        if (Object.keys(fieldErrors).length) {
          return res.status(400).json({ error: 'Validation failed', fields: fieldErrors })
        }

        const payment = await prisma.payment.update({
          where: { id: req.params.id },
          data: {
            status: status || undefined,
            transactionId: transactionId || undefined,
            receiptUrl: receiptUrl || undefined,
            paidAt: status === 'completed' ? new Date() : undefined,
          },
          include: { student: { include: { user: true } }, fee: true },
        })
        res.json(payment)
      } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
      }
    })

    app.get('/api/payments/:id/receipt', requireRole('SuperAdmin', 'SchoolAdmin', 'Accountant', 'Student'), async (req, res) => {
      try {
        const payment = await prisma.payment.findUnique({
          where: { id: req.params.id },
          include: {
            student: { include: { user: true, class: true } },
            fee: true,
          },
        })

        if (!payment) return res.status(404).json({ error: 'Payment not found' })

        const receipt = {
          id: payment.id,
          receiptNumber: `RCP-${payment.id.slice(-8).toUpperCase()}`,
          date: payment.createdAt,
          student: {
            name: `${payment.student.user.firstName} ${payment.student.user.lastName}`,
            email: payment.student.user.email,
            class: payment.student.class?.name || 'N/A',
          },
          description: payment.fee?.name || 'Fee Payment',
          amount: payment.amount,
          paidAmount: payment.paidAmount,
          balance: payment.amount - payment.paidAmount,
          status: payment.status,
          transactionId: payment.transactionId,
          gateway: payment.gateway,
          paidAt: payment.paidAt,
        }
        res.json(receipt)
      } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
      }
    })

    app.get('/api/debtors', requireRole('SuperAdmin', 'SchoolAdmin', 'Accountant'), async (req, res) => {
      try {
        const { classId, schoolId } = req.query

        // Get all fees
        const where = {}
        if (schoolId) where.schoolId = String(schoolId)
        if (classId) where.classId = String(classId)

        const fees = await prisma.fee.findMany({ where })
        const feeIds = fees.map(f => f.id)

        // Get all students
        const studentWhere = {}
        if (classId) studentWhere.classId = String(classId)

        const students = await prisma.student.findMany({
          where: studentWhere,
          include: {
            user: true,
            class: true,
            parent: { include: { user: true } },
          },
        })

        // Calculate debt for each student
        const debtors = await Promise.all(
          students.map(async (student) => {
            const payments = await prisma.payment.findMany({
              where: { studentId: student.id, status: 'completed' },
            })

            const totalPaid = payments.reduce((sum, p) => sum + p.paidAmount, 0)
            const totalDue = fees.reduce((sum, f) => sum + f.amount, 0)
            const debt = totalDue - totalPaid

            if (debt > 0) {
              return {
                id: student.id,
                studentName: `${student.user.firstName} ${student.user.lastName}`,
                email: student.user.email,
                class: student.class?.name || 'N/A',
                parent: student.parent
                  ? `${student.parent.user.firstName} ${student.parent.user.lastName}`
                  : 'N/A',
                totalDue,
                totalPaid,
                debt,
                daysOverdue: calculateDaysOverdue(fees),
              }
            }
            return null
          })
        )

        res.json(debtors.filter(d => d !== null))
      } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
      }
    })

    app.get('/api/financial-report', requireRole('SuperAdmin', 'SchoolAdmin', 'Accountant'), async (req, res) => {
      try {
        const { month, year, schoolId } = req.query
        const schoolFilter = schoolId ? { schoolId: String(schoolId) } : {}

        // Get all payments for the period
        const payments = await prisma.payment.findMany({
          where: {
            status: 'completed',
            paidAt: month && year ? {
              gte: new Date(parseInt(year), parseInt(month) - 1, 1),
              lt: new Date(parseInt(year), parseInt(month), 1),
            } : undefined,
          },
          include: { fee: true },
        })

        // Get all fees
        const fees = await prisma.fee.findMany({ where: schoolFilter })

        const report = {
          period: month && year ? `${month}/${year}` : 'All Time',
          totalFees: fees.length,
          totalFeeAmount: fees.reduce((sum, f) => sum + f.amount, 0),
          totalPayments: payments.length,
          totalCollected: payments.reduce((sum, p) => sum + p.paidAmount, 0),
          pendingAmount: fees.reduce((sum, f) => sum + f.amount, 0) - payments.reduce((sum, p) => sum + p.paidAmount, 0),
          collectionRate: (payments.reduce((sum, p) => sum + p.paidAmount, 0) / fees.reduce((sum, f) => sum + f.amount, 0) * 100).toFixed(2),
          paymentsByGateway: payments.reduce((acc, p) => {
            acc[p.gateway] = (acc[p.gateway] || 0) + p.paidAmount
            return acc
          }, {}),
        }
        res.json(report)
      } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
      }
    })

    function calculateDaysOverdue(fees) {
      const oldestDueDate = fees.reduce((oldest, f) => f.dueDate < oldest ? f.dueDate : oldest, new Date())
      return Math.floor((new Date() - oldestDueDate) / (1000 * 60 * 60 * 24))
    }
}

module.exports = { registerResourceRoutes }
