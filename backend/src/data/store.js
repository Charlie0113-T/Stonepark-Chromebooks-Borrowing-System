/**
 * In-memory data store with seed data.
 * In production this can be replaced by a database adapter.
 */

const { v4: uuidv4 } = require('uuid');

// Resource types
const RESOURCE_TYPE = {
  CABINET: 'cabinet',   // 班级充电柜
  SINGLE: 'single',     // 单台 Chromebook
};

// Booking status
const BOOKING_STATUS = {
  ACTIVE: 'active',
  RETURNED: 'returned',
  CANCELLED: 'cancelled',
};

// Resource status (derived)
const RESOURCE_STATUS = {
  AVAILABLE: 'available',   // 绿色 - 空闲
  PARTIAL: 'partial',       // 黄色 - 部分占用
  FULL: 'full',             // 红色 - 已满
};

// Seed resources
const resources = [
  {
    id: 'res-001',
    type: RESOURCE_TYPE.CABINET,
    name: 'Cabinet A',
    classRoom: 'Room 101',
    totalQuantity: 30,
    description: 'Main charging cabinet for Room 101',
  },
  {
    id: 'res-002',
    type: RESOURCE_TYPE.CABINET,
    name: 'Cabinet B',
    classRoom: 'Room 102',
    totalQuantity: 30,
    description: 'Main charging cabinet for Room 102',
  },
  {
    id: 'res-003',
    type: RESOURCE_TYPE.CABINET,
    name: 'Cabinet C',
    classRoom: 'Room 103',
    totalQuantity: 20,
    description: 'Small charging cabinet for Room 103',
  },
  {
    id: 'res-004',
    type: RESOURCE_TYPE.SINGLE,
    name: 'Chromebook #001',
    classRoom: 'Library',
    totalQuantity: 1,
    description: 'Individual Chromebook for library use',
  },
  {
    id: 'res-005',
    type: RESOURCE_TYPE.SINGLE,
    name: 'Chromebook #002',
    classRoom: 'Library',
    totalQuantity: 1,
    description: 'Individual Chromebook for library use',
  },
  {
    id: 'res-006',
    type: RESOURCE_TYPE.SINGLE,
    name: 'Chromebook #003',
    classRoom: 'Staff Room',
    totalQuantity: 1,
    description: 'Individual Chromebook for staff',
  },
];

// Seed bookings (some active, some returned)
const now = new Date();
const bookings = [
  {
    id: uuidv4(),
    resourceId: 'res-001',
    borrower: 'Ms. Johnson',
    borrowerClass: 'Class 10A',
    quantity: 15,
    startTime: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    endTime: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    actualReturnTime: null,
    status: BOOKING_STATUS.ACTIVE,
    notes: 'Science project',
  },
  {
    id: uuidv4(),
    resourceId: 'res-002',
    borrower: 'Mr. Smith',
    borrowerClass: 'Class 11B',
    quantity: 30,
    startTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    endTime: new Date(now.getTime() + 90 * 60 * 1000).toISOString(),
    actualReturnTime: null,
    status: BOOKING_STATUS.ACTIVE,
    notes: 'Exam session',
  },
  {
    id: uuidv4(),
    resourceId: 'res-004',
    borrower: 'Alice Chen',
    borrowerClass: 'Class 9C',
    quantity: 1,
    startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    actualReturnTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    status: BOOKING_STATUS.RETURNED,
    notes: '',
  },
];

module.exports = {
  resources,
  bookings,
  RESOURCE_TYPE,
  BOOKING_STATUS,
  RESOURCE_STATUS,
};
