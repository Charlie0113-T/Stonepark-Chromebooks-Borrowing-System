/**
 * Shared domain constants.
 *
 * This file used to also hold in-memory seed arrays. Those were superseded by
 * the SQLite/Postgres seeding in src/db/database.js, but were still being
 * constructed on every import. Only the constants are real now.
 */

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

module.exports = {
  RESOURCE_TYPE,
  BOOKING_STATUS,
  RESOURCE_STATUS,
};
