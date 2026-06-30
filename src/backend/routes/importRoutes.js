const bcrypt = require('bcrypt')
const { ensureRoleProfile, ROLE_PROFILE_MODELS } = require('../lib/roleProfiles')

function escapeCsv(value) {
  const str = value == null ? '' : String(value)
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map((line) => {
    const values = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i += 1
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === ',' && !inQuotes) {
        values.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    values.push(current.trim())
    const row = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? ''
    })
    return row
  })
}

function studentsToCsv(students) {
  const headers = ['email', 'firstName', 'lastName', 'admissionNo', 'className', 'gender', 'dob', 'address']
  const rows = students.map((s) => [
    s.user?.email,
    s.user?.firstName,
    s.user?.lastName,
    s.admissionNo,
    s.class?.name || '',
    s.gender || '',
    s.dob ? new Date(s.dob).toISOString().slice(0, 10) : '',
    s.address || '',
  ].map(escapeCsv).join(','))
  return [headers.join(','), ...rows].join('\n')
}

function teachersToCsv(teachers) {
  const headers = ['email', 'firstName', 'lastName', 'staffNo', 'department', 'qualification', 'specialization']
  const rows = teachers.map((t) => [
    t.user?.email,
    t.user?.firstName,
    t.user?.lastName,
    t.staffNo,
    t.department || '',
    t.qualification || '',
    t.specialization || '',
  ].map(escapeCsv).join(','))
  return [headers.join(','), ...rows].join('\n')
}

function registerImportRoutes(app, { prisma, requireRole, enforceStudentLimit }) {
  const admin = requireRole('SuperAdmin', 'SchoolAdmin')
  const studentLimit = enforceStudentLimit || ((_req, _res, next) => next())

  app.get('/api/export/students', admin, async (req, res) => {
    try {
      const schoolId = req.user.role === 'SuperAdmin' ? req.query.schoolId : req.user.schoolId
      if (!schoolId) return res.status(400).json({ error: 'schoolId required' })

      const students = await prisma.student.findMany({
        where: { schoolId },
        include: {
          user: { select: { email: true, firstName: true, lastName: true } },
          class: { select: { name: true } },
        },
        orderBy: { admissionNo: 'asc' },
      })

      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="students-export.csv"')
      res.send(studentsToCsv(students))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Export failed' })
    }
  })

  app.get('/api/export/teachers', admin, async (req, res) => {
    try {
      const schoolId = req.user.role === 'SuperAdmin' ? req.query.schoolId : req.user.schoolId
      if (!schoolId) return res.status(400).json({ error: 'schoolId required' })

      const teachers = await prisma.teacher.findMany({
        where: { schoolId },
        include: { user: { select: { email: true, firstName: true, lastName: true } } },
        orderBy: { staffNo: 'asc' },
      })

      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="teachers-export.csv"')
      res.send(teachersToCsv(teachers))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Export failed' })
    }
  })

  app.post('/api/import/students', admin, studentLimit, async (req, res) => {
    try {
      const schoolId = req.user.role === 'SuperAdmin' ? req.body.schoolId : req.user.schoolId
      if (!schoolId) return res.status(400).json({ error: 'schoolId required' })

      const rows = Array.isArray(req.body.rows)
        ? req.body.rows
        : req.body.csv ? parseCsv(req.body.csv) : []

      if (!rows.length) return res.status(400).json({ error: 'No rows to import. Send rows[] or csv string.' })

      const defaultPassword = req.body.defaultPassword || 'ChangeMe123!'
      const studentRole = await prisma.role.findUnique({ where: { name: 'Student' } })
      if (!studentRole) return res.status(400).json({ error: 'Student role missing' })

      const classes = await prisma.class.findMany({ where: { schoolId }, select: { id: true, name: true } })
      const classByName = Object.fromEntries(classes.map((c) => [c.name.toLowerCase(), c.id]))

      const results = { created: 0, skipped: 0, errors: [] }
      const hashedPassword = await bcrypt.hash(defaultPassword, 10)

      for (const [index, row] of rows.entries()) {
        const email = row.email?.trim()
        const firstName = row.firstName?.trim()
        const lastName = row.lastName?.trim()
        if (!email || !firstName || !lastName) {
          results.errors.push({ row: index + 1, error: 'email, firstName, lastName required' })
          results.skipped += 1
          continue
        }

        const existing = await prisma.user.findUnique({ where: { email } })
        if (existing) {
          results.errors.push({ row: index + 1, email, error: 'Email already exists' })
          results.skipped += 1
          continue
        }

        const classId = row.className ? classByName[row.className.toLowerCase()] || null : null

        try {
          const user = await prisma.user.create({
            data: {
              email,
              password: hashedPassword,
              firstName,
              lastName,
              roleId: studentRole.id,
              schoolId,
              isActive: true,
            },
          })
          await prisma.student.create({
            data: {
              userId: user.id,
              schoolId,
              admissionNo: row.admissionNo?.trim() || `ADM-${Date.now()}-${index}`,
              classId,
              gender: row.gender?.trim() || null,
              dob: row.dob ? new Date(row.dob) : null,
              address: row.address?.trim() || null,
              admissionDate: new Date(),
            },
          })
          results.created += 1
        } catch (err) {
          results.errors.push({ row: index + 1, email, error: err.message })
          results.skipped += 1
        }
      }

      res.json(results)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Import failed' })
    }
  })

  app.post('/api/import/teachers', admin, async (req, res) => {
    try {
      const schoolId = req.user.role === 'SuperAdmin' ? req.body.schoolId : req.user.schoolId
      if (!schoolId) return res.status(400).json({ error: 'schoolId required' })

      const rows = Array.isArray(req.body.rows)
        ? req.body.rows
        : req.body.csv ? parseCsv(req.body.csv) : []

      if (!rows.length) return res.status(400).json({ error: 'No rows to import' })

      const defaultPassword = req.body.defaultPassword || 'ChangeMe123!'
      const teacherRole = await prisma.role.findUnique({ where: { name: 'Teacher' } })
      if (!teacherRole) return res.status(400).json({ error: 'Teacher role missing' })

      const results = { created: 0, skipped: 0, errors: [] }
      const hashedPassword = await bcrypt.hash(defaultPassword, 10)

      for (const [index, row] of rows.entries()) {
        const email = row.email?.trim()
        const firstName = row.firstName?.trim()
        const lastName = row.lastName?.trim()
        if (!email || !firstName || !lastName) {
          results.errors.push({ row: index + 1, error: 'email, firstName, lastName required' })
          results.skipped += 1
          continue
        }

        const existing = await prisma.user.findUnique({ where: { email } })
        if (existing) {
          results.errors.push({ row: index + 1, email, error: 'Email already exists' })
          results.skipped += 1
          continue
        }

        try {
          const user = await prisma.user.create({
            data: {
              email,
              password: hashedPassword,
              firstName,
              lastName,
              roleId: teacherRole.id,
              schoolId,
              isActive: true,
            },
          })
          await prisma.teacher.create({
            data: {
              userId: user.id,
              schoolId,
              staffNo: row.staffNo?.trim() || `TCH-${Date.now()}-${index}`,
              department: row.department?.trim() || null,
              qualification: row.qualification?.trim() || null,
              specialization: row.specialization?.trim() || null,
              hireDate: new Date(),
            },
          })
          results.created += 1
        } catch (err) {
          results.errors.push({ row: index + 1, email, error: err.message })
          results.skipped += 1
        }
      }

      res.json(results)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Import failed' })
    }
  })

  app.post('/api/staff', admin, async (req, res) => {
    try {
      const {
        email, password, firstName, lastName, roleName, staffNo,
      } = req.body || {}
      const schoolId = req.user.role === 'SuperAdmin' ? req.body.schoolId : req.user.schoolId

      if (!schoolId || !email || !password || !firstName || !lastName || !roleName) {
        return res.status(400).json({ error: 'schoolId, email, password, firstName, lastName, roleName required' })
      }
      if (!ROLE_PROFILE_MODELS[roleName]) {
        return res.status(400).json({ error: `Role ${roleName} does not require a staff profile. Use /api/teachers for teachers.` })
      }

      const role = await prisma.role.findUnique({ where: { name: roleName } })
      if (!role) return res.status(400).json({ error: 'Role not found' })

      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) return res.status(400).json({ error: 'Email already exists' })

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
      const profile = await ensureRoleProfile(prisma, user.id, roleName, staffNo)

      res.status(201).json({ user: { id: user.id, email, firstName, lastName, roleName }, profile })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: err.message || 'Server error' })
    }
  })

  app.get('/api/staff/profile', requireRole(...Object.keys(ROLE_PROFILE_MODELS), 'SuperAdmin', 'SchoolAdmin'), async (req, res) => {
    try {
      const userId = req.query.userId || req.user.userId
      const roleName = req.query.roleName || req.user.role
      if (!ROLE_PROFILE_MODELS[roleName]) {
        return res.status(400).json({ error: 'This role does not use a staff profile record' })
      }
      let profile = await prisma[ROLE_PROFILE_MODELS[roleName]].findUnique({ where: { userId } })
      if (!profile) profile = await ensureRoleProfile(prisma, userId, roleName)
      res.json({ profile })
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })
}

module.exports = { registerImportRoutes, parseCsv, studentsToCsv, teachersToCsv }
