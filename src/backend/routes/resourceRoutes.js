const bcrypt = require('bcrypt')

function schoolScope(user) {
  if (user.role === 'SuperAdmin') return {}
  if (user.schoolId) return { schoolId: user.schoolId }
  return { schoolId: '__none__' }
}

function registerResourceRoutes(app, { prisma, requireRole }) {
  app.get('/api/dashboard/stats', requireRole(
    'SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent', 'Accountant'
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
          createdAt: true,
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

  app.post('/api/schools', requireRole('SuperAdmin'), async (req, res) => {
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

  app.get('/api/users', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
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

  app.get('/api/students', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher'), async (req, res) => {
    try {
      const scope = schoolScope(req.user)
      const schoolId = req.query.schoolId || scope.schoolId
      const where =
        req.user.role === 'SuperAdmin' && !schoolId
          ? {}
          : schoolId && schoolId !== '__none__'
            ? { schoolId: String(schoolId) }
            : { schoolId: '__none__' }

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

  app.get('/api/classes', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher'), async (req, res) => {
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

  app.get('/api/fees', requireRole('SuperAdmin', 'SchoolAdmin', 'Accountant'), async (req, res) => {
    try {
      const scope = schoolScope(req.user)
      const schoolId = req.query.schoolId || scope.schoolId
      const where =
        req.user.role === 'SuperAdmin' && !schoolId
          ? {}
          : schoolId && schoolId !== '__none__'
            ? { schoolId: String(schoolId) }
            : { schoolId: '__none__' }

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

  app.post('/api/students', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
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

      const attendance = await prisma.attendance.create({
        data: {
          studentId,
          classId,
          date: new Date(date),
          status,
          markedById: req.user.userId,
          remark: remark || null,
        },
      })
      res.status(201).json(attendance)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // --- Student detailed endpoints: GET by id, update, delete, search/paginate, promote
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
      // delete student and the associated user
      await prisma.$transaction([prisma.student.delete({ where: { id: req.params.id } }), prisma.user.delete({ where: { id: student.userId } })])
      res.json({ message: 'Student deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/students/search', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher'), async (req, res) => {
    try {
      const { q, classId, page = 1, pageSize = 20 } = req.query
      const pageNum = Math.max(1, Number(page))
      const take = Math.min(100, Number(pageSize) || 20)
      const skip = (pageNum - 1) * take

      const where = {}
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

  app.post('/api/students/:id/promote', requireRole('SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const { newClassId } = req.body
      if (!newClassId) return res.status(400).json({ error: 'newClassId required' })
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
  app.get('/api/subjects', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher'), async (req, res) => {
    try {
      const subjects = await prisma.subject.findMany({ include: { teacher: { include: { user: true } }, school: true, class: true } })
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

  app.get('/api/attendance', requireRole('SuperAdmin', 'SchoolAdmin', 'Teacher'), async (req, res) => {
    try {
      const { studentId, classId } = req.query
      const where = {
        ...(studentId ? { studentId: String(studentId) } : {}),
        ...(classId ? { classId: String(classId) } : {}),
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
}

module.exports = { registerResourceRoutes }
