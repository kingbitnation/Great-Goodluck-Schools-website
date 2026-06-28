const {
  resolveSchoolId,
  formatRoute,
  formatVehicle,
  formatLiveLocation,
  formatAllocation,
  formatMyAllocation,
  transportStatsForSchool,
  checkTenantAccess,
} = require('../lib/transportHelpers')

function registerTransportRoutes(app, { prisma, requireRole }) {
  const staffRoles = ['SuperAdmin', 'SchoolAdmin', 'TransportManager']
  const trackRoles = [...staffRoles, 'Student', 'Parent']

  app.get('/api/transport/stats', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })
      res.json(await transportStatsForSchool(prisma, schoolId))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== DRIVERS =====
  app.get('/api/transport/drivers', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.json([])
      const drivers = await prisma.transportDriver.findMany({
        where: { schoolId },
        orderBy: { name: 'asc' },
      })
      res.json(drivers)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/transport/drivers', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })
      const { name, phone, licenseNo } = req.body
      if (!name || !phone) return res.status(400).json({ error: 'Name and phone required' })
      const driver = await prisma.transportDriver.create({
        data: { schoolId, name, phone, licenseNo: licenseNo || null },
      })
      res.status(201).json(driver)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== ROUTES =====
  app.get('/api/transport/routes', requireRole(...staffRoles, 'Student', 'Parent'), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      const where = schoolId ? { schoolId } : {}
      const routes = await prisma.transportRoute.findMany({ where, orderBy: { name: 'asc' } })
      res.json(routes.map(formatRoute))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/transport/routes', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req) || req.body.schoolId
      if (!schoolId) return res.status(400).json({ error: 'School required' })
      const route = await prisma.transportRoute.create({
        data: {
          schoolId,
          name: req.body.routeName || req.body.name,
          startPoint: req.body.startPoint,
          endPoint: req.body.endPoint,
          fare: Number(req.body.costPerTerm ?? req.body.fare ?? 0),
          estimatedMinutes: req.body.estimatedMinutes != null ? Number(req.body.estimatedMinutes) : Number(req.body.estimatedTime) || null,
          stopsCount: req.body.stops != null ? Number(req.body.stops) : Number(req.body.stopsCount) || 0,
          distanceKm: req.body.distance != null ? Number(req.body.distance) : Number(req.body.distanceKm) || null,
        },
      })
      res.status(201).json(formatRoute(route))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/transport/routes/:id', requireRole(...staffRoles), async (req, res) => {
    try {
      const existing = await prisma.transportRoute.findUnique({ where: { id: req.params.id } })
      if (!existing || !checkTenantAccess(req, existing.schoolId)) return res.status(404).json({ error: 'Not found' })
      const route = await prisma.transportRoute.update({
        where: { id: existing.id },
        data: {
          name: req.body.routeName || req.body.name || undefined,
          startPoint: req.body.startPoint || undefined,
          endPoint: req.body.endPoint || undefined,
          fare: req.body.costPerTerm != null ? Number(req.body.costPerTerm) : req.body.fare != null ? Number(req.body.fare) : undefined,
          estimatedMinutes: req.body.estimatedMinutes != null ? Number(req.body.estimatedMinutes) : req.body.estimatedTime != null ? Number(req.body.estimatedTime) : undefined,
          stopsCount: req.body.stops != null ? Number(req.body.stops) : req.body.stopsCount != null ? Number(req.body.stopsCount) : undefined,
          distanceKm: req.body.distance != null ? Number(req.body.distance) : req.body.distanceKm != null ? Number(req.body.distanceKm) : undefined,
        },
      })
      res.json(formatRoute(route))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/transport/routes/:id', requireRole(...staffRoles), async (req, res) => {
    try {
      const existing = await prisma.transportRoute.findUnique({ where: { id: req.params.id } })
      if (!existing || !checkTenantAccess(req, existing.schoolId)) return res.status(404).json({ error: 'Not found' })
      await prisma.transportRoute.delete({ where: { id: existing.id } })
      res.json({ message: 'Deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== VEHICLES =====
  app.get('/api/transport/vehicles', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      const vehicles = await prisma.transportVehicle.findMany({
        where: schoolId ? { schoolId } : {},
        include: {
          driverRecord: true,
          liveLocation: true,
          allocations: { where: { status: 'active' }, take: 1 },
        },
        orderBy: { registrationNo: 'asc' },
      })
      res.json(vehicles.map(formatVehicle))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/transport/vehicles', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })
      const vehicle = await prisma.transportVehicle.create({
        data: {
          schoolId,
          registrationNo: req.body.registrationNumber || req.body.registrationNo,
          model: req.body.vehicleType || req.body.model || 'Bus',
          capacity: Number(req.body.capacity) || 30,
          driverRecordId: req.body.driverRecordId || null,
          driverName: req.body.driver || req.body.driverName || null,
          driverPhone: req.body.driverPhone || null,
          status: req.body.status || 'Active',
        },
        include: { driverRecord: true, allocations: true },
      })
      if (req.body.routeId) {
        await prisma.transportAllocation.create({
          data: {
            schoolId,
            vehicleId: vehicle.id,
            routeId: req.body.routeId,
            status: 'active',
          },
        })
      }
      res.status(201).json(formatVehicle(vehicle))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/transport/vehicles/:id', requireRole(...staffRoles), async (req, res) => {
    try {
      const existing = await prisma.transportVehicle.findUnique({ where: { id: req.params.id } })
      if (!existing || (existing.schoolId && !checkTenantAccess(req, existing.schoolId))) return res.status(404).json({ error: 'Not found' })
      const vehicle = await prisma.transportVehicle.update({
        where: { id: existing.id },
        data: {
          registrationNo: req.body.registrationNumber || req.body.registrationNo || undefined,
          model: req.body.vehicleType || req.body.model || undefined,
          capacity: req.body.capacity != null ? Number(req.body.capacity) : undefined,
          driverRecordId: req.body.driverRecordId !== undefined ? req.body.driverRecordId : undefined,
          driverName: req.body.driver || req.body.driverName !== undefined ? (req.body.driver || req.body.driverName) : undefined,
          driverPhone: req.body.driverPhone !== undefined ? req.body.driverPhone : undefined,
          status: req.body.status || undefined,
        },
        include: { driverRecord: true, liveLocation: true, allocations: { where: { status: 'active' }, take: 1 } },
      })
      res.json(formatVehicle(vehicle))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/transport/vehicles/:id', requireRole(...staffRoles), async (req, res) => {
    try {
      const existing = await prisma.transportVehicle.findUnique({ where: { id: req.params.id } })
      if (!existing || (existing.schoolId && !checkTenantAccess(req, existing.schoolId))) return res.status(404).json({ error: 'Not found' })
      await prisma.transportVehicle.delete({ where: { id: existing.id } })
      res.json({ message: 'Deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== ALLOCATIONS =====
  app.get('/api/transport/allocations', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      const where = schoolId ? { schoolId } : {}
      const allocations = await prisma.transportAllocation.findMany({
        where,
        include: {
          vehicle: { include: { driverRecord: true, liveLocation: true } },
          route: true,
          student: { include: { user: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      res.json(allocations.map(formatAllocation))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/transport/allocations', requireRole(...staffRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      const { vehicleId, routeId, studentId } = req.body
      if (!vehicleId || !routeId || !studentId) return res.status(400).json({ error: 'Vehicle, route, and student required' })

      const [vehicle, route, student] = await Promise.all([
        prisma.transportVehicle.findUnique({ where: { id: vehicleId } }),
        prisma.transportRoute.findUnique({ where: { id: routeId } }),
        prisma.student.findUnique({ where: { id: studentId } }),
      ])
      if (!vehicle || !route || route.schoolId !== (schoolId || student?.schoolId)) {
        return res.status(404).json({ error: 'Invalid vehicle or route' })
      }
      if (!student || student.schoolId !== route.schoolId) return res.status(404).json({ error: 'Student not found' })

      const active = await prisma.transportAllocation.count({
        where: { vehicleId, status: 'active', studentId: { not: null } },
      })
      if (active >= vehicle.capacity) return res.status(400).json({ error: 'Vehicle at capacity' })

      const existingStudent = await prisma.transportAllocation.findFirst({
        where: { studentId, status: 'active' },
      })
      if (existingStudent) return res.status(400).json({ error: 'Student already has active transport allocation' })

      const allocation = await prisma.transportAllocation.create({
        data: {
          schoolId: route.schoolId,
          vehicleId,
          routeId,
          studentId,
          status: 'active',
        },
        include: {
          vehicle: { include: { driverRecord: true, liveLocation: true } },
          route: true,
          student: { include: { user: true } },
        },
      })
      res.status(201).json(formatAllocation(allocation))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/transport/allocations/:id/release', requireRole(...staffRoles), async (req, res) => {
    try {
      const allocation = await prisma.transportAllocation.findUnique({
        where: { id: req.params.id },
        include: { vehicle: true, route: true, student: { include: { user: true } } },
      })
      if (!allocation || (allocation.schoolId && !checkTenantAccess(req, allocation.schoolId))) {
        return res.status(404).json({ error: 'Not found' })
      }
      const updated = await prisma.transportAllocation.update({
        where: { id: allocation.id },
        data: { status: 'released', releaseDate: new Date() },
        include: { vehicle: true, route: true, student: { include: { user: true } } },
      })
      res.json(formatAllocation(updated))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/transport/allocations/:id', requireRole(...staffRoles), async (req, res) => {
    try {
      const allocation = await prisma.transportAllocation.findUnique({ where: { id: req.params.id } })
      if (!allocation || (allocation.schoolId && !checkTenantAccess(req, allocation.schoolId))) {
        return res.status(404).json({ error: 'Not found' })
      }
      await prisma.transportAllocation.delete({ where: { id: allocation.id } })
      res.json({ message: 'Deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== LIVE GPS / ETA =====
  app.get('/api/transport/live', requireRole(...trackRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.json([])
      const locations = await prisma.transportLiveLocation.findMany({
        where: { schoolId },
        include: { vehicle: { include: { driverRecord: true } } },
      })
      res.json(locations.map((l) => ({
        ...formatLiveLocation(l),
        vehicle: formatVehicle({ ...l.vehicle, allocations: [], liveLocation: l }),
      })))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/transport/vehicles/:id/location', requireRole(...staffRoles), async (req, res) => {
    try {
      const vehicle = await prisma.transportVehicle.findUnique({ where: { id: req.params.id } })
      if (!vehicle || (vehicle.schoolId && !checkTenantAccess(req, vehicle.schoolId))) {
        return res.status(404).json({ error: 'Not found' })
      }
      const { latitude, longitude, etaMinutes, status, routeId } = req.body
      if (latitude == null || longitude == null) return res.status(400).json({ error: 'Coordinates required' })

      const location = await prisma.transportLiveLocation.upsert({
        where: { vehicleId: vehicle.id },
        update: {
          latitude: Number(latitude),
          longitude: Number(longitude),
          etaMinutes: etaMinutes != null ? Number(etaMinutes) : undefined,
          status: status || 'en_route',
          routeId: routeId || undefined,
        },
        create: {
          schoolId: vehicle.schoolId,
          vehicleId: vehicle.id,
          routeId: routeId || null,
          latitude: Number(latitude),
          longitude: Number(longitude),
          etaMinutes: etaMinutes != null ? Number(etaMinutes) : null,
          status: status || 'en_route',
        },
      })
      res.json(formatLiveLocation(location))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  async function allocationForStudent(studentId) {
    return prisma.transportAllocation.findFirst({
      where: { studentId, status: 'active' },
      include: {
        vehicle: { include: { driverRecord: true, liveLocation: true } },
        route: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  app.get('/api/transport/my-allocation', requireRole('Student'), async (req, res) => {
    try {
      const student = await prisma.student.findUnique({ where: { userId: req.user.userId || req.user.id } })
      if (!student) return res.json(null)
      const allocation = await allocationForStudent(student.id)
      if (!allocation) return res.json(null)
      res.json(formatMyAllocation(allocation))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/transport/tracking/:studentId', requireRole('Parent', 'Student', ...staffRoles), async (req, res) => {
    try {
      const student = await prisma.student.findUnique({ where: { id: req.params.studentId } })
      if (!student) return res.status(404).json({ error: 'Student not found' })

      if (req.user.role === 'Student') {
        const self = await prisma.student.findUnique({ where: { userId: req.user.userId || req.user.id } })
        if (!self || self.id !== student.id) return res.status(403).json({ error: 'Forbidden' })
      }
      if (req.user.role === 'Parent') {
        const parent = await prisma.parent.findUnique({ where: { userId: req.user.userId || req.user.id } })
        if (!parent) return res.status(403).json({ error: 'Forbidden' })
        const link = await prisma.student.findFirst({ where: { id: student.id, parentId: parent.id } })
        if (!link) return res.status(403).json({ error: 'Forbidden' })
      }
      if (student.schoolId && req.user.role !== 'SuperAdmin' && req.user.schoolId !== student.schoolId) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      const allocation = await allocationForStudent(student.id)
      if (!allocation) return res.json(null)
      res.json(formatMyAllocation(allocation))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })
}

module.exports = { registerTransportRoutes }
