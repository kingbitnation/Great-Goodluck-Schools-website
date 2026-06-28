const { checkTenantAccess } = require('./tenantHelpers')

function resolveSchoolId(req) {
  if (req.user.role === 'SuperAdmin' && req.query.schoolId) return String(req.query.schoolId)
  return req.user.schoolId
}

function formatRoute(route) {
  return {
    id: route.id,
    routeName: route.name,
    name: route.name,
    startPoint: route.startPoint,
    endPoint: route.endPoint,
    distance: route.distanceKm || 0,
    estimatedTime: route.estimatedMinutes ? String(route.estimatedMinutes) : '30',
    estimatedMinutes: route.estimatedMinutes,
    costPerTerm: route.fare,
    fare: route.fare,
    stops: route.stopsCount || 0,
    stopsCount: route.stopsCount || 0,
    createdAt: route.createdAt,
  }
}

function formatVehicle(vehicle) {
  const driver = vehicle.driverRecord
  return {
    id: vehicle.id,
    registrationNumber: vehicle.registrationNo,
    registrationNo: vehicle.registrationNo,
    vehicleType: vehicle.model,
    model: vehicle.model,
    capacity: vehicle.capacity,
    driver: driver?.name || vehicle.driverName || vehicle.driverRecordId || '',
    driverPhone: driver?.phone || vehicle.driverPhone || '',
    driverRecordId: vehicle.driverRecordId,
    status: vehicle.status,
    routeId: vehicle.allocations?.[0]?.routeId || '',
    createdAt: vehicle.createdAt,
    liveLocation: vehicle.liveLocation ? formatLiveLocation(vehicle.liveLocation) : null,
  }
}

function formatLiveLocation(loc) {
  return {
    vehicleId: loc.vehicleId,
    routeId: loc.routeId,
    latitude: loc.latitude,
    longitude: loc.longitude,
    etaMinutes: loc.etaMinutes,
    status: loc.status,
    updatedAt: loc.updatedAt,
  }
}

function formatAllocation(allocation) {
  return {
    id: allocation.id,
    studentId: allocation.studentId,
    student: allocation.student ? {
      id: allocation.student.id,
      firstName: allocation.student.user?.firstName || '',
      lastName: allocation.student.user?.lastName || '',
      email: allocation.student.user?.email || '',
      admissionNo: allocation.student.admissionNo,
    } : null,
    routeId: allocation.routeId,
    route: allocation.route ? { id: allocation.route.id, routeName: allocation.route.name } : null,
    vehicleId: allocation.vehicleId,
    vehicle: allocation.vehicle ? {
      id: allocation.vehicle.id,
      registrationNumber: allocation.vehicle.registrationNo,
    } : null,
    allocatedAt: allocation.createdAt,
    deallocatedAt: allocation.releaseDate,
    status: allocation.status,
  }
}

function formatMyAllocation(allocation) {
  const vehicle = allocation.vehicle
  const route = allocation.route
  const live = vehicle?.liveLocation
  return {
    id: allocation.id,
    route: route ? formatRoute(route) : null,
    vehicle: vehicle ? formatVehicle({ ...vehicle, allocations: [] }) : null,
    allocatedAt: allocation.createdAt,
    tracking: live ? formatLiveLocation(live) : null,
  }
}

async function transportStatsForSchool(prisma, schoolId) {
  const [routes, vehicles, drivers, activeAllocations, liveTrips] = await Promise.all([
    prisma.transportRoute.count({ where: { schoolId } }),
    prisma.transportVehicle.count({ where: { schoolId } }),
    prisma.transportDriver.count({ where: { schoolId, status: 'active' } }),
    prisma.transportAllocation.count({ where: { schoolId, status: 'active', studentId: { not: null } } }),
    prisma.transportLiveLocation.count({ where: { schoolId, status: 'en_route' } }),
  ])

  const vehicleCapacity = await prisma.transportVehicle.aggregate({
    where: { schoolId },
    _sum: { capacity: true },
  })

  return {
    routes,
    vehicles,
    drivers,
    activeStudentAllocations: activeAllocations,
    totalSeats: vehicleCapacity._sum.capacity || 0,
    busesEnRoute: liveTrips,
  }
}

module.exports = {
  resolveSchoolId,
  formatRoute,
  formatVehicle,
  formatLiveLocation,
  formatAllocation,
  formatMyAllocation,
  transportStatsForSchool,
  checkTenantAccess,
}
