const { checkTenantAccess } = require('./tenantHelpers')

function resolveSchoolId(req) {
  if (req.user.role === 'SuperAdmin' && req.query.schoolId) return String(req.query.schoolId)
  return req.user.schoolId
}

function formatRoom(room) {
  return {
    id: room.id,
    hostelId: room.hostelId,
    roomNumber: room.roomNumber,
    capacity: room.capacity,
    occupancy: room.currentOccupancy,
    quantity: room.capacity,
    availableQuantity: Math.max(0, room.capacity - room.currentOccupancy),
    buildingName: room.hostel?.name || 'Hostel',
    floor: room.floor || '1',
    costPerTerm: room.costPerTerm || 0,
    amenities: room.amenities || [],
    gender: room.hostel?.gender || 'mixed',
    createdAt: room.createdAt,
  }
}

function formatBlock(hostel, roomStats = {}) {
  return {
    id: hostel.id,
    name: hostel.name,
    capacity: hostel.capacity,
    gender: hostel.gender,
    description: hostel.description,
    isActive: hostel.isActive,
    roomCount: roomStats.roomCount || 0,
    totalBeds: roomStats.totalBeds || 0,
    occupiedBeds: roomStats.occupiedBeds || 0,
    createdAt: hostel.createdAt,
  }
}

function formatAllocation(allocation) {
  return {
    id: allocation.id,
    roomId: allocation.roomId,
    room: allocation.room ? {
      id: allocation.room.id,
      roomNumber: allocation.room.roomNumber,
      buildingName: allocation.room.hostel?.name || 'Hostel',
      floor: allocation.room.floor || '1',
      capacity: allocation.room.capacity,
      costPerTerm: allocation.room.costPerTerm || 0,
    } : null,
    studentId: allocation.studentId,
    student: allocation.student ? {
      id: allocation.student.id,
      firstName: allocation.student.user?.firstName || '',
      lastName: allocation.student.user?.lastName || '',
      email: allocation.student.user?.email || '',
      admissionNo: allocation.student.admissionNo,
    } : null,
    sessionId: '',
    termId: '',
    allocatedAt: allocation.allocationDate,
    vacatedAt: allocation.releaseDate,
    status: allocation.status,
  }
}

async function hostelStatsForSchool(prisma, schoolId) {
  const hostels = await prisma.hostel.findMany({
    where: { schoolId, isActive: true },
    include: { rooms: true },
  })

  let totalRooms = 0
  let totalBeds = 0
  let occupiedBeds = 0

  const blocks = hostels.map((h) => {
    const beds = h.rooms.reduce((s, r) => s + r.capacity, 0)
    const occupied = h.rooms.reduce((s, r) => s + r.currentOccupancy, 0)
    totalRooms += h.rooms.length
    totalBeds += beds
    occupiedBeds += occupied
    return formatBlock(h, { roomCount: h.rooms.length, totalBeds: beds, occupiedBeds: occupied })
  })

  const activeAllocations = await prisma.hostelAllocation.count({
    where: { schoolId, status: 'active' },
  })

  return {
    blocks: blocks.length,
    totalRooms,
    totalBeds,
    occupiedBeds,
    availableBeds: totalBeds - occupiedBeds,
    occupancyRate: totalBeds ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
    activeAllocations,
    blockBreakdown: blocks,
  }
}

module.exports = {
  resolveSchoolId,
  formatRoom,
  formatBlock,
  formatAllocation,
  hostelStatsForSchool,
  checkTenantAccess,
}
