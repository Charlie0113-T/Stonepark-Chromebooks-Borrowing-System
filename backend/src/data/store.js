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
    description: 'Year 7 charging cabinet',
  },
  {
    id: 'res-002',
    type: RESOURCE_TYPE.CABINET,
    name: 'Cabinet B',
    classRoom: 'Room 102',
    totalQuantity: 30,
    description: 'Year 8 charging cabinet',
  },
  {
    id: 'res-003',
    type: RESOURCE_TYPE.CABINET,
    name: 'Cabinet C',
    classRoom: 'Room 103',
    totalQuantity: 20,
    description: 'Science department shared cabinet',
  },
  {
    id: 'res-004',
    type: RESOURCE_TYPE.CABINET,
    name: 'Cabinet D',
    classRoom: 'Room 201',
    totalQuantity: 25,
    description: 'Digital Arts classroom cabinet',
  },
  {
    id: 'res-005',
    type: RESOURCE_TYPE.SINGLE,
    name: 'Chromebook #001',
    classRoom: 'Library',
    totalQuantity: 1,
    description: 'Library Chromebook for student research',
  },
  {
    id: 'res-006',
    type: RESOURCE_TYPE.SINGLE,
    name: 'Chromebook #002',
    classRoom: 'Library',
    totalQuantity: 1,
    description: 'Library Chromebook for student research',
  },
  {
    id: 'res-007',
    type: RESOURCE_TYPE.SINGLE,
    name: 'Chromebook #003',
    classRoom: 'Staff Room',
    totalQuantity: 1,
    description: 'Staff shared Chromebook',
  },
  {
    id: 'res-008',
    type: RESOURCE_TYPE.SINGLE,
    name: 'Chromebook #004',
    classRoom: 'Reception',
    totalQuantity: 1,
    description: 'Front desk Chromebook for visitor sign-in',
  },
  {
    id: 'res-009',
    type: RESOURCE_TYPE.SINGLE,
    name: 'Chromebook #005',
    classRoom: 'Room 105',
    totalQuantity: 1,
    description: 'ESOL support Chromebook',
  },
];

// Seed bookings (active, returned, cancelled, and overdue scenarios)
const now = new Date();
const bookings = [
  {
    id: uuidv4(),
    resourceId: 'res-001',
    borrower: 'Ms. Johnson',
    borrowerClass: 'Year 7',
    quantity: 15,
    startTime: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    endTime: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    actualReturnTime: null,
    status: BOOKING_STATUS.ACTIVE,
    notes: 'Year 7 Science project',
  },
  {
    id: uuidv4(),
    resourceId: 'res-002',
    borrower: 'Mr. Smith',
    borrowerClass: 'Year 8',
    quantity: 30,
    startTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    endTime: new Date(now.getTime() + 90 * 60 * 1000).toISOString(),
    actualReturnTime: null,
    status: BOOKING_STATUS.ACTIVE,
    notes: 'Year 8 Digital Literacy exam',
  },
  {
    id: uuidv4(),
    resourceId: 'res-005',
    borrower: 'Alice Chen',
    borrowerClass: 'Year 9',
    quantity: 1,
    startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    actualReturnTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    status: BOOKING_STATUS.RETURNED,
    notes: 'Independent research',
  },
  {
    id: uuidv4(),
    resourceId: 'res-003',
    borrower: 'Mrs. Williams',
    borrowerClass: 'Year 9',
    quantity: 10,
    startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString(),
    actualReturnTime: null,
    status: BOOKING_STATUS.ACTIVE,
    notes: 'Year 9 Geography mapping exercise',
  },
  {
    id: uuidv4(),
    resourceId: 'res-004',
    borrower: 'Mr. Patel',
    borrowerClass: 'Year 10',
    quantity: 20,
    startTime: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
    actualReturnTime: null,
    status: BOOKING_STATUS.ACTIVE,
    notes: 'Digital Arts portfolio work',
  },
  {
    id: uuidv4(),
    resourceId: 'res-007',
    borrower: 'Sarah Kim',
    borrowerClass: 'Staff',
    quantity: 1,
    startTime: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
    actualReturnTime: null,
    status: BOOKING_STATUS.ACTIVE,
    notes: 'Staff meeting notes',
  },
  {
    id: uuidv4(),
    resourceId: 'res-001',
    borrower: 'Ms. Brown',
    borrowerClass: 'Year 7',
    quantity: 10,
    startTime: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    actualReturnTime: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    status: BOOKING_STATUS.RETURNED,
    notes: 'Maths assessment completed',
  },
  {
    id: uuidv4(),
    resourceId: 'res-009',
    borrower: 'Jake Thompson',
    borrowerClass: 'Year 8',
    quantity: 1,
    startTime: new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    actualReturnTime: null,
    status: BOOKING_STATUS.CANCELLED,
    notes: 'Cancelled - student absent',
  },
];

module.exports = {
  resources,
  bookings,
  RESOURCE_TYPE,
  BOOKING_STATUS,
  RESOURCE_STATUS,
};
