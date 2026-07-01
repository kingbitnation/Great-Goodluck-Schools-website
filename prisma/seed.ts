import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import crypto from 'crypto'

const prisma = new PrismaClient()

function hashBiometricTemplate(seed: string) {
  return crypto.createHash('sha256').update(seed).digest('hex')
}

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
  await ensureRole(
    'HRManager',
    'HR Manager',
    ['users.read', 'reports.view'],
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
        status: 'active',
        bankName: 'First Bank of Nigeria',
        bankAccountName: 'Demo Primary School',
        bankAccountNumber: '2034567890',
        primaryColor: '#f59e0b',
            secondaryColor: '#0F172A',
      },
    })
  } else {
    school = await prisma.school.update({
      where: { id: school.id },
      data: {
        bankName: 'First Bank of Nigeria',
        bankAccountName: 'Demo Primary School',
        bankAccountNumber: '2034567890',
        status: 'active',
        setupCompleted: true,
      },
    })
  }

  await prisma.schoolOnboarding.upsert({
    where: { schoolId: school.id },
    update: { profileDone: true, brandingDone: true, subscriptionDone: true, usersDone: true, completedAt: new Date() },
    create: {
      schoolId: school.id,
      profileDone: true,
      brandingDone: true,
      subscriptionDone: true,
      usersDone: true,
      completedAt: new Date(),
    },
  })

  const { PLAN_PRESETS } = require('../src/backend/lib/planLimits')
  const { seedPlanFeatures } = require('../src/backend/lib/subscriptionHelpers')

  const productionPlans = [
    { name: 'Starter', slug: 'starter', price: 25000, quarterlyPrice: 70000, yearlyPrice: 270000, sortOrder: 1, isPopular: false, contactSales: false },
    { name: 'Standard', slug: 'standard', price: 50000, quarterlyPrice: 140000, yearlyPrice: 540000, sortOrder: 2, isPopular: false, contactSales: false },
    { name: 'Professional', slug: 'professional', price: 90000, quarterlyPrice: 255000, yearlyPrice: 972000, sortOrder: 3, isPopular: true, contactSales: false },
    { name: 'Enterprise', slug: 'enterprise', price: 180000, quarterlyPrice: 510000, yearlyPrice: 1944000, sortOrder: 4, isPopular: false, contactSales: false },
    { name: 'Ultimate', slug: 'ultimate', price: 0, quarterlyPrice: null, yearlyPrice: null, sortOrder: 5, isPopular: false, contactSales: true },
  ]
  for (const p of productionPlans) {
    const limits = PLAN_PRESETS[p.slug]
    const plan = await prisma.subscriptionPlan.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        price: p.price,
        quarterlyPrice: p.quarterlyPrice,
        yearlyPrice: p.yearlyPrice,
        sortOrder: p.sortOrder,
        limits,
        maxStudents: limits.maxStudents as number | null,
        features: { lms: !!limits.lms, ai: !!limits.ai, cbt: !!limits.cbt, marketplace: !!limits.marketplace },
        isActive: true,
        isPopular: p.isPopular,
        contactSales: p.contactSales,
        trialDays: 14,
        graceDays: 7,
      },
      create: {
        name: p.name,
        slug: p.slug,
        price: p.price,
        quarterlyPrice: p.quarterlyPrice,
        yearlyPrice: p.yearlyPrice,
        sortOrder: p.sortOrder,
        limits,
        maxStudents: limits.maxStudents as number | null,
        features: { lms: !!limits.lms, ai: !!limits.ai, cbt: !!limits.cbt, marketplace: !!limits.marketplace },
        trialDays: 14,
        graceDays: 7,
        isActive: true,
        isPopular: p.isPopular,
        contactSales: p.contactSales,
      },
    })
    await seedPlanFeatures(prisma, plan.id, p.slug)
  }

  const addonCatalog = [
    { slug: 'custom-website', name: 'Custom Website Design', description: 'Professional website design and setup', price: 150000, billingType: 'one_time', sortOrder: 1 },
    { slug: 'business-email', name: 'Business Email Setup', description: 'Google Workspace or Microsoft 365 setup', price: 50000, billingType: 'one_time', sortOrder: 2 },
    { slug: 'extra-sms', name: 'Extra SMS Credits', description: '1,000 additional SMS credits', price: 15000, billingType: 'one_time', sortOrder: 3 },
    { slug: 'extra-storage', name: 'Extra Storage', description: '50GB additional cloud storage', price: 10000, billingType: 'monthly', sortOrder: 4 },
    { slug: 'extra-ai', name: 'Extra AI Credits', description: '500 additional AI credits', price: 25000, billingType: 'one_time', sortOrder: 5 },
    { slug: 'extra-staff', name: 'Additional Staff Accounts', description: '10 additional staff accounts', price: 20000, billingType: 'monthly', sortOrder: 6 },
    { slug: 'training', name: 'Training Sessions', description: '4-hour live training for your team', price: 75000, billingType: 'one_time', sortOrder: 7 },
    { slug: 'data-migration', name: 'Data Migration', description: 'Migrate data from your existing system', price: 200000, billingType: 'one_time', sortOrder: 8 },
    { slug: 'premium-support', name: 'Premium Support', description: 'Priority support with 4-hour SLA', price: 30000, billingType: 'monthly', sortOrder: 9 },
    { slug: 'mobile-app', name: 'Mobile App', description: 'Branded mobile app for your school', price: 500000, billingType: 'one_time', sortOrder: 10 },
    { slug: 'custom-integrations', name: 'Custom Integrations', description: 'API integrations with third-party tools', price: 350000, billingType: 'one_time', sortOrder: 11 },
  ]
  for (const a of addonCatalog) {
    await prisma.addonCatalog.upsert({
      where: { slug: a.slug },
      update: a,
      create: a,
    })
  }
  // Legacy plan slugs — keep for backward compatibility, mark inactive
  for (const legacy of [
    { name: 'Basic (legacy)', slug: 'basic', price: 50000, maxStudents: 200 },
    { name: 'Premium (legacy)', slug: 'premium', price: 250000, maxStudents: 1500 },
  ]) {
    await prisma.subscriptionPlan.upsert({
      where: { slug: legacy.slug },
      update: { isActive: false },
      create: {
        name: legacy.name,
        slug: legacy.slug,
        price: legacy.price,
        maxStudents: legacy.maxStudents,
        features: { lms: legacy.slug !== 'basic', ai: legacy.slug === 'premium' },
        isActive: false,
      },
    })
  }
  const standardPlan = await prisma.subscriptionPlan.findUnique({ where: { slug: 'standard' } })
  const professionalPlan = await prisma.subscriptionPlan.findUnique({ where: { slug: 'professional' } })
  const premiumPlan = professionalPlan || await prisma.subscriptionPlan.findUnique({ where: { slug: 'premium' } })
  if (premiumPlan) {
    await prisma.schoolSubscription.upsert({
      where: { schoolId: school.id },
      update: { planId: premiumPlan.id, status: 'active', billingInterval: 'yearly' },
      create: {
        schoolId: school.id,
        planId: premiumPlan.id,
        status: 'active',
        billingInterval: 'yearly',
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    })
    await prisma.aiCreditBalance.upsert({
      where: { schoolId: school.id },
      update: { monthlyGrant: 500, balance: 500, usedThisMonth: 0, periodStart: new Date() },
      create: { schoolId: school.id, monthlyGrant: 500, balance: 500, usedThisMonth: 0, periodStart: new Date() },
    })
  } else if (standardPlan) {
    await prisma.schoolSubscription.upsert({
      where: { schoolId: school.id },
      update: {},
      create: {
        schoolId: school.id,
        planId: standardPlan.id,
        status: 'active',
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
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

  const parentProfile = parentRole
    ? await prisma.parent.upsert({
        where: { userId: parent.id },
        update: {},
        create: {
          userId: parent.id,
          schoolId: school.id,
          occupation: 'Engineer',
        },
      })
    : null

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
  const demoClass =
    existingClass ??
    (await prisma.class.create({
      data: {
        schoolId: school.id,
        name: 'JSS 1',
        level: 'Junior Secondary',
        capacity: 40,
      },
    }))

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
      update: { parentId: parentProfile?.id ?? null, classId: demoClass.id },
      create: {
        userId: student.id,
        schoolId: school.id,
        admissionNo: 'ADM-1001',
        classId: demoClass.id,
        parentId: parentProfile?.id ?? null,
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
      classId: demoClass.id,
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

  const librarianRole = await prisma.role.upsert({
    where: { name: 'Librarian' },
    update: {},
    create: { name: 'Librarian', description: 'Library staff' },
  })
  const hostelRole = await prisma.role.upsert({
    where: { name: 'HostelManager' },
    update: {},
    create: { name: 'HostelManager', description: 'Hostel manager' },
  })
  const transportRole = await prisma.role.upsert({
    where: { name: 'TransportManager' },
    update: {},
    create: { name: 'TransportManager', description: 'Transport manager' },
  })
  const hrRole = await prisma.role.upsert({
    where: { name: 'HRManager' },
    update: {},
    create: { name: 'HRManager', description: 'Human resources manager' },
  })
  const biometricRole = await prisma.role.upsert({
    where: { name: 'BiometricManager' },
    update: {},
    create: { name: 'BiometricManager', description: 'Biometric and access control manager' },
  })
  const alumniRole = await prisma.role.upsert({
    where: { name: 'Alumni' },
    update: {},
    create: { name: 'Alumni', description: 'School alumni portal access' },
  })

  await prisma.user.upsert({
    where: { email: 'librarian@demoschool.edu' },
    update: {},
    create: {
      email: 'librarian@demoschool.edu',
      password: hashedPassword,
      firstName: 'Demo',
      lastName: 'Librarian',
      roleId: librarianRole.id,
      schoolId: school.id,
      isActive: true,
    },
  })
  await prisma.user.upsert({
    where: { email: 'hostel@demoschool.edu' },
    update: {},
    create: {
      email: 'hostel@demoschool.edu',
      password: hashedPassword,
      firstName: 'Demo',
      lastName: 'HostelMgr',
      roleId: hostelRole.id,
      schoolId: school.id,
      isActive: true,
    },
  })
  await prisma.user.upsert({
    where: { email: 'transport@demoschool.edu' },
    update: {},
    create: {
      email: 'transport@demoschool.edu',
      password: hashedPassword,
      firstName: 'Demo',
      lastName: 'TransportMgr',
      roleId: transportRole.id,
      schoolId: school.id,
      isActive: true,
    },
  })

  const hrUser = await prisma.user.upsert({
    where: { email: 'hr@demoschool.edu' },
    update: {},
    create: {
      email: 'hr@demoschool.edu',
      password: hashedPassword,
      firstName: 'Demo',
      lastName: 'HRManager',
      roleId: hrRole.id,
      schoolId: school.id,
      isActive: true,
    },
  })
  const biometricUser = await prisma.user.upsert({
    where: { email: 'biometric@demoschool.edu' },
    update: {},
    create: {
      email: 'biometric@demoschool.edu',
      password: hashedPassword,
      firstName: 'Demo',
      lastName: 'BiometricMgr',
      roleId: biometricRole.id,
      schoolId: school.id,
      isActive: true,
    },
  })
  await prisma.biometricManager.upsert({
    where: { userId: biometricUser.id },
    update: {},
    create: { userId: biometricUser.id, staffNo: 'BIO-001' },
  })
  await prisma.hrManager.upsert({
    where: { userId: hrUser.id },
    update: {},
    create: {
      userId: hrUser.id,
      schoolId: school.id,
      staffNo: 'HR-1001',
    },
  })

  const teacherProfile = await prisma.teacher.findUnique({ where: { userId: teacher.id } })
  const studentProfile = await prisma.student.findUnique({ where: { userId: student.id } })

  const mathSubject = await prisma.subject.upsert({
    where: { id: 'subject-demo-math' },
    update: { teacherId: teacherProfile?.id, classId: demoClass.id },
    create: {
      id: 'subject-demo-math',
      schoolId: school.id,
      code: 'MTH101',
      name: 'Mathematics',
      classId: demoClass.id,
      teacherId: teacherProfile?.id,
    },
  })

  await prisma.subject.upsert({
    where: { id: 'subject-demo-eng' },
    update: { teacherId: teacherProfile?.id, classId: demoClass.id },
    create: {
      id: 'subject-demo-eng',
      schoolId: school.id,
      code: 'ENG101',
      name: 'English Language',
      classId: demoClass.id,
      teacherId: teacherProfile?.id,
    },
  })

  const englishSubject = await prisma.subject.findUnique({ where: { id: 'subject-demo-eng' } })

  await prisma.book.upsert({
    where: { id: 'book-demo-001' },
    update: { schoolId: school.id },
    create: {
      id: 'book-demo-001',
      schoolId: school.id,
      title: 'Introduction to Science',
      author: 'Jane Doe',
      isbn: '978-0000000001',
      copies: 5,
      availableCopies: 5,
      category: 'Science',
    },
  })

  await prisma.book.upsert({
    where: { id: 'book-demo-002' },
    update: { schoolId: school.id },
    create: {
      id: 'book-demo-002',
      schoolId: school.id,
      title: 'Mathematics for JSS',
      author: 'Prof. Adebayo',
      isbn: '978-0000000002',
      copies: 3,
      availableCopies: 3,
      category: 'Academic',
    },
  })

  await prisma.book.upsert({
    where: { id: 'book-demo-003' },
    update: { schoolId: school.id },
    create: {
      id: 'book-demo-003',
      schoolId: school.id,
      title: 'Things Fall Apart',
      author: 'Chinua Achebe',
      isbn: '978-0000000003',
      copies: 4,
      availableCopies: 2,
      category: 'Fiction',
    },
  })

  await prisma.librarySetting.upsert({
    where: { schoolId: school.id },
    update: {},
    create: {
      schoolId: school.id,
      loanDays: 14,
      finePerDay: 50,
      maxBooksPerStudent: 3,
      currency: 'NGN',
    },
  })

  const hostel = await prisma.hostel.upsert({
    where: { id: 'hostel-demo-001' },
    update: { gender: 'mixed' },
    create: {
      id: 'hostel-demo-001',
      schoolId: school.id,
      name: 'Block A',
      capacity: 100,
      gender: 'mixed',
      description: 'Main boys and girls mixed block',
    },
  })

  await prisma.hostel.upsert({
    where: { id: 'hostel-demo-002' },
    update: {},
    create: {
      id: 'hostel-demo-002',
      schoolId: school.id,
      name: 'Block B',
      capacity: 80,
      gender: 'female',
      description: 'Girls hostel block',
    },
  })

  const room = await prisma.room.upsert({
    where: { id: 'room-demo-001' },
    update: { floor: '1', costPerTerm: 45000 },
    create: {
      id: 'room-demo-001',
      hostelId: hostel.id,
      roomNumber: 'A101',
      floor: '1',
      capacity: 4,
      currentOccupancy: 0,
      costPerTerm: 45000,
      amenities: ['fan', 'wardrobe'],
    },
  })

  await prisma.room.upsert({
    where: { id: 'room-demo-002' },
    update: {},
    create: {
      id: 'room-demo-002',
      hostelId: hostel.id,
      roomNumber: 'A102',
      floor: '1',
      capacity: 4,
      currentOccupancy: 0,
      costPerTerm: 45000,
    },
  })

  if (studentProfile) {
    const existingAlloc = await prisma.hostelAllocation.findFirst({
      where: { studentId: studentProfile.id, status: 'active' },
    })
    if (!existingAlloc) {
      await prisma.hostelAllocation.create({
        data: {
          schoolId: school.id,
          roomId: room.id,
          studentId: studentProfile.id,
          allocationDate: new Date(),
          status: 'active',
        },
      })
      await prisma.room.update({
        where: { id: room.id },
        data: { currentOccupancy: 1 },
      })
    }
  }

  const driver = await prisma.transportDriver.upsert({
    where: { id: 'driver-demo-001' },
    update: {},
    create: {
      id: 'driver-demo-001',
      schoolId: school.id,
      name: 'Mr. Johnson',
      phone: '+2348012345678',
      licenseNo: 'LAG-DRV-2024',
      status: 'active',
    },
  })

  const route = await prisma.transportRoute.upsert({
    where: { id: 'route-demo-001' },
    update: {
      estimatedMinutes: 35,
      stopsCount: 8,
      distanceKm: 12.5,
    },
    create: {
      id: 'route-demo-001',
      schoolId: school.id,
      name: 'City Center Route',
      startPoint: 'School Gate',
      endPoint: 'Lekki Phase 1',
      fare: 2000,
      estimatedMinutes: 35,
      stopsCount: 8,
      distanceKm: 12.5,
    },
  })

  const vehicle = await prisma.transportVehicle.upsert({
    where: { id: 'vehicle-demo-001' },
    update: {
      schoolId: school.id,
      driverRecordId: driver.id,
      driverName: driver.name,
      driverPhone: driver.phone,
    },
    create: {
      id: 'vehicle-demo-001',
      schoolId: school.id,
      registrationNo: 'COGG-001',
      model: 'Toyota Coaster',
      capacity: 30,
      driverRecordId: driver.id,
      driverName: driver.name,
      driverPhone: driver.phone,
      status: 'Active',
    },
  })

  await prisma.transportAllocation.upsert({
    where: { id: 'transport-alloc-demo-001' },
    update: {
      studentId: studentProfile?.id ?? null,
      schoolId: school.id,
      status: 'active',
    },
    create: {
      id: 'transport-alloc-demo-001',
      schoolId: school.id,
      vehicleId: vehicle.id,
      routeId: route.id,
      studentId: studentProfile?.id ?? null,
      status: 'active',
    },
  })

  await prisma.transportLiveLocation.upsert({
    where: { vehicleId: vehicle.id },
    update: {
      latitude: 6.4281,
      longitude: 3.4219,
      etaMinutes: 12,
      status: 'en_route',
      routeId: route.id,
    },
    create: {
      schoolId: school.id,
      vehicleId: vehicle.id,
      routeId: route.id,
      latitude: 6.4281,
      longitude: 3.4219,
      etaMinutes: 12,
      status: 'en_route',
    },
  })

  if (studentProfile && teacherProfile) {
    const demoExam = await prisma.exam.upsert({
      where: { id: 'exam-demo-001' },
      update: {},
      create: {
        id: 'exam-demo-001',
        schoolId: school.id,
        classId: demoClass.id,
        subjectId: mathSubject.id,
        teacherId: teacherProfile.id,
        name: 'Mid Term Examination',
        type: 'Essay',
        startDate: new Date('2025-01-10'),
        endDate: new Date('2025-01-10'),
        duration: 120,
        totalMarks: 100,
        published: true,
      },
    })

    await prisma.result.upsert({
      where: { id: 'result-demo-001' },
      update: {},
      create: {
        id: 'result-demo-001',
        examId: demoExam.id,
        studentId: studentProfile.id,
        subjectId: mathSubject.id,
        totalScore: 85,
        grade: 'A',
        gpa: 4.0,
        published: true,
        publishedAt: new Date(),
      },
    })

    if (englishSubject) {
      const existingEnglish = await prisma.result.findUnique({
        where: { examId_studentId: { examId: demoExam.id, studentId: studentProfile.id } },
      })
      if (!existingEnglish) {
        await prisma.result.create({
          data: {
            id: 'result-demo-002',
            examId: demoExam.id,
            studentId: studentProfile.id,
            subjectId: englishSubject.id,
            totalScore: 78,
            grade: 'B',
            gpa: 3.5,
            published: true,
            publishedAt: new Date(),
          },
        })
      }
    }

    await prisma.attendance.upsert({
      where: { id: 'attendance-demo-001' },
      update: {},
      create: {
        id: 'attendance-demo-001',
        studentId: studentProfile.id,
        classId: demoClass.id,
        date: new Date(),
        status: 'Present',
        markedById: teacher.id,
      },
    })
  }

  if (studentProfile && teacherProfile) {
    const lmsCourse = await prisma.lmsCourse.upsert({
      where: { id: 'lms-course-demo-001' },
      update: {},
      create: {
        id: 'lms-course-demo-001',
        schoolId: school.id,
        title: 'Introduction to Algebra',
        description: 'Basic algebra concepts for JSS 1 students.',
        subjectId: mathSubject.id,
        classId: demoClass.id,
        teacherId: teacherProfile.id,
        published: true,
        publishedAt: new Date(),
        modules: {
          create: [
            {
              id: 'lms-module-demo-001',
              title: 'Getting Started',
              description: 'Foundations of algebraic thinking',
              sortOrder: 0,
              lessons: {
                create: [
                  {
                    id: 'lms-lesson-demo-001',
                    title: 'What is Algebra?',
                    type: 'video',
                    resourceUrl: 'https://www.youtube.com/watch?v=NybHckSEQBI',
                    content: 'Watch the introduction video and take notes.',
                    sortOrder: 0,
                  },
                  {
                    id: 'lms-lesson-demo-002',
                    title: 'Variables and Expressions',
                    type: 'text',
                    content: 'A variable is a symbol (often x or y) that represents an unknown value. An expression combines variables, numbers, and operators.',
                    sortOrder: 1,
                  },
                ],
              },
            },
            {
              id: 'lms-module-demo-002',
              title: 'Practice',
              sortOrder: 1,
              lessons: {
                create: {
                  id: 'lms-lesson-demo-003',
                  title: 'Solving Simple Equations',
                  type: 'pdf',
                  resourceUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
                  content: 'Review the PDF worksheet and complete the exercises.',
                  sortOrder: 0,
                },
              },
            },
          ],
        },
        assignments: {
          create: {
            id: 'lms-assignment-demo-001',
            title: 'Algebra Homework 1',
            description: 'Solve the 5 problems from the practice module.',
            totalMarks: 20,
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
        },
      },
    })

    const enrollment = await prisma.lmsEnrollment.upsert({
      where: { courseId_studentId: { courseId: lmsCourse.id, studentId: studentProfile.id } },
      update: {},
      create: { courseId: lmsCourse.id, studentId: studentProfile.id },
    })

    await prisma.lmsLessonProgress.upsert({
      where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId: 'lms-lesson-demo-001' } },
      update: { completed: true, completedAt: new Date() },
      create: {
        enrollmentId: enrollment.id,
        lessonId: 'lms-lesson-demo-001',
        completed: true,
        completedAt: new Date(),
      },
    })

    for (const lessonId of ['lms-lesson-demo-002', 'lms-lesson-demo-003']) {
      await prisma.lmsLessonProgress.upsert({
        where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId } },
        update: { completed: true, completedAt: new Date() },
        create: {
          enrollmentId: enrollment.id,
          lessonId,
          completed: true,
          completedAt: new Date(),
        },
      })
    }

    await prisma.lmsEnrollment.update({
      where: { id: enrollment.id },
      data: { progressPercent: 100, completedAt: new Date() },
    })

    await prisma.lmsCertificate.upsert({
      where: { courseId_studentId: { courseId: lmsCourse.id, studentId: studentProfile.id } },
      update: {},
      create: {
        courseId: lmsCourse.id,
        studentId: studentProfile.id,
        certificateNumber: 'SP-CERT-2026-DEMO01',
        verifyCode: 'demo-lms-verify-2026',
      },
    })

    await prisma.lmsAssignmentSubmission.upsert({
      where: {
        assignmentId_studentId: { assignmentId: 'lms-assignment-demo-001', studentId: studentProfile.id },
      },
      update: {},
      create: {
        assignmentId: 'lms-assignment-demo-001',
        studentId: studentProfile.id,
        textAnswer: 'x = 5, y = 12, z = 3, w = 8, v = 20',
        submittedAt: new Date(),
      },
    })

    await prisma.liveClass.upsert({
      where: { id: 'live-class-demo-001' },
      update: { status: 'live', startedAt: new Date() },
      create: {
        id: 'live-class-demo-001',
        schoolId: school.id,
        title: 'Algebra Live Tutorial',
        description: 'Interactive revision session for JSS 1 Algebra.',
        roomCode: 'demo-live-01',
        teacherId: teacherProfile.id,
        classId: demoClass.id,
        subjectId: mathSubject.id,
        status: 'live',
        startedAt: new Date(),
        scheduledAt: new Date(),
      },
    })

    const cbtBank = await prisma.questionBank.upsert({
      where: { id: 'cbt-bank-demo-001' },
      update: {},
      create: {
        id: 'cbt-bank-demo-001',
        schoolId: school.id,
        subjectId: mathSubject.id,
        name: 'Mathematics CBT Bank',
        description: 'Reusable algebra and arithmetic questions',
      },
    })

    await prisma.questionBankItem.upsert({
      where: { id: 'cbt-bank-item-001' },
      update: {},
      create: {
        id: 'cbt-bank-item-001',
        bankId: cbtBank.id,
        type: 'MCQ',
        content: 'What is 7 × 8?',
        mark: 2,
        correctAnswer: '56',
        options: {
          create: [
            { label: 'A', text: '54', isCorrect: false },
            { label: 'B', text: '56', isCorrect: true },
            { label: 'C', text: '58', isCorrect: false },
            { label: 'D', text: '64', isCorrect: false },
          ],
        },
      },
    })

    const cbtExam = await prisma.exam.upsert({
      where: { id: 'cbt-exam-demo-001' },
      update: { published: true },
      create: {
        id: 'cbt-exam-demo-001',
        schoolId: school.id,
        classId: demoClass.id,
        subjectId: mathSubject.id,
        teacherId: teacherProfile.id,
        name: 'Mathematics CBT — Term 1',
        type: 'CBT',
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        duration: 30,
        totalMarks: 10,
        instructions: JSON.stringify({ description: 'Answer all questions. No calculators.', passingScore: 50, maxAttempts: 1 }),
        randomizeQuestions: true,
        randomizeOptions: true,
        published: true,
        questions: {
          create: [
            {
              id: 'cbt-q-demo-001',
              type: 'MCQ',
              content: 'What is 12 + 15?',
              mark: 2,
              options: {
                create: [
                  { label: 'A', text: '25', isCorrect: false },
                  { label: 'B', text: '27', isCorrect: true },
                  { label: 'C', text: '28', isCorrect: false },
                  { label: 'D', text: '30', isCorrect: false },
                ],
              },
            },
            {
              id: 'cbt-q-demo-002',
              type: 'TrueFalse',
              content: 'The square root of 81 is 9.',
              mark: 2,
              options: {
                create: [
                  { label: 'A', text: 'True', isCorrect: true },
                  { label: 'B', text: 'False', isCorrect: false },
                ],
              },
            },
            {
              id: 'cbt-q-demo-003',
              type: 'ShortAnswer',
              content: 'Solve for x: 2x + 4 = 10',
              mark: 3,
              correctAnswer: '3',
            },
          ],
        },
      },
    })
    void cbtExam
  }

  console.log('✓ Demo subjects, library, hostel, transport, results, LMS, live class, and CBT seeded')

  await prisma.user.updateMany({
    data: { emailVerified: true, emailVerifiedAt: new Date() },
  })
  console.log('✓ Demo users marked as email-verified')

  if (studentProfile) {
    await prisma.feeInstallment.upsert({
      where: { id: 'inst-demo-1' },
      update: {},
      create: {
        id: 'inst-demo-1',
        feeId: fee.id,
        label: '1st Installment (50%)',
        amount: 12500,
        dueDate: new Date('2025-01-15'),
        sortOrder: 1,
      },
    })
    await prisma.feeInstallment.upsert({
      where: { id: 'inst-demo-2' },
      update: {},
      create: {
        id: 'inst-demo-2',
        feeId: fee.id,
        label: '2nd Installment (50%)',
        amount: 12500,
        dueDate: new Date('2025-03-15'),
        sortOrder: 2,
      },
    })
    await prisma.feeAdjustment.upsert({
      where: { id: 'adj-demo-scholarship' },
      update: {},
      create: {
        id: 'adj-demo-scholarship',
        schoolId: school.id,
        studentId: studentProfile.id,
        feeId: fee.id,
        type: 'scholarship',
        value: 10,
        isPercent: true,
        reason: 'Merit scholarship — demo',
      },
    })
    console.log('✓ Fee installments and scholarship adjustment seeded')
  }

  const admissionCycle = await prisma.admissionCycle.upsert({
    where: { id: 'admission-cycle-demo-001' },
    update: {},
    create: {
      id: 'admission-cycle-demo-001',
      schoolId: school.id,
      name: '2025/2026 Intake',
      sessionLabel: '2025/2026',
      openDate: new Date('2025-01-01'),
      closeDate: new Date('2026-12-31'),
      isActive: true,
    },
  })

  await prisma.admissionApplication.upsert({
    where: { referenceNo: 'APP-DEMO-001' },
    update: {},
    create: {
      id: 'admission-app-demo-001',
      schoolId: school.id,
      cycleId: admissionCycle.id,
      referenceNo: 'APP-DEMO-001',
      studentName: 'Amina Bello',
      parentName: 'Mrs. Bello',
      email: 'parent.demo@example.com',
      phone: '+2348000000100',
      gradeApplied: 'JSS 1',
      message: 'Interested in science track.',
      status: 'under_review',
    },
  })

  await prisma.admissionApplication.upsert({
    where: { referenceNo: 'APP-DEMO-002' },
    update: {},
    create: {
      id: 'admission-app-demo-002',
      schoolId: school.id,
      cycleId: admissionCycle.id,
      referenceNo: 'APP-DEMO-002',
      studentName: 'Chidi Okonkwo',
      parentName: 'Mr. Okonkwo',
      email: 'chidi.parent@example.com',
      phone: '+2348000000101',
      gradeApplied: 'Primary 1',
      status: 'exam_scheduled',
      examScore: 72,
    },
  })

  console.log('✓ Admission cycle and demo applications seeded')

  const jobMath = await prisma.jobPosting.upsert({
    where: { id: 'job-demo-math-teacher' },
    update: {},
    create: {
      id: 'job-demo-math-teacher',
      schoolId: school.id,
      title: 'Mathematics Teacher',
      department: 'Secondary',
      description: 'Teach JSS and SSS mathematics. Minimum B.Ed or B.Sc with PGDE.',
      employmentType: 'full_time',
      status: 'open',
      closesAt: new Date('2026-12-31'),
    },
  })

  await prisma.jobPosting.upsert({
    where: { id: 'job-demo-admin-assistant' },
    update: {},
    create: {
      id: 'job-demo-admin-assistant',
      schoolId: school.id,
      title: 'Administrative Assistant',
      department: 'Administration',
      description: 'Support front office, records, and parent enquiries.',
      employmentType: 'full_time',
      status: 'open',
      closesAt: new Date('2026-09-30'),
    },
  })

  await prisma.jobApplication.upsert({
    where: { referenceNo: 'JOB-DEMO-001' },
    update: {},
    create: {
      id: 'job-app-demo-001',
      schoolId: school.id,
      postingId: jobMath.id,
      referenceNo: 'JOB-DEMO-001',
      fullName: 'Grace Adeyemi',
      email: 'grace.adeyemi@example.com',
      phone: '+2348000000200',
      coverLetter: 'Five years teaching experience in Lagos schools.',
      status: 'interview',
    },
  })

  if (teacherProfile) {
    const existingEmployee = await prisma.employee.findUnique({ where: { teacherId: teacherProfile.id } })
    if (!existingEmployee) {
      await prisma.employee.create({
        data: {
          schoolId: school.id,
          userId: teacher.id,
          teacherId: teacherProfile.id,
          employeeNo: teacherProfile.staffNo || 'T-1001',
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          email: teacher.email,
          department: teacherProfile.department,
          jobTitle: 'Teacher',
          employeeType: 'teacher',
          hireDate: teacherProfile.hireDate,
          status: 'active',
        },
      })
    }
  }

  const employeeForPayroll = await prisma.employee.findFirst({
    where: { schoolId: school.id, userId: teacher.id },
  })
  if (employeeForPayroll) {
    const demoGrade = await prisma.salaryGrade.upsert({
      where: { id: 'salary-grade-demo-teacher' },
      update: {},
      create: {
        id: 'salary-grade-demo-teacher',
        schoolId: school.id,
        name: 'Teacher Grade A',
        baseSalary: 120000,
        allowances: [
          { name: 'Transport Allowance', amount: 12000 },
          { name: 'Housing Allowance', amount: 20000 },
        ],
        isActive: true,
      },
    })
    await prisma.payrollSetting.upsert({
      where: { schoolId: school.id },
      update: {},
      create: {
        schoolId: school.id,
        currency: 'NGN',
        payeTaxRate: 7.5,
        pensionEmployeeRate: 8,
        pensionEmployerRate: 10,
        nhfRate: 2.5,
        taxFreeAllowance: 30000,
      },
    })
    await prisma.employeePayrollProfile.upsert({
      where: { employeeId: employeeForPayroll.id },
      update: {},
      create: {
        employeeId: employeeForPayroll.id,
        gradeId: demoGrade.id,
        baseSalary: 120000,
        allowances: demoGrade.allowances || [],
        bankName: 'Demo Bank',
        bankAccount: '0123456789',
        customDeductions: [{ name: 'Staff Cooperative', amount: 3000 }],
      },
    })
  }

  console.log('✓ HR jobs, demo application, employee profile, and payroll config seeded')

  if (studentProfile) {
    await prisma.biometricSetting.upsert({
      where: { schoolId: school.id },
      update: {},
      create: { schoolId: school.id },
    })

    const gateDevice = await prisma.biometricDevice.upsert({
      where: { id: 'bio-device-gate-001' },
      update: {},
      create: {
        id: 'bio-device-gate-001',
        schoolId: school.id,
        name: 'Main Gate Terminal',
        location: 'School Main Gate',
        deviceType: 'gate',
        methods: 'fingerprint,facial',
        direction: 'both',
        apiKey: 'demo-gate-api-key-001',
      },
    })

    const classroomDevice = await prisma.biometricDevice.upsert({
      where: { id: 'bio-device-class-001' },
      update: {},
      create: {
        id: 'bio-device-class-001',
        schoolId: school.id,
        name: 'JSS1 Classroom Scanner',
        location: 'Block B - Room 12',
        deviceType: 'classroom',
        methods: 'fingerprint,facial',
        direction: 'in',
        apiKey: 'demo-class-api-key-001',
      },
    })

    await prisma.biometricEnrollment.upsert({
      where: { schoolId_studentId_method: { schoolId: school.id, studentId: studentProfile.id, method: 'fingerprint' } },
      update: {},
      create: {
        schoolId: school.id,
        personType: 'student',
        studentId: studentProfile.id,
        method: 'fingerprint',
        templateHash: hashBiometricTemplate(`student-${studentProfile.id}-fingerprint`),
        label: 'Demo Student Fingerprint',
        enrolledById: biometricUser.id,
      },
    })

  if (employeeForPayroll) {
      await prisma.biometricEnrollment.upsert({
        where: { schoolId_employeeId_method: { schoolId: school.id, employeeId: employeeForPayroll.id, method: 'fingerprint' } },
        update: {},
        create: {
          schoolId: school.id,
          personType: 'employee',
          employeeId: employeeForPayroll.id,
          method: 'fingerprint',
          templateHash: hashBiometricTemplate(`employee-${employeeForPayroll.id}-fingerprint`),
          label: 'Demo Teacher Fingerprint',
          enrolledById: biometricUser.id,
        },
      })
    }

    await prisma.biometricEvent.createMany({
      data: [
        {
          schoolId: school.id,
          deviceId: gateDevice.id,
          eventType: 'access',
          method: 'fingerprint',
          personType: 'employee',
          employeeId: employeeForPayroll?.id || null,
          direction: 'in',
          matchScore: 0.98,
          status: 'granted',
          notes: 'Staff morning entry',
        },
        {
          schoolId: school.id,
          deviceId: classroomDevice.id,
          eventType: 'attendance',
          method: 'fingerprint',
          personType: 'student',
          studentId: studentProfile.id,
          direction: 'in',
          matchScore: 0.96,
          status: 'granted',
          notes: 'Morning class attendance',
        },
      ],
      skipDuplicates: true,
    })
    console.log('✓ Biometric devices, enrollments, and demo access logs seeded')
  }

  if (studentProfile) {
    const certBase = {
      schoolId: school.id,
      studentId: studentProfile.id,
      recipientName: `${student.firstName} ${student.lastName}`.trim(),
      sessionLabel: '2025/2026',
      className: demoClass.name,
      issuedById: schoolAdmin.id,
      status: 'active',
    }

    await prisma.schoolCertificate.upsert({
      where: { certificateNumber: 'SP-GRA-2026-DEMO01' },
      update: {},
      create: {
        ...certBase,
        certificateType: 'graduation',
        title: 'Certificate of Graduation',
        description: 'Completed all graduation requirements with distinction.',
        certificateNumber: 'SP-GRA-2026-DEMO01',
        verifyCode: 'demo-grad-verify-2026',
      },
    })
    await prisma.schoolCertificate.upsert({
      where: { certificateNumber: 'SP-ATT-2026-DEMO01' },
      update: {},
      create: {
        ...certBase,
        certificateType: 'attendance',
        title: 'Certificate of Attendance',
        description: 'Maintained 98% attendance throughout the academic session.',
        certificateNumber: 'SP-ATT-2026-DEMO01',
        verifyCode: 'demo-attendance-verify-2026',
        metadata: { attendanceRate: 98 },
      },
    })
    await prisma.schoolCertificate.upsert({
      where: { certificateNumber: 'SP-EXC-2026-DEMO01' },
      update: {},
      create: {
        ...certBase,
        certificateType: 'excellence',
        title: 'Certificate of Excellence',
        description: 'Awarded for outstanding academic performance in Mathematics.',
        certificateNumber: 'SP-EXC-2026-DEMO01',
        verifyCode: 'demo-excellence-verify-2026',
        metadata: { award: 'Best in Mathematics' },
      },
    })
    console.log('✓ Demo school certificates (graduation, attendance, excellence) seeded')

    const expiry = new Date()
    expiry.setFullYear(expiry.getFullYear() + 1)

    await prisma.digitalIdCard.upsert({
      where: { cardNumber: 'SP-ID-STU-2026-DEMO01' },
      update: {},
      create: {
        schoolId: school.id,
        cardType: 'student',
        studentId: studentProfile.id,
        holderName: `${student.firstName} ${student.lastName}`.trim(),
        roleLabel: 'Student',
        departmentOrClass: demoClass.name,
        idNumber: studentProfile.admissionNo,
        bloodType: studentProfile.bloodType,
        cardNumber: 'SP-ID-STU-2026-DEMO01',
        verifyCode: 'demo-student-id-2026',
        expiresAt: expiry,
        issuedById: schoolAdmin.id,
        status: 'active',
      },
    })
  }

  const employeeForId = await prisma.employee.findFirst({ where: { schoolId: school.id, userId: teacher.id } })
  if (employeeForId) {
    const expiry = new Date()
    expiry.setFullYear(expiry.getFullYear() + 1)
    await prisma.digitalIdCard.upsert({
      where: { cardNumber: 'SP-ID-STF-2026-DEMO01' },
      update: {},
      create: {
        schoolId: school.id,
        cardType: 'staff',
        employeeId: employeeForId.id,
        holderName: `${teacher.firstName} ${teacher.lastName}`.trim(),
        roleLabel: employeeForId.jobTitle,
        departmentOrClass: employeeForId.department,
        idNumber: employeeForId.employeeNo,
        cardNumber: 'SP-ID-STF-2026-DEMO01',
        verifyCode: 'demo-staff-id-2026',
        expiresAt: expiry,
        issuedById: schoolAdmin.id,
        status: 'active',
      },
    })
    console.log('✓ Demo student and staff digital ID cards seeded')
  }

  const alumniUser = await prisma.user.upsert({
    where: { email: 'alumni@demoschool.edu' },
    update: {},
    create: {
      email: 'alumni@demoschool.edu',
      password: hashedPassword,
      firstName: 'Ada',
      lastName: 'Okonkwo',
      roleId: alumniRole.id,
      schoolId: school.id,
      isActive: true,
    },
  })

  const mentorProfile = await prisma.alumniProfile.upsert({
    where: { schoolId_email: { schoolId: school.id, email: 'alumni@demoschool.edu' } },
    update: { userId: alumniUser.id },
    create: {
      schoolId: school.id,
      userId: alumniUser.id,
      firstName: 'Ada',
      lastName: 'Okonkwo',
      email: 'alumni@demoschool.edu',
      phone: '+2348012345678',
      graduationYear: 2018,
      className: 'SSS 3A',
      currentRole: 'Software Engineer',
      company: 'TechBridge Africa',
      city: 'Lagos',
      country: 'Nigeria',
      bio: 'Passionate about mentoring the next generation of STEM leaders.',
      openToMentor: true,
      isPublic: true,
      status: 'active',
    },
  })

  await prisma.alumniProfile.upsert({
    where: { schoolId_email: { schoolId: school.id, email: 'chidi.egwu@example.com' } },
    update: {},
    create: {
      schoolId: school.id,
      firstName: 'Chidi',
      lastName: 'Egwu',
      email: 'chidi.egwu@example.com',
      graduationYear: 2015,
      className: 'SSS 2B',
      currentRole: 'Medical Doctor',
      company: 'Lagos University Teaching Hospital',
      city: 'Lagos',
      openToMentor: false,
      isPublic: true,
      status: 'active',
    },
  })

  const reunionDate = new Date()
  reunionDate.setMonth(reunionDate.getMonth() + 2)

  const alumniEvent = await prisma.alumniEvent.upsert({
    where: { id: 'alumni-event-demo-reunion-2026' },
    update: {},
    create: {
      id: 'alumni-event-demo-reunion-2026',
      schoolId: school.id,
      title: 'Class of 2018 Reunion',
      description: 'An evening of networking, memories, and giving back to our alma mater.',
      venue: 'School Main Hall',
      eventDate: reunionDate,
      capacity: 150,
      isPublic: true,
      status: 'published',
    },
  })

  await prisma.alumniEventRsvp.upsert({
    where: { eventId_alumniId: { eventId: alumniEvent.id, alumniId: mentorProfile.id } },
    update: {},
    create: { eventId: alumniEvent.id, alumniId: mentorProfile.id, status: 'going', guests: 1 },
  })

  await prisma.alumniDonation.upsert({
    where: { reference: 'ALM-DEMO-COMPLETED-2026' },
    update: {},
    create: {
      schoolId: school.id,
      alumniId: mentorProfile.id,
      donorName: 'Ada Okonkwo',
      donorEmail: 'alumni@demoschool.edu',
      amount: 50000,
      currency: 'NGN',
      gateway: 'paystack',
      reference: 'ALM-DEMO-COMPLETED-2026',
      status: 'completed',
      message: 'Supporting the science lab renovation fund.',
      paidAt: new Date(),
    },
  })

  if (studentProfile) {
    await prisma.alumniMentorship.upsert({
      where: { id: 'alumni-mentorship-demo-2026' },
      update: {},
      create: {
        id: 'alumni-mentorship-demo-2026',
        schoolId: school.id,
        mentorId: mentorProfile.id,
        menteeStudentId: studentProfile.id,
        menteeName: `${student.firstName} ${student.lastName}`.trim(),
        menteeEmail: student.email,
        focusArea: 'STEM careers',
        status: 'active',
        matchedAt: new Date(),
        notes: 'Monthly virtual check-ins on coding and university prep.',
      },
    })
  }

  console.log('✓ Demo alumni profiles, event, donation, and mentorship seeded')

  const uniformShirt = await prisma.marketplaceProduct.upsert({
    where: { id: 'mkt-demo-uniform-shirt' },
    update: {},
    create: {
      id: 'mkt-demo-uniform-shirt',
      schoolId: school.id,
      name: 'School Shirt (White)',
      description: 'Official white school shirt with embroidered crest.',
      category: 'uniform',
      sku: 'UNI-SHIRT-WHT',
      price: 8500,
      sizes: ['S', 'M', 'L', 'XL'],
      stockQty: 120,
      isActive: true,
    },
  })
  await prisma.marketplaceProduct.upsert({
    where: { id: 'mkt-demo-uniform-skirt' },
    update: {},
    create: {
      id: 'mkt-demo-uniform-skirt',
      schoolId: school.id,
      name: 'School Skirt (Navy)',
      description: 'Pleated navy skirt for female students.',
      category: 'uniform',
      sku: 'UNI-SKIRT-NVY',
      price: 12000,
      sizes: ['S', 'M', 'L'],
      stockQty: 80,
      isActive: true,
    },
  })
  await prisma.marketplaceProduct.upsert({
    where: { id: 'mkt-demo-textbook-math' },
    update: {},
    create: {
      id: 'mkt-demo-textbook-math',
      schoolId: school.id,
      name: 'Mathematics Textbook (JSS 1)',
      description: 'Approved curriculum mathematics workbook.',
      category: 'book',
      sku: 'BK-MATH-JSS1',
      price: 4500,
      sizes: [],
      stockQty: 200,
      isActive: true,
    },
  })
  await prisma.marketplaceProduct.upsert({
    where: { id: 'mkt-demo-supplies-set' },
    update: {},
    create: {
      id: 'mkt-demo-supplies-set',
      schoolId: school.id,
      name: 'Stationery Starter Pack',
      description: 'Pens, pencils, ruler, and notebooks bundle.',
      category: 'supplies',
      sku: 'SUP-STARTER',
      price: 3500,
      sizes: [],
      stockQty: 150,
      isActive: true,
    },
  })

  if (studentProfile) {
    await prisma.marketplaceOrder.upsert({
      where: { orderNumber: 'ORD-DEMO-MKT-2026' },
      update: {},
      create: {
        schoolId: school.id,
        userId: student.id,
        orderNumber: 'ORD-DEMO-MKT-2026',
        customerName: `${student.firstName} ${student.lastName}`.trim(),
        customerEmail: student.email,
        totalAmount: 8500,
        gateway: 'paystack',
        reference: 'MKT-DEMO-COMPLETED-2026',
        status: 'fulfilled',
        paidAt: new Date(),
        items: {
          create: [{
            productId: uniformShirt.id,
            productName: uniformShirt.name,
            size: 'M',
            quantity: 1,
            unitPrice: 8500,
            subtotal: 8500,
          }],
        },
      },
    })
  }

  console.log('✓ Demo marketplace products and sample order seeded')

  const now = new Date()
  const newsDate1 = new Date('2025-09-01')
  const newsDate2 = new Date('2025-11-10')
  const newsDate3 = new Date('2025-10-15')

  await prisma.publicPost.upsert({
    where: { schoolId_slug: { schoolId: school.id, slug: 'welcome-2025-2026' } },
    update: {},
    create: {
      schoolId: school.id,
      postType: 'news',
      slug: 'welcome-2025-2026',
      title: 'Welcome to 2025/2026 Session',
      excerpt: 'We warmly welcome all students and parents to a new academic year filled with opportunity.',
      body: 'We warmly welcome all students and parents to a new academic year filled with opportunity, growth, and excellence.',
      author: 'School Admin',
      badge: 'New',
      icon: '📚',
      published: true,
      publishedAt: newsDate1,
    },
  })
  await prisma.publicPost.upsert({
    where: { schoolId_slug: { schoolId: school.id, slug: 'cbt-exams-live' } },
    update: {},
    create: {
      schoolId: school.id,
      postType: 'news',
      slug: 'cbt-exams-live',
      title: 'CBT Examinations Now Live',
      excerpt: 'Students can now take objective examinations online through the student portal.',
      body: 'Students can now take objective examinations online through the secure student portal with instant results and detailed analytics.',
      author: 'ICT Department',
      badge: 'Important',
      icon: '💻',
      published: true,
      publishedAt: newsDate2,
    },
  })
  await prisma.publicPost.upsert({
    where: { schoolId_slug: { schoolId: school.id, slug: 'inter-house-sports' } },
    update: {},
    create: {
      schoolId: school.id,
      postType: 'news',
      slug: 'inter-house-sports',
      title: 'Inter-House Sports Announced',
      excerpt: 'Mark your calendars for our annual sports festival.',
      body: 'Our annual inter-house sports competition celebrates teamwork, fitness, and school spirit across all grade levels.',
      badge: 'Update',
      icon: '🏆',
      published: true,
      publishedAt: newsDate3,
    },
  })
  await prisma.publicPost.upsert({
    where: { schoolId_slug: { schoolId: school.id, slug: 'digital-literacy' } },
    update: {},
    create: {
      schoolId: school.id,
      postType: 'blog',
      slug: 'digital-literacy',
      title: 'Building Digital Literacy in Nigerian Schools',
      excerpt: 'Technology integration prepares students for modern assessments and careers.',
      body: 'Technology integration is no longer optional. Our LMS and CBT platforms prepare students for modern assessments and careers.',
      author: 'Admin',
      published: true,
      publishedAt: new Date('2024-10-05'),
    },
  })
  await prisma.publicPost.upsert({
    where: { schoolId_slug: { schoolId: school.id, slug: 'parent-engagement' } },
    update: {},
    create: {
      schoolId: school.id,
      postType: 'blog',
      slug: 'parent-engagement',
      title: 'Parent Engagement Best Practices',
      excerpt: 'Regular communication between home and school improves outcomes.',
      body: 'Regular communication between home and school improves attendance, behaviour, and academic outcomes.',
      author: 'School Admin',
      published: true,
      publishedAt: new Date('2024-09-20'),
    },
  })

  const eventDates = [
    { id: 'pub-ev-resumption', title: 'New Session Resumption', month: 8, day: 1, category: 'Upcoming', venue: 'Main Campus' },
    { id: 'pub-ev-sports', title: 'Inter-House Sports', month: 9, day: 15, category: 'Sports', venue: 'School Field' },
    { id: 'pub-ev-science', title: 'Science & Technology Fair', month: 10, day: 20, category: 'Academic', venue: 'STEM Block' },
    { id: 'pub-ev-concert', title: 'Carol & End-of-Year Concert', month: 11, day: 10, category: 'Culture', venue: 'Assembly Hall' },
  ]
  for (const ev of eventDates) {
    const eventDate = new Date(now.getFullYear(), ev.month, ev.day)
    if (eventDate < now) eventDate.setFullYear(eventDate.getFullYear() + 1)
    await prisma.publicEvent.upsert({
      where: { id: ev.id },
      update: {},
      create: {
        id: ev.id,
        schoolId: school.id,
        title: ev.title,
        venue: ev.venue,
        category: ev.category,
        eventDate,
        isFeatured: true,
        published: true,
      },
    })
  }

  const galleryItems = [
    { id: 'pub-gal-lab', title: 'Science Laboratory', colorClass: 'from-blue-500 to-cyan-500' },
    { id: 'pub-gal-sports', title: 'Sports Day', colorClass: 'from-green-500 to-emerald-500' },
    { id: 'pub-gal-grad', title: 'Graduation Ceremony', colorClass: 'from-purple-500 to-pink-500' },
    { id: 'pub-gal-library', title: 'Library', colorClass: 'from-amber-500 to-orange-500' },
    { id: 'pub-gal-class', title: 'Classroom Learning', colorClass: 'from-indigo-500 to-blue-500' },
    { id: 'pub-gal-culture', title: 'Cultural Day', colorClass: 'from-rose-500 to-red-500' },
  ]
  for (let i = 0; i < galleryItems.length; i++) {
    const g = galleryItems[i]
    await prisma.publicGalleryItem.upsert({
      where: { id: g.id },
      update: {},
      create: { id: g.id, schoolId: school.id, title: g.title, colorClass: g.colorClass, sortOrder: i, published: true },
    })
  }

  const staffMembers = [
    { id: 'pub-staff-principal', name: 'Mrs. Ada Okafor', role: 'Principal', dept: 'Administration', order: 0 },
    { id: 'pub-staff-vp', name: 'Mr. James Eze', role: 'Vice Principal (Academics)', dept: 'Academics', order: 1 },
    { id: 'pub-staff-science', name: 'Dr. Funke Bello', role: 'Head of Science', dept: 'Science', order: 2 },
    { id: 'pub-staff-lang', name: 'Mr. Tunde Adeyemi', role: 'Head of Languages', dept: 'Languages', order: 3 },
  ]
  for (const s of staffMembers) {
    await prisma.publicStaffMember.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        schoolId: school.id,
        fullName: s.name,
        roleTitle: s.role,
        department: s.dept,
        sortOrder: s.order,
        published: true,
      },
    })
  }

  const pageSeeds = [
    {
      slug: 'about',
      title: 'About Us',
      subtitle: 'A legacy of excellence since 1999',
      body: {
        paragraphs: [
          'Demo Primary School is a sample tenant for testing SchoolPilot — academics, fees, CBT, LMS, and parent portals.',
        ],
        values: [
          { title: 'Excellence', desc: 'Highest standards in every lesson and interaction.' },
          { title: 'Integrity', desc: 'Honesty and moral courage at our core.' },
          { title: 'Innovation', desc: 'Modern tools for tomorrow\'s leaders.' },
        ],
        vision: 'To produce globally competitive graduates with strong academics, moral values, and technological skills.',
        mission: 'To provide quality education that empowers every student to reach their full potential.',
      },
    },
    {
      slug: 'mission',
      title: 'Our Mission',
      subtitle: 'What we do every day',
      body: {
        paragraphs: [
          'To provide quality education that combines traditional values with modern technology, empowering students to achieve their full potential.',
          'We are committed to an inclusive environment that supports academic excellence, character development, and lifelong learning.',
        ],
      },
    },
    {
      slug: 'vision',
      title: 'Our Vision',
      subtitle: 'Where we are headed',
      body: {
        paragraphs: [
          'To be a leading Nigerian school recognised for academic excellence, moral leadership, and innovation in digital learning.',
        ],
      },
    },
    {
      slug: 'history',
      title: 'Our History',
      subtitle: 'A legacy of excellence',
      body: {
        paragraphs: [
          'Demo Primary School was created as a sample school on the SchoolPilot platform.',
          'Over the years we have grown from a single campus to a multi-program institution serving primary and secondary students.',
        ],
        bullets: [
          'Founded with a focus on academic rigor and moral instruction',
          'Expanded junior and senior secondary programs',
          'Launched computer-based testing and digital library services',
          'Introduced school management portal for parents and students',
        ],
      },
    },
    {
      slug: 'academics',
      title: 'Academics',
      subtitle: 'Programs and curriculum',
      body: {
        paragraphs: [
          'Our curriculum blends national standards with STEM enrichment, languages, arts, and character education.',
        ],
        bullets: ['Nursery and Primary', 'JSS 1–3', 'SSS 1–3', 'Science, Commercial, and Arts tracks', 'CBT examinations and digital report cards'],
      },
    },
    {
      slug: 'departments',
      title: 'Departments',
      subtitle: 'Academic and support units',
      body: {
        paragraphs: ['Each department is led by experienced coordinators who oversee curriculum delivery and student welfare.'],
        bullets: ['Languages & Humanities', 'Mathematics & Sciences', 'Commercial Studies', 'Creative & Vocational Arts', 'ICT & Computer Studies', 'Sports & Physical Education', 'Guidance & Counselling', 'Library & Learning Resources'],
      },
    },
    {
      slug: 'faq',
      title: 'FAQ',
      subtitle: 'Frequently asked questions',
      body: {
        faqs: [
          { q: 'How do I apply for admission?', a: 'Complete the online application form under Apply Online. Our admissions team will review and contact you.' },
          { q: 'How do students access the portal?', a: 'Students receive login credentials from the school. Visit the Portal Login page and sign in.' },
          { q: 'How are fees paid?', a: 'Fees can be viewed in the student or parent portal with online and manual payment options.' },
          { q: 'Does the school offer boarding?', a: 'Yes. Hostel facilities are available with room allocation managed through the hostel module.' },
          { q: 'How can parents track progress?', a: 'Parents can log in to view attendance, results, fees, and messages related to their children.' },
        ],
      },
    },
    {
      slug: 'admissions',
      title: 'Admissions',
      subtitle: 'Join our learning community',
      body: {
        paragraphs: ['We welcome applications for Nursery, Primary, and Secondary programs each academic session.'],
        highlight: { title: '2025/2026 — Now Accepting Applications', desc: 'Limited spaces available. Early application encouraged.' },
        requirements: ['Completed application form', 'Birth certificate or age declaration', 'Previous school records', 'Passport photographs', 'Entrance assessment where applicable'],
      },
    },
    {
      slug: 'privacy',
      title: 'Privacy Policy',
      subtitle: 'How we protect your data',
      body: {
        paragraphs: [
          'We collect only information necessary to operate our school services and protect student data in accordance with applicable regulations.',
          'Portal credentials, academic records, and payment data are stored securely and never sold to third parties.',
        ],
      },
    },
    {
      slug: 'terms',
      title: 'Terms of Use',
      subtitle: 'Website and portal terms',
      body: {
        paragraphs: [
          'By using this website and school portal you agree to use the services responsibly and in accordance with school policies.',
          'Unauthorized access to staff or student accounts is prohibited and may result in disciplinary or legal action.',
        ],
      },
    },
    {
      slug: 'home-features',
      title: 'Home Features',
      body: {
        features: [
          { title: 'Digital Portal', desc: 'Results, fees, CBT, and LMS in one secure platform.' },
          { title: 'Expert Faculty', desc: 'Qualified teachers dedicated to every student.' },
          { title: 'Modern Facilities', desc: 'Science labs, library, sports, and ICT centres.' },
          { title: 'Moral Education', desc: 'Character development woven into daily school life.' },
        ],
      },
    },
    {
      slug: 'principal-message',
      title: 'Principal Message',
      body: {
        principal: {
          name: 'King Bit',
          title: 'Founder, SchoolPilot',
          initials: 'KB',
          paragraphs: [
            'Welcome to our school — a place where every child is seen, valued, and challenged to reach their fullest potential.',
            'Our commitment goes beyond the classroom. With modern facilities, dedicated teachers, and a digital learning platform, we prepare students for life.',
          ],
        },
      },
    },
  ]

  for (const p of pageSeeds) {
    await prisma.publicPageContent.upsert({
      where: { schoolId_slug: { schoolId: school.id, slug: p.slug } },
      update: { body: p.body, title: p.title, subtitle: p.subtitle || null },
      create: {
        schoolId: school.id,
        slug: p.slug,
        title: p.title,
        subtitle: p.subtitle || null,
        body: p.body,
        published: true,
      },
    })
  }

  const statSeeds = [
    { label: 'Students', value: '1000+', order: 0 },
    { label: 'Expert Teachers', value: '80+', order: 1 },
    { label: 'Years of Excellence', value: '25+', order: 2 },
    { label: 'WAEC Pass Rate', value: '98%', order: 3 },
  ]
  for (const st of statSeeds) {
    await prisma.publicSiteStat.upsert({
      where: { schoolId_label: { schoolId: school.id, label: st.label } },
      update: { value: st.value, sortOrder: st.order },
      create: { schoolId: school.id, label: st.label, value: st.value, sortOrder: st.order },
    })
  }

  console.log('✓ Demo public website CMS content seeded')

  // Notification settings & demo in-app notifications
  const webpush = require('web-push')
  const vapidKeys = webpush.generateVAPIDKeys()
  await prisma.notificationSetting.upsert({
    where: { schoolId: school.id },
    update: {
      pushEnabled: true,
      vapidPublicKey: vapidKeys.publicKey,
      vapidPrivateKey: vapidKeys.privateKey,
      vapidSubject: 'mailto:info@demoschool.edu',
      channelDefaults: {
        login: ['email'],
        results: ['email', 'in_app', 'sms', 'push'],
        attendance: ['email', 'in_app', 'sms', 'push'],
        fee: ['email', 'in_app', 'sms'],
        payment: ['email', 'in_app', 'sms'],
        admission: ['email', 'in_app', 'push'],
        announcement: ['in_app', 'push'],
        marketplace: ['email', 'in_app', 'push'],
      },
    },
    create: {
      schoolId: school.id,
      smsEnabled: false,
      smsProvider: 'termii',
      termiiSenderId: 'SchoolPilot',
      pushEnabled: true,
      vapidPublicKey: vapidKeys.publicKey,
      vapidPrivateKey: vapidKeys.privateKey,
      vapidSubject: 'mailto:info@demoschool.edu',
      channelDefaults: {
        login: ['email'],
        results: ['email', 'in_app', 'sms', 'push'],
        attendance: ['email', 'in_app', 'sms', 'push'],
        fee: ['email', 'in_app', 'sms'],
        payment: ['email', 'in_app', 'sms'],
        admission: ['email', 'in_app', 'push'],
        announcement: ['in_app', 'push'],
        marketplace: ['email', 'in_app', 'push'],
      },
    },
  })

  const demoNotificationUsers = [student, parent, teacher].filter(Boolean)
  for (const u of demoNotificationUsers) {
    await prisma.userNotificationPreference.upsert({
      where: { userId: u.id },
      update: {},
      create: { userId: u.id, email: true, sms: false, push: true, inApp: true },
    })
  }

  const existingNotif = await prisma.notification.count({ where: { userId: student.id } })
  if (existingNotif === 0) {
    await prisma.notification.createMany({
      data: [
        {
          userId: student.id,
          type: 'results',
          title: 'Mid-term results published',
          body: 'Mathematics: 82% (A) · English: 76% (B)',
          read: false,
        },
        {
          userId: student.id,
          type: 'fee',
          title: 'Term 2 school fees reminder',
          body: 'Outstanding ₦45,000 due 15 Jul 2026.',
          read: false,
        },
        {
          userId: parent.id,
          type: 'attendance',
          title: 'Attendance: Present',
          body: 'Demo Student marked present today.',
          read: true,
          readAt: new Date(),
        },
        {
          userId: teacher.id,
          type: 'announcement',
          title: 'Staff meeting Friday',
          body: 'All teaching staff — 3:00 PM in the main hall.',
          read: false,
        },
      ],
    })
  }

  console.log('✓ Notification settings and demo alerts seeded')

  const featureFlags = [
    { key: 'marketplace', label: 'Marketplace', description: 'School shop and product sales' },
    { key: 'ai', label: 'AI Features', description: 'AI tutor, lesson plans, exam generator' },
    { key: 'payroll', label: 'Payroll', description: 'Staff payroll processing' },
    { key: 'hostel', label: 'Hostel', description: 'Hostel room management' },
    { key: 'transport', label: 'Transport', description: 'Bus routes and GPS tracking' },
    { key: 'alumni', label: 'Alumni', description: 'Alumni portal and donations' },
    { key: 'biometric', label: 'Biometric', description: 'Biometric attendance devices' },
    { key: 'liveClasses', label: 'Live Classes', description: 'Virtual classroom sessions' },
    { key: 'websiteBuilder', label: 'Website Builder', description: 'Public school website CMS' },
    { key: 'admission', label: 'Admission CRM', description: 'Online admissions workflow' },
  ]
  for (const f of featureFlags) {
    await prisma.featureFlag.upsert({
      where: { key: f.key },
      update: { label: f.label, description: f.description },
      create: { ...f, enabled: true, planSlugs: [] },
    })
  }
  console.log('✓ Feature flags seeded')

  const integrationProviders = [
    { slug: 'google-workspace', name: 'Google Workspace', category: 'productivity', description: 'Calendar, Drive, and SSO for staff.', sortOrder: 0 },
    { slug: 'zoom', name: 'Zoom', category: 'video', description: 'Auto-create Zoom meetings for live classes.', sortOrder: 1 },
    { slug: 'paystack', name: 'Paystack', category: 'payments', description: 'Online fee collections.', sortOrder: 2 },
    { slug: 'whatsapp', name: 'WhatsApp Business', category: 'messaging', description: 'Fee reminders via WhatsApp.', sortOrder: 3 },
  ]
  for (const p of integrationProviders) {
    await prisma.integrationProvider.upsert({
      where: { slug: p.slug },
      update: { name: p.name, description: p.description, category: p.category, sortOrder: p.sortOrder },
      create: { ...p, isActive: true },
    })
  }

  const absentWorkflow = await prisma.workflowRule.findFirst({
    where: { schoolId: school.id, name: 'Notify parent after 3 absences' },
  })
  if (!absentWorkflow) {
    await prisma.workflowRule.create({
      data: {
        schoolId: school.id,
        name: 'Notify parent after 3 absences',
        description: 'Sample automation — edit in Admin → Automation',
        trigger: 'attendance.absent_streak',
        conditions: { minAbsentDays: 3 },
        actions: [
          {
            type: 'notify',
            title: 'Attendance concern',
            body: 'Your child has been absent for several consecutive days. Please contact the school.',
            channels: ['in_app', 'email'],
          },
        ],
        isActive: true,
      },
    })
  }
  console.log('✓ Enterprise integrations catalog & sample workflow seeded')
}

seed()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
