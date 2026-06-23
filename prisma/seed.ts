import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

const PERMISSIONS = [
  { name: 'users.create', description: 'Create users' },
  { name: 'users.read', description: 'View users' },
  { name: 'users.update', description: 'Update users' },
  { name: 'users.delete', description: 'Delete users' },
  { name: 'schools.manage', description: 'Manage schools' },
  { name: 'students.manage', description: 'Manage students' },
  { name: 'teachers.manage', description: 'Manage teachers' },
  { name: 'exams.create', description: 'Create exams' },
  { name: 'exams.grade', description: 'Grade exams' },
  { name: 'attendance.mark', description: 'Mark attendance' },
  { name: 'fees.manage', description: 'Manage fees' },
  { name: 'reports.view', description: 'View reports' },
  { name: 'reports.export', description: 'Export reports' },
]

async function ensurePermissions() {
  return Promise.all(
    PERMISSIONS.map((p) =>
      prisma.permission.upsert({
        where: { name: p.name },
        update: {},
        create: p,
      })
    )
  )
}

async function ensureRole(
  name: string,
  description: string,
  permissionNames: string[],
  allPermissions: { id: string; name: string }[]
) {
  const existing = await prisma.role.findUnique({ where: { name } })
  if (existing) return existing

  const permissions = allPermissions.filter((p) => permissionNames.includes(p.name))
  return prisma.role.create({
    data: {
      name,
      description,
      permissions: {
        create: permissions.map((p) => ({ permissionId: p.id })),
      },
    },
  })
}

async function seed() {
  console.log('Seeding database...')

  const permissions = await ensurePermissions()

  const superAdminRole = await ensureRole(
    'SuperAdmin',
    'Super administrator with full access',
    permissions.map((p) => p.name),
    permissions
  )
  const schoolAdminRole = await ensureRole(
    'SchoolAdmin',
    'School administrator',
    permissions.filter((p) => !p.name.includes('schools')).map((p) => p.name),
    permissions
  )
  await ensureRole(
    'Teacher',
    'Teacher',
    ['exams.create', 'exams.grade', 'attendance.mark', 'reports.view'],
    permissions
  )
  await ensureRole('Student', 'Student', ['reports.view', 'users.read'], permissions)
  await ensureRole('Parent', 'Parent/Guardian', ['reports.view', 'users.read'], permissions)
  await ensureRole(
    'Accountant',
    'Accountant',
    ['fees.manage', 'reports.view', 'reports.export'],
    permissions
  )

  let school = await prisma.school.findFirst({ where: { name: 'Demo Primary School' } })
  if (!school) {
    school = await prisma.school.create({
      data: {
        name: 'Demo Primary School',
        address: '123 Education Lane',
        city: 'Lagos',
        country: 'Nigeria',
        contactEmail: 'info@demoschool.edu',
        contactPhone: '+234801234567',
      },
    })
  }

  const hashedPassword = await bcrypt.hash('admin123', 10)

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      roleId: superAdminRole.id,
      isActive: true,
    },
  })

  const schoolAdmin = await prisma.user.upsert({
    where: { email: 'sadmin@demoschool.edu' },
    update: {},
    create: {
      email: 'sadmin@demoschool.edu',
      password: hashedPassword,
      firstName: 'School',
      lastName: 'Admin',
      roleId: schoolAdminRole.id,
      schoolId: school.id,
      isActive: true,
    },
  })

  const teacherRole = await prisma.role.findUnique({ where: { name: 'Teacher' } })
  const studentRole = await prisma.role.findUnique({ where: { name: 'Student' } })
  const parentRole = await prisma.role.findUnique({ where: { name: 'Parent' } })
  const accountantRole = await prisma.role.findUnique({ where: { name: 'Accountant' } })

  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@demoschool.edu' },
    update: {},
    create: {
      email: 'teacher@demoschool.edu',
      password: hashedPassword,
      firstName: 'Demo',
      lastName: 'Teacher',
      roleId: teacherRole?.id ?? schoolAdminRole.id,
      schoolId: school.id,
      isActive: true,
    },
  })

  if (teacherRole) {
    await prisma.teacher.upsert({
      where: { userId: teacher.id },
      update: {},
      create: {
        userId: teacher.id,
        schoolId: school.id,
        staffNo: 'T-1001',
        department: 'Science',
        hireDate: new Date('2023-08-01'),
      },
    })
  }

  const parent = await prisma.user.upsert({
    where: { email: 'parent@demoschool.edu' },
    update: {},
    create: {
      email: 'parent@demoschool.edu',
      password: hashedPassword,
      firstName: 'Demo',
      lastName: 'Parent',
      roleId: parentRole?.id ?? schoolAdminRole.id,
      schoolId: school.id,
      isActive: true,
    },
  })

  if (parentRole) {
    await prisma.parent.upsert({
      where: { userId: parent.id },
      update: {},
      create: {
        userId: parent.id,
        schoolId: school.id,
        occupation: 'Engineer',
      },
    })
  }

  const existingSession = await prisma.session.findFirst({
    where: { schoolId: school.id, name: '2024/2025 Session' },
  })
  if (!existingSession) {
    await prisma.session.create({
      data: {
        schoolId: school.id,
        name: '2024/2025 Session',
        startDate: new Date('2024-09-01'),
        endDate: new Date('2025-07-31'),
        active: true,
      },
    })
  }

  const existingClass = await prisma.class.findFirst({
    where: { schoolId: school.id, name: 'JSS 1' },
  })
  if (!existingClass) {
    await prisma.class.create({
      data: {
        schoolId: school.id,
        name: 'JSS 1',
        level: 'Junior Secondary',
        capacity: 40,
      },
    })
  }

  const student = await prisma.user.upsert({
    where: { email: 'student@demoschool.edu' },
    update: {},
    create: {
      email: 'student@demoschool.edu',
      password: hashedPassword,
      firstName: 'Demo',
      lastName: 'Student',
      roleId: studentRole?.id ?? schoolAdminRole.id,
      schoolId: school.id,
      isActive: true,
    },
  })

  if (studentRole) {
    await prisma.student.upsert({
      where: { userId: student.id },
      update: {},
      create: {
        userId: student.id,
        schoolId: school.id,
        admissionNo: 'ADM-1001',
        classId: existingClass?.id ?? undefined,
        parentId: parent.id,
        admissionDate: new Date('2024-09-01'),
      },
    })
  }

  const accountant = await prisma.user.upsert({
    where: { email: 'accountant@demoschool.edu' },
    update: {},
    create: {
      email: 'accountant@demoschool.edu',
      password: hashedPassword,
      firstName: 'Demo',
      lastName: 'Accountant',
      roleId: accountantRole?.id ?? schoolAdminRole.id,
      schoolId: school.id,
      isActive: true,
    },
  })

  if (accountantRole) {
    await prisma.accountant.upsert({
      where: { userId: accountant.id },
      update: {},
      create: {
        userId: accountant.id,
        staffNo: 'ACC-1001',
      },
    })
  }

  const fee = await prisma.fee.upsert({
    where: { id: 'fee-demo-0001' },
    update: {},
    create: {
      id: 'fee-demo-0001',
      schoolId: school.id,
      classId: existingClass?.id ?? undefined,
      name: 'Term 1 School Fees',
      amount: 25000,
      dueDate: new Date('2025-01-15'),
      description: 'Fee structure for JSS 1 Term 1',
      isActive: true,
    },
  })

  console.log('✓ Seeding completed')
  console.log(`✓ Super admin: ${superAdmin.email}`)
  console.log(`✓ School admin: ${schoolAdmin.email}`)
}

seed()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
