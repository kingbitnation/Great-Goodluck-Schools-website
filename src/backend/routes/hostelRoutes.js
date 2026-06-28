const {
  resolveSchoolId,
  formatRoom,
  formatBlock,
  formatAllocation,
  hostelStatsForSchool,
  checkTenantAccess,
} = require('../lib/hostelHelpers')

function registerHostelRoutes(app, { prisma, requireRole }) {
  const staffRoles = ['SuperAdmin', 'SchoolAdmin', 'HostelManager']

  async function roomSchoolId(roomId) {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { hostel: true },
    })
    return room?.hostel?.schoolId || null
  }

  // ===== STATS / DASHBOARD =====
  app.get('/api/hostel/stats', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })
      res.json(await hostelStatsForSchool(prisma, schoolId))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== BLOCKS (HOSTELS) =====
  app.get('/api/hostel/blocks', requireRole(...staffRoles, 'Student'), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId && req.user.role !== 'SuperAdmin') return res.json([])

      const where = schoolId ? { schoolId, isActive: true } : {}
      const hostels = await prisma.hostel.findMany({
        where,
        include: { rooms: true },
        orderBy: { name: 'asc' },
      })

      res.json(hostels.map((h) => {
        const totalBeds = h.rooms.reduce((s, r) => s + r.capacity, 0)
        const occupiedBeds = h.rooms.reduce((s, r) => s + r.currentOccupancy, 0)
        return formatBlock(h, { roomCount: h.rooms.length, totalBeds, occupiedBeds })
      }))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/hostel/blocks', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })

      const { name, capacity, gender, description } = req.body
      if (!name || capacity == null) return res.status(400).json({ error: 'Name and capacity required' })

      const hostel = await prisma.hostel.create({
        data: {
          schoolId,
          name,
          capacity: Number(capacity),
          gender: gender || 'mixed',
          description: description || null,
        },
      })
      res.status(201).json(formatBlock(hostel, { roomCount: 0, totalBeds: 0, occupiedBeds: 0 }))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/hostel/blocks/:id', requireRole(...staffRoles), async (req, res) => {
    try {
      const hostel = await prisma.hostel.findUnique({
        where: { id: req.params.id },
        include: { rooms: true },
      })
      if (!hostel || !checkTenantAccess(req, hostel.schoolId)) return res.status(404).json({ error: 'Not found' })

      const { name, capacity, gender, description, isActive } = req.body
      const updated = await prisma.hostel.update({
        where: { id: hostel.id },
        data: {
          name: name || undefined,
          capacity: capacity != null ? Number(capacity) : undefined,
          gender: gender || undefined,
          description: description !== undefined ? description : undefined,
          isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        },
        include: { rooms: true },
      })

      const totalBeds = updated.rooms.reduce((s, r) => s + r.capacity, 0)
      const occupiedBeds = updated.rooms.reduce((s, r) => s + r.currentOccupancy, 0)
      res.json(formatBlock(updated, { roomCount: updated.rooms.length, totalBeds, occupiedBeds }))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== ROOMS =====
  app.get('/api/hostel/rooms', requireRole(...staffRoles, 'Student'), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      const hostelId = req.query.hostelId ? String(req.query.hostelId) : null
      const q = String(req.query.q || '').trim()

      const hostelWhere = schoolId ? { schoolId } : {}
      if (hostelId) hostelWhere.id = hostelId

      const rooms = await prisma.room.findMany({
        where: {
          hostel: hostelWhere,
          ...(q ? {
            OR: [
              { roomNumber: { contains: q, mode: 'insensitive' } },
              { hostel: { name: { contains: q, mode: 'insensitive' } } },
            ],
          } : {}),
        },
        include: { hostel: true },
        orderBy: [{ hostel: { name: 'asc' } }, { roomNumber: 'asc' }],
      })
      res.json(rooms.map(formatRoom))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/hostel/rooms', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })

      let { hostelId, buildingName, roomNumber, capacity, floor, costPerTerm, amenities } = req.body
      if (!roomNumber || capacity == null) return res.status(400).json({ error: 'Room number and capacity required' })

      if (!hostelId && buildingName) {
        let hostel = await prisma.hostel.findFirst({ where: { schoolId, name: buildingName } })
        if (!hostel) {
          hostel = await prisma.hostel.create({
            data: { schoolId, name: buildingName, capacity: 100 },
          })
        }
        hostelId = hostel.id
      }

      if (!hostelId) return res.status(400).json({ error: 'Block required' })

      const hostel = await prisma.hostel.findUnique({ where: { id: hostelId } })
      if (!hostel || hostel.schoolId !== schoolId) return res.status(400).json({ error: 'Invalid block' })

      const room = await prisma.room.create({
        data: {
          hostelId,
          roomNumber,
          capacity: Number(capacity),
          floor: floor || null,
          costPerTerm: costPerTerm != null ? Number(costPerTerm) : null,
          amenities: amenities || [],
        },
        include: { hostel: true },
      })
      res.status(201).json(formatRoom(room))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/hostel/rooms/:id', requireRole(...staffRoles), async (req, res) => {
    try {
      const existing = await prisma.room.findUnique({
        where: { id: req.params.id },
        include: { hostel: true },
      })
      if (!existing || !checkTenantAccess(req, existing.hostel.schoolId)) return res.status(404).json({ error: 'Not found' })

      const capacity = req.body.capacity !== undefined ? Number(req.body.capacity) : undefined
      const onOccupied = existing.currentOccupancy
      const nextAvailable = capacity !== undefined ? Math.max(onOccupied, capacity) : undefined

      const room = await prisma.room.update({
        where: { id: existing.id },
        data: {
          roomNumber: req.body.roomNumber || undefined,
          capacity,
          currentOccupancy: capacity !== undefined && onOccupied > capacity ? capacity : undefined,
          floor: req.body.floor !== undefined ? req.body.floor : undefined,
          costPerTerm: req.body.costPerTerm !== undefined ? Number(req.body.costPerTerm) : undefined,
          amenities: req.body.amenities !== undefined ? req.body.amenities : undefined,
        },
        include: { hostel: true },
      })
      res.json(formatRoom(room))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/hostel/rooms/:id', requireRole(...staffRoles), async (req, res) => {
    try {
      const existing = await prisma.room.findUnique({
        where: { id: req.params.id },
        include: { hostel: true },
      })
      if (!existing || !checkTenantAccess(req, existing.hostel.schoolId)) return res.status(404).json({ error: 'Not found' })

      const active = await prisma.hostelAllocation.count({
        where: { roomId: existing.id, status: 'active' },
      })
      if (active > 0) return res.status(400).json({ error: 'Room has active allocations' })

      await prisma.room.delete({ where: { id: existing.id } })
      res.json({ message: 'Deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== ALLOCATIONS =====
  app.get('/api/hostel/allocations', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.json([])

      const status = req.query.status ? String(req.query.status) : null
      const where = { schoolId }
      if (status) where.status = status

      const allocations = await prisma.hostelAllocation.findMany({
        where,
        include: {
          room: { include: { hostel: true } },
          student: { include: { user: true } },
        },
        orderBy: { allocationDate: 'desc' },
      })
      res.json(allocations.map(formatAllocation))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/hostel/allocations', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })

      const { roomId, studentId, allocationDate } = req.body
      if (!roomId || !studentId) return res.status(400).json({ error: 'Room and student required' })

      const [room, student] = await Promise.all([
        prisma.room.findUnique({ where: { id: roomId }, include: { hostel: true } }),
        prisma.student.findUnique({ where: { id: studentId } }),
      ])
      if (!room || room.hostel.schoolId !== schoolId) return res.status(404).json({ error: 'Room not found' })
      if (!student || student.schoolId !== schoolId) return res.status(404).json({ error: 'Student not found' })
      if (room.currentOccupancy >= room.capacity) return res.status(400).json({ error: 'Room is full' })

      const existingActive = await prisma.hostelAllocation.findFirst({
        where: { studentId, status: 'active' },
      })
      if (existingActive) return res.status(400).json({ error: 'Student already has an active hostel allocation' })

      const allocation = await prisma.$transaction(async (tx) => {
        const created = await tx.hostelAllocation.create({
          data: {
            schoolId,
            roomId,
            studentId,
            allocationDate: allocationDate ? new Date(allocationDate) : new Date(),
            status: 'active',
          },
          include: { room: { include: { hostel: true } }, student: { include: { user: true } } },
        })
        await tx.room.update({
          where: { id: roomId },
          data: { currentOccupancy: { increment: 1 } },
        })
        return created
      })

      res.status(201).json(formatAllocation(allocation))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/hostel/allocations/:id/vacate', requireRole(...staffRoles), async (req, res) => {
    try {
      const allocation = await prisma.hostelAllocation.findUnique({
        where: { id: req.params.id },
        include: { room: { include: { hostel: true } }, student: { include: { user: true } } },
      })
      if (!allocation || !checkTenantAccess(req, allocation.schoolId)) return res.status(404).json({ error: 'Not found' })
      if (allocation.status !== 'active') return res.json(formatAllocation(allocation))

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.hostelAllocation.update({
          where: { id: allocation.id },
          data: { status: 'vacated', releaseDate: new Date() },
          include: { room: { include: { hostel: true } }, student: { include: { user: true } } },
        })
        await tx.room.update({
          where: { id: allocation.roomId },
          data: { currentOccupancy: { decrement: 1 } },
        })
        return result
      })

      res.json(formatAllocation(updated))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/hostel/allocations/:id', requireRole(...staffRoles), async (req, res) => {
    try {
      const allocation = await prisma.hostelAllocation.findUnique({ where: { id: req.params.id } })
      if (!allocation || !checkTenantAccess(req, allocation.schoolId)) return res.status(404).json({ error: 'Not found' })

      if (allocation.status === 'active') {
        await prisma.$transaction([
          prisma.hostelAllocation.delete({ where: { id: allocation.id } }),
          prisma.room.update({
            where: { id: allocation.roomId },
            data: { currentOccupancy: { decrement: 1 } },
          }),
        ])
      } else {
        await prisma.hostelAllocation.delete({ where: { id: allocation.id } })
      }
      res.json({ message: 'Deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== STUDENT =====
  app.get('/api/hostel/my-allocation', requireRole('Student'), async (req, res) => {
    try {
      const student = await prisma.student.findUnique({
        where: { userId: req.user.userId || req.user.id },
      })
      if (!student) return res.json(null)

      const allocation = await prisma.hostelAllocation.findFirst({
        where: { studentId: student.id, status: 'active' },
        include: { room: { include: { hostel: true } } },
        orderBy: { allocationDate: 'desc' },
      })
      if (!allocation) return res.json(null)

      const formatted = formatAllocation({ ...allocation, student: null })
      res.json({
        id: formatted.id,
        roomId: formatted.roomId,
        room: formatted.room,
        allocatedAt: formatted.allocatedAt,
        vacatedAt: formatted.vacatedAt,
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })
}

module.exports = { registerHostelRoutes }
