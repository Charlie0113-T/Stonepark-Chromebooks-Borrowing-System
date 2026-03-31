/**
 * In-memory data store with seed data.
 * In production this can be replaced by a database adapter.
 */

const { randomUUID } = require("node:crypto");

// Resource types
const RESOURCE_TYPE = {
  CABINET: "cabinet", // 班级充电柜
  SINGLE: "single", // 单台 Chromebook
};

// Booking status
const BOOKING_STATUS = {
  ACTIVE: "active",
  RETURNED: "returned",
  CANCELLED: "cancelled",
};

// Resource status (derived)
const RESOURCE_STATUS = {
  AVAILABLE: "available", // 绿色 - 空闲
  PARTIAL: "partial", // 黄色 - 部分占用
  FULL: "full", // 红色 - 已满
};

// Seed resources
const resources = [
  {
    id: "res-005",
    type: RESOURCE_TYPE.SINGLE,
    name: "Chromebook #001",
    classRoom: "Library",
    totalQuantity: 1,
    description: "Library Chromebook for student research",
  },
  {
    id: "res-006",
    type: RESOURCE_TYPE.SINGLE,
    name: "Chromebook #002",
    classRoom: "Library",
    totalQuantity: 1,
    description: "Library Chromebook for student research",
  },
  {
    id: "res-007",
    type: RESOURCE_TYPE.SINGLE,
    name: "Chromebook #003",
    classRoom: "Staff Room",
    totalQuantity: 1,
    description: "Staff shared Chromebook",
  },
  {
    id: "res-008",
    type: RESOURCE_TYPE.SINGLE,
    name: "Chromebook #004",
    classRoom: "Reception",
    totalQuantity: 1,
    description: "Front desk Chromebook for visitor sign-in",
  },
  {
    id: "res-009",
    type: RESOURCE_TYPE.SINGLE,
    name: "Chromebook #005",
    classRoom: "Reception",
    totalQuantity: 1,
    description: "Front desk Chromebook for visitor sign-in",
  },
];

for (const grade of ["G7", "G8", "G9"]) {
  for (let i = 1; i <= 5; i += 1) {
    resources.push({
      id: `res-${grade.toLowerCase()}-cab-${i}`,
      type: RESOURCE_TYPE.CABINET,
      name: `${grade} Charging Bay ${i}`,
      classRoom: `${grade} Learning Hub ${i}`,
      totalQuantity: 30,
      description: `${grade} dedicated charging cabinet`,
    });
  }
}

// Seed bookings (active, returned, cancelled, and overdue scenarios)
const now = new Date();
const bookings = [
  {
    id: randomUUID(),
    resourceId: "res-g7-cab-1",
    borrower: "Ms. Johnson",
    borrowerClass: "Year 7",
    quantity: 15,
    startTime: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    endTime: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    actualReturnTime: null,
    status: BOOKING_STATUS.ACTIVE,
    notes: "Year 7 Science project",
  },
  {
    id: randomUUID(),
    resourceId: "res-g8-cab-1",
    borrower: "Mr. Smith",
    borrowerClass: "Year 8",
    quantity: 30,
    startTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    endTime: new Date(now.getTime() + 90 * 60 * 1000).toISOString(),
    actualReturnTime: null,
    status: BOOKING_STATUS.ACTIVE,
    notes: "Year 8 Digital Literacy exam",
  },
  {
    id: randomUUID(),
    resourceId: "res-g7-cab-2",
    borrower: "Ms. Brown",
    borrowerClass: "Year 7",
    quantity: 10,
    startTime: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    actualReturnTime: new Date(
      now.getTime() - 2 * 60 * 60 * 1000,
    ).toISOString(),
    status: BOOKING_STATUS.RETURNED,
    notes: "Maths assessment completed",
  },
];

module.exports = {
  resources,
  bookings,
  RESOURCE_TYPE,
  BOOKING_STATUS,
  RESOURCE_STATUS,
};
